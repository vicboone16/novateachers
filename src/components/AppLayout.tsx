import { useState } from 'react';
import { Outlet, NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Users, Activity, FileText, ChevronDown, LogOut, Building2 } from 'lucide-react';
import { cn } from '@/lib/utils';

const navItems = [
  { to: '/students', label: 'Students', icon: Users },
  { to: '/tracker', label: 'Trigger Tracker', icon: Activity },
  { to: '/iep', label: 'IEP Writer', icon: FileText },
];

export const AppLayout = () => {
  const { user, signOut } = useAuth();
  const { workspaces, currentWorkspace, setCurrentWorkspace, isSoloMode } = useWorkspace();
  const location = useLocation();

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-border/60 bg-card/80 backdrop-blur-sm">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
          <div className="flex items-center gap-6">
            <h1
              className="text-lg font-bold tracking-tight text-foreground"
              style={{ fontFamily: "'Space Grotesk', sans-serif" }}
            >
              NovaTrack
            </h1>

            {/* Workspace Switcher */}
            {workspaces.length > 1 && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="gap-1.5 text-sm text-muted-foreground">
                    <Building2 className="h-3.5 w-3.5" />
                    {currentWorkspace?.name || 'Select workspace'}
                    <ChevronDown className="h-3 w-3" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  {workspaces.map((ws) => (
                    <DropdownMenuItem
                      key={ws.id}
                      onClick={() => setCurrentWorkspace(ws)}
                      className={cn(ws.id === currentWorkspace?.id && 'bg-accent')}
                    >
                      <Building2 className="mr-2 h-3.5 w-3.5" />
                      {ws.name}
                      <span className="ml-2 text-xs text-muted-foreground">
                        {ws.mode === 'solo' ? 'Solo' : 'Connected'}
                      </span>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            )}

            {workspaces.length <= 1 && currentWorkspace && (
              <span className="text-sm text-muted-foreground">{currentWorkspace.name}</span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">{user?.email}</span>
            <Button variant="ghost" size="icon" onClick={signOut} title="Sign out">
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      {/* Tab Navigation */}
      <nav className="border-b border-border/40 bg-card/40">
        <div className="mx-auto flex max-w-6xl gap-0 px-4">
          {navItems.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-medium transition-colors',
                  isActive
                    ? 'border-primary text-primary'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                )
              }
            >
              <Icon className="h-4 w-4" />
              {label}
            </NavLink>
          ))}
        </div>
      </nav>

      {/* Main Content */}
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
};
