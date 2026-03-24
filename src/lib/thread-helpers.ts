/**
 * Thread helper functions — auto-create threads, backfill, etc.
 */
import { supabase as cloudSupabase } from '@/integrations/supabase/client';

export interface ThreadRow {
  id: string;
  agency_id: string;
  thread_type: string;
  title: string | null;
  classroom_id: string | null;
  is_private: boolean;
  is_archived: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
  last_message_at: string | null;
  last_message_preview: string | null;
}

export interface ThreadMessageRow {
  id: string;
  thread_id: string;
  sender_id: string;
  parent_id: string | null;
  body: string;
  message_type: string;
  metadata: Record<string, any>;
  is_deleted: boolean;
  created_at: string;
}

export interface ThreadMemberRow {
  id: string;
  thread_id: string;
  user_id: string;
  role: string;
  is_muted: boolean;
  last_read_at: string | null;
}

export interface ThreadReactionRow {
  id: string;
  message_id: string;
  user_id: string;
  emoji: string;
}

export const THREAD_TYPE_CONFIG = {
  agency:    { label: '#general', icon: 'hash', canDelete: false },
  classroom: { label: 'Classroom', icon: 'school', canDelete: false },
  dm:        { label: 'Direct Message', icon: 'user', canDelete: true },
  group:     { label: 'Group', icon: 'users', canDelete: true },
  parent:    { label: 'Parent', icon: 'heart', canDelete: false },
  team:      { label: 'Team', icon: 'users', canDelete: true },
} as const;

/**
 * Ensure an agency-wide staff feed thread exists (opt-in school/agency-wide announcements).
 */
export async function ensureAgencyFeedThread(agencyId: string, userId: string): Promise<string | null> {
  try {
    const { data: existing } = await cloudSupabase
      .from('threads')
      .select('id')
      .eq('agency_id', agencyId)
      .eq('thread_type', 'group')
      .eq('title', '#staff-feed')
      .limit(1)
      .maybeSingle();

    if (existing) return existing.id;

    const { data: created, error } = await cloudSupabase
      .from('threads')
      .insert({
        agency_id: agencyId,
        thread_type: 'group',
        title: '#staff-feed',
        is_private: false,
        created_by: userId,
      })
      .select('id')
      .single();

    if (error) return null;

    if (created) {
      await cloudSupabase.from('thread_members').insert({
        thread_id: created.id, user_id: userId, role: 'admin',
      });
      await cloudSupabase.from('thread_messages').insert({
        thread_id: created.id, sender_id: userId,
        body: 'Staff feed created — agency-wide updates and announcements',
        message_type: 'system',
      });
    }
    return created?.id || null;
  } catch { return null; }
}

/**
 * Ensure the agency has a #general thread. Creates if missing.
 */
export async function ensureAgencyThread(agencyId: string, userId: string): Promise<string | null> {
  try {
    const { data: existing } = await cloudSupabase
      .from('threads')
      .select('id')
      .eq('agency_id', agencyId)
      .eq('thread_type', 'agency')
      .limit(1)
      .single();

    if (existing) return existing.id;

    const { data: created, error } = await cloudSupabase
      .from('threads')
      .insert({
        agency_id: agencyId,
        thread_type: 'agency',
        title: '#general',
        is_private: false,
        created_by: userId,
      })
      .select('id')
      .single();

    if (error) { console.warn('[Threads] ensureAgencyThread error:', error); return null; }
    return created?.id || null;
  } catch { return null; }
}

/**
 * Ensure a classroom has a linked thread. Creates if missing.
 */
export async function ensureClassroomThread(
  agencyId: string, classroomId: string, classroomName: string, userId: string
): Promise<string | null> {
  try {
    const { data: existing } = await cloudSupabase
      .from('threads')
      .select('id')
      .eq('agency_id', agencyId)
      .eq('thread_type', 'classroom')
      .eq('classroom_id', classroomId)
      .limit(1)
      .single();

    if (existing) return existing.id;

    const { data: created, error } = await cloudSupabase
      .from('threads')
      .insert({
        agency_id: agencyId,
        thread_type: 'classroom',
        title: `#${classroomName.toLowerCase().replace(/\s+/g, '-')}`,
        classroom_id: classroomId,
        is_private: false,
        created_by: userId,
      })
      .select('id')
      .single();

    if (error) { console.warn('[Threads] ensureClassroomThread error:', error); return null; }

    // Auto-add staff as members
    if (created) {
      const { data: staff } = await cloudSupabase
        .from('classroom_group_teachers')
        .select('user_id')
        .eq('group_id', classroomId);

      if (staff && staff.length > 0) {
        const members = staff.map(s => ({
          thread_id: created.id,
          user_id: s.user_id,
          role: 'member',
        }));
        await cloudSupabase.from('thread_members').insert(members);
      }

      // Post system message
      await cloudSupabase.from('thread_messages').insert({
        thread_id: created.id,
        sender_id: userId,
        body: `Classroom thread created for ${classroomName}`,
        message_type: 'system',
      });
    }

    return created?.id || null;
  } catch { return null; }
}

/**
 * Backfill: create threads for all classrooms that don't have one yet.
 */
export async function backfillClassroomThreads(agencyId: string, userId: string) {
  try {
    // Get all classrooms
    const { data: classrooms } = await cloudSupabase
      .from('classroom_groups')
      .select('group_id, name')
      .eq('agency_id', agencyId);

    if (!classrooms || classrooms.length === 0) return;

    // Get existing classroom threads
    const { data: existingThreads } = await cloudSupabase
      .from('threads')
      .select('classroom_id')
      .eq('agency_id', agencyId)
      .eq('thread_type', 'classroom');

    const existingIds = new Set((existingThreads || []).map(t => t.classroom_id));

    // Create missing threads
    for (const classroom of classrooms) {
      if (!existingIds.has(classroom.group_id)) {
        await ensureClassroomThread(agencyId, classroom.group_id, classroom.name, userId);
      }
    }
  } catch (e) { console.warn('[Threads] backfill error:', e); }
}

/**
 * Create a DM thread between two users.
 */
export async function createDMThread(agencyId: string, userId: string, otherUserId: string, otherName: string): Promise<string | null> {
  try {
    // Check if DM already exists between these two users
    const { data: myThreads } = await cloudSupabase
      .from('thread_members')
      .select('thread_id')
      .eq('user_id', userId);

    if (myThreads && myThreads.length > 0) {
      const threadIds = myThreads.map(t => t.thread_id);
      const { data: otherMemberships } = await cloudSupabase
        .from('thread_members')
        .select('thread_id')
        .eq('user_id', otherUserId)
        .in('thread_id', threadIds);

      if (otherMemberships && otherMemberships.length > 0) {
        // Check if any of these are DM threads
        const { data: dmThread } = await cloudSupabase
          .from('threads')
          .select('id')
          .eq('thread_type', 'dm')
          .in('id', otherMemberships.map(m => m.thread_id))
          .limit(1)
          .single();

        if (dmThread) return dmThread.id;
      }
    }

    const { data: created, error } = await cloudSupabase
      .from('threads')
      .insert({
        agency_id: agencyId,
        thread_type: 'dm',
        title: otherName,
        is_private: true,
        created_by: userId,
      })
      .select('id')
      .single();

    if (error || !created) return null;

    await cloudSupabase.from('thread_members').insert([
      { thread_id: created.id, user_id: userId, role: 'member' },
      { thread_id: created.id, user_id: otherUserId, role: 'member' },
    ]);

    return created.id;
  } catch { return null; }
}
