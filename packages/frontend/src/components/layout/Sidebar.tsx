import { NavLink } from 'react-router-dom';
import {
  Activity,
  BarChart3,
  CircleDot,
  History,
  FolderOpen,
  LayoutDashboard,
  MessageSquare,
  Moon,
  PackageOpen,
  Settings,
  Sun,
  Github,
  type LucideIcon,
} from 'lucide-react';
import { useI18n } from '../i18n/LanguageProvider.js';
import { useTheme } from '../theme/ThemeProvider.js';
import { useApi } from '../../hooks/useApi.js';
import { cn } from '../../lib/utils.js';
import type { IntegrationStatusItem } from './IntegrationStatus.js';
import { BrandMark, getBrandMeta } from '../brand/BrandMark.js';

const NAV_ITEMS: {
  to: string;
  labelKey: 'nav.dashboard' | 'nav.sessions' | 'nav.projects' | 'nav.models' | 'nav.analytics';
  icon: LucideIcon;
}[] = [
  { to: '/', labelKey: 'nav.dashboard', icon: LayoutDashboard },
  { to: '/sessions', labelKey: 'nav.sessions', icon: MessageSquare },
  { to: '/projects', labelKey: 'nav.projects', icon: FolderOpen },
  { to: '/models', labelKey: 'nav.models', icon: PackageOpen },
  { to: '/analytics', labelKey: 'nav.analytics', icon: BarChart3 },
];

export function Sidebar() {
  const { t } = useI18n();
  const { theme, toggleTheme } = useTheme();
  const { data } = useApi<{ integrations: IntegrationStatusItem[] }>('/api/integrations/status', {
    initialData: { integrations: [] },
  });

  const integrations = (data?.integrations ?? [])
    .filter((item) => item.status === 'available')
    .map((item) => ({ ...item, label: getBrandMeta(item.cli, 'cli').label }));

  return (
    <aside className="hidden h-full w-[244px] shrink-0 flex-col border-r border-border bg-surface lg:flex">
      <div className="flex h-16 items-center gap-3 border-b border-border px-4">
        <div className="grid h-9 w-9 place-items-center rounded-md border border-accent/25 bg-accent-soft text-accent">
          <Activity className="h-5 w-5" />
        </div>
        <div>
          <div className="font-mono text-sm font-semibold tracking-[-0.02em] text-foreground">
            Sessionless
          </div>
          <div className="font-mono text-[10px] uppercase tracking-[0.12em] text-subtle-foreground">
            local AI usage
          </div>
        </div>
      </div>

      <nav className="space-y-1 px-3 py-4">
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            className={({ isActive }) =>
              cn(
                'group relative flex h-9 items-center gap-3 rounded-md border px-3 font-mono text-sm transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/25',
                isActive
                  ? 'border-transparent bg-surface-hover text-foreground'
                  : 'border-transparent text-muted-foreground hover:border-border hover:bg-surface-hover hover:text-foreground',
              )
            }
          >
            {({ isActive }) => (
              <>
                <span
                  className={cn(
                    'absolute left-1.5 top-1/2 h-5 w-[2px] -translate-y-1/2 rounded-full bg-transparent transition-colors',
                    isActive && 'bg-accent',
                  )}
                />
                <item.icon
                  className={cn('h-4 w-4 shrink-0 transition-colors', isActive && 'text-accent')}
                />
                <span className={cn('transition-colors', isActive && 'text-foreground')}>
                  {t(item.labelKey)}
                </span>
              </>
            )}
          </NavLink>
        ))}
      </nav>

      <div className="mt-3 px-4">
        <div className="mb-3 font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-subtle-foreground">
          Integrations
        </div>
        <div className="space-y-1">
          {integrations.map((item) => (
            <div
              key={item.label}
              className="flex h-9 items-center justify-between rounded-md border border-transparent px-2 font-mono text-xs text-muted-foreground transition-colors hover:border-border hover:bg-surface-hover hover:text-foreground"
            >
              <div className="flex items-center gap-2.5">
                <BrandMark value={item.cli} size="sm" />
                <span>{item.label}</span>
              </div>
              <CircleDot
                className={cn(
                  'h-3 w-3',
                  item.status === 'available'
                    ? 'fill-success text-success'
                    : 'fill-muted-foreground text-muted-foreground',
                )}
              />
            </div>
          ))}
        </div>
      </div>

      <div className="mt-auto p-3">
        <div className="grid grid-cols-4 gap-1 rounded-lg border border-border bg-surface-muted p-1">
          <NavLink
            to="/settings"
            className="grid h-8 place-items-center rounded-md border border-transparent text-muted-foreground transition-colors hover:border-border hover:bg-surface-hover hover:text-foreground"
            aria-label="Settings"
          >
            <Settings className="h-4 w-4" />
          </NavLink>
          <button
            type="button"
            onClick={toggleTheme}
            className="grid h-8 place-items-center rounded-md border border-transparent text-muted-foreground transition-colors hover:border-border hover:bg-surface-hover hover:text-foreground"
            aria-label={theme === 'dark' ? 'Light mode' : 'Dark mode'}
          >
            {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>
          <NavLink
            to="/changelog"
            className="grid h-8 place-items-center rounded-md border border-transparent text-muted-foreground transition-colors hover:border-border hover:bg-surface-hover hover:text-foreground"
            aria-label="Changelog"
          >
            <History className="h-4 w-4" />
          </NavLink>
          <a
            href="https://github.com/melloxyz/sessionless"
            target="_blank"
            rel="noreferrer"
            className="grid h-8 place-items-center rounded-md border border-transparent text-muted-foreground transition-colors hover:border-border hover:bg-surface-hover hover:text-foreground"
            aria-label="GitHub"
          >
            <Github className="h-4 w-4" />
          </a>
        </div>
      </div>
    </aside>
  );
}

export function MobileNavigation() {
  const { t } = useI18n();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-surface lg:hidden pb-[env(safe-area-inset-bottom)]">
      <div className="grid grid-cols-5 gap-1 p-2">
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            className={({ isActive }) =>
              cn(
                'flex h-12 flex-col items-center justify-center gap-1 rounded-md border font-mono text-[10px] transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/25',
                isActive
                  ? 'border-transparent bg-surface-hover text-foreground'
                  : 'border-transparent text-muted-foreground hover:border-border hover:bg-surface-hover hover:text-foreground',
              )
            }
          >
            <item.icon className="h-4 w-4 shrink-0" />
            <span className="truncate">{t(item.labelKey)}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
