import { invokeCloudFunction } from '@/lib/cloud-functions';

export interface CoreBridgeEvent {
  event_id: string;
  student_id: string;
  event_type: string;
  event_subtype: string | null;
  event_value: Record<string, any> | null;
  recorded_at: string;
  source_module: string | null;
}

export interface CoreBridgeMessage {
  id: string;
  agency_id: string;
  thread_id: string;
  parent_id: string | null;
  sender_id: string;
  recipient_id: string;
  message_type: string;
  subject: string | null;
  body: string;
  metadata: Record<string, any>;
  is_read: boolean;
  read_at: string | null;
  reviewed_at: string | null;
  reviewed_by?: string | null;
  status: string;
  client_id: string | null;
  created_at: string;
}

export async function listRecentClassroomEvents(params: {
  userId: string;
  agencyId?: string;
  studentIds?: string[];
  limit?: number;
}) {
  return invokeCloudFunction<{ events: CoreBridgeEvent[] }>('core-bridge', {
    action: 'list_recent_classroom_events',
    user_id: params.userId,
    agency_id: params.agencyId,
    student_ids: params.studentIds || [],
    limit: params.limit || 20,
  });
}

export async function seedTeacherEvents(params: {
  studentId: string;
  userId: string;
  agencyId: string;
  behavior?: string;
}) {
  return invokeCloudFunction('core-bridge', {
    action: 'seed_teacher_events',
    student_id: params.studentId,
    user_id: params.userId,
    agency_id: params.agencyId,
    behavior: params.behavior || 'Aggression',
  });
}

export async function countUnreadMessages(userId: string) {
  return invokeCloudFunction<{ count: number }>('core-bridge', {
    action: 'count_unread_messages',
    user_id: userId,
  });
}

export async function listMessages(userId: string, tab: 'inbox' | 'sent') {
  return invokeCloudFunction<{ messages: CoreBridgeMessage[] }>('core-bridge', {
    action: 'list_messages',
    user_id: userId,
    tab,
  });
}

export async function listThread(threadId: string) {
  return invokeCloudFunction<{ messages: CoreBridgeMessage[] }>('core-bridge', {
    action: 'list_thread',
    thread_id: threadId,
  });
}

export async function markMessagesRead(messageIds: string[]) {
  return invokeCloudFunction('core-bridge', {
    action: 'mark_messages_read',
    message_ids: messageIds,
  });
}

export async function updateMessageStatus(params: { messageId: string; status: string; reviewedBy?: string }) {
  return invokeCloudFunction('core-bridge', {
    action: 'update_message_status',
    message_id: params.messageId,
    status: params.status,
    reviewed_by: params.reviewedBy,
  });
}

export async function listRecipients(params: { agencyId: string; excludeUserId: string }) {
  return invokeCloudFunction<{ user_ids: string[] }>('core-bridge', {
    action: 'list_recipients',
    agency_id: params.agencyId,
    exclude_user_id: params.excludeUserId,
  });
}

export async function sendMessageViaBridge(params: {
  agencyId: string;
  senderId: string;
  recipientId: string;
  messageType: string;
  subject?: string | null;
  body: string;
  metadata?: Record<string, any>;
  threadId?: string;
  parentId?: string;
}) {
  return invokeCloudFunction<{ id: string }>('core-bridge', {
    action: 'send_message',
    agency_id: params.agencyId,
    sender_id: params.senderId,
    recipient_id: params.recipientId,
    message_type: params.messageType,
    subject: params.subject ?? null,
    body: params.body,
    metadata: params.metadata,
    thread_id: params.threadId,
    parent_id: params.parentId,
  });
}
