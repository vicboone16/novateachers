import { useEffect, useState, useCallback } from 'react';
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Users, Activity, FileText, ChevronDown, LogOut, Building2, Settings, GraduationCap, ClipboardList, Inbox, BookOpen, BarChart3, Bell, LayoutGrid, FileEdit, FileSearch } from 'lucide-react';
import { cn } from '@/lib/utils';
import { QuickAddPanel } from '@/components/QuickAddPanel';

const navItems = [
  { to: '/classroom', label: 'Classroom', icon: LayoutGrid },
  { to: '/students', label: 'Students', icon: Users },
  { to: '/collect', label: 'Collect', icon: ClipboardList },
  { to: '/tracker', label: 'Tracker', icon: Activity },
  { to: '/data-summary', label: 'Summary', icon: BarChart3 },
  { to: '/guide', label: 'Guide', icon: BookOpen },
  { to: '/inbox', label: 'Inbox', icon: Inbox },
];

export const AppLayout = () => {
  const { user, signOut } = useAuth();
  const { workspaces, currentWorkspace, setCurrentWorkspace, isSoloMode } = useWorkspace();
  const navigate = useNavigate();
  const [unreadCount, setUnreadCount] = useState(0);
  const [signalCount, setSignalCount] = useState(0);

  const loadUnread = useCallback(async () => {
    if (!user) return;
    try {
      // Query without parent_id filter — Core may not have this column
      const { count, error } = await supabase
        .from('teacher_messages')
        .select('id', { count: 'exact', head: true })
        .eq('recipient_id', user.id)
        .eq('is_read', false);
      if (!error && count !== null) setUnreadCount(count);
    } catch {
      // Silently handle if table doesn't exist
    }
  }, [user]);

  // ── Signal count — disabled until supervisor_signals table exists on Core ──
  const loadSignals = useCallback(async () => {
    // supervisor_signals table does not exist on Core yet; skip to avoid 404
    setSignalCount(0);
  }, []);

  useEffect(() => { loadUnread(); loadSignals(); }, [loadUnread, loadSignals]);

  // Realtime unread updates
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel('unread-badge')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'teacher_messages' }, () => {
        loadUnread();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, loadUnread]);

  // Realtime signal updates — disabled until supervisor_signals table exists on Core

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-border/60 bg-card/80 backdrop-blur-sm">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
          <div className="flex items-center gap-4">
            <h1 className="text-lg font-bold tracking-tight text-foreground font-heading">
              NovaTrack
            </h1>

            {/* Workspace Switcher */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="gap-1.5 text-sm text-muted-foreground">
                  {isSoloMode ? (
                    <GraduationCap className="h-3.5 w-3.5" />
                  ) : (
                    <Building2 className="h-3.5 w-3.5" />
                  )}
                  {currentWorkspace?.name || 'Select workspace'}
                  <ChevronDown className="h-3 w-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                {workspaces.map((ws) => (
                  <DropdownMenuItem
                    key={ws.id}
                    onClick={() => setCurrentWorkspace(ws)}
                    className={cn(ws.id === currentWorkspace?.id && 'bg-accent/20')}
                  >
                    {ws.mode === 'solo' ? (
                      <GraduationCap className="mr-2 h-3.5 w-3.5" />
                    ) : (
                      <Building2 className="mr-2 h-3.5 w-3.5" />
                    )}
                    {ws.name}
                    <span className="ml-2 text-xs text-muted-foreground">
                      {ws.mode === 'solo' ? 'Independent' : 'Connected'}
                    </span>
                  </DropdownMenuItem>
                ))}
                {workspaces.length > 1 && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => navigate('/workspace')}>
                      <Building2 className="mr-2 h-3.5 w-3.5" />
                      All Workspaces
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <div className="flex items-center gap-1">
            {/* Signal notification bell */}
            <Button
              variant="ghost"
              size="icon"
              className="relative text-muted-foreground"
              title="Signals sent"
            >
              <Bell className="h-4 w-4" />
              {signalCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive text-[9px] font-bold text-destructive-foreground px-0.5 animate-pulse">
                  {signalCount > 9 ? '9+' : signalCount}
                </span>
              )}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate('/settings')}
              title="Settings"
              className="text-muted-foreground"
            >
              <Settings className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={signOut} title="Sign out" className="text-muted-foreground">
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      {/* Tab Navigation */}
      <nav className="border-b border-border/40 bg-card/40">
        <div className="mx-auto flex max-w-6xl gap-0 px-4 overflow-x-auto">
          {navItems.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-medium transition-colors whitespace-nowrap',
                  isActive
                    ? 'border-primary text-primary'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                )
              }
            >
              <Icon className="h-4 w-4" />
              {label}
              {to === '/inbox' && unreadCount > 0 && (
                <span className="ml-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground px-1">
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </NavLink>
          ))}

          {/* IEP dropdown */}
          <IEPNavDropdown />
        </div>
      </nav>

      {/* Main Content */}
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 pb-24">
        <Outlet />
      </main>

      {/* Quick Add Panel */}
      <QuickAddPanel />
    </div>
  );
};

/* ── IEP Nav Dropdown ── */
function IEPNavDropdown() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const isActive = pathname === '/iep' || pathname === '/iep-reader';

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className={cn(
            'flex items-center gap-1.5 border-b-2 px-4 py-3 text-sm font-medium transition-colors whitespace-nowrap',
            isActive
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          )}
        >
          <FileText className="h-4 w-4" />
          IEP
          <ChevronDown className="h-3 w-3" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        <DropdownMenuItem onClick={() => navigate('/iep')} className="gap-2">
          <FileEdit className="h-3.5 w-3.5" />
          IEP Writer
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => navigate('/iep-reader')} className="gap-2">
          <FileSearch className="h-3.5 w-3.5" />
          IEP Reader
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
