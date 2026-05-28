import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowUpRight,
  FolderOpen,
  GitBranch,
  HardDrive,
  Search,
  SlidersHorizontal,
  Trash2,
} from 'lucide-react';
import { Badge } from '../components/ui/Badge.js';
import { Button } from '../components/ui/Button.js';
import { Card, CardContent } from '../components/ui/Card.js';
import { FilterBar } from '../components/ui/FilterBar.js';
import { Input } from '../components/ui/Input.js';
import { MetricTile } from '../components/ui/MetricTile.js';
import { Select } from '../components/ui/Select.js';
import { SectionHeader } from '../components/ui/SectionHeader.js';
import { ErrorState } from '../components/ui/ErrorState.js';
import { EmptyState } from '../components/ui/EmptyState.js';
import { useI18n } from '../components/i18n/LanguageProvider.js';
import { useApi } from '../hooks/useApi.js';
import { basename, compactPath, formatCurrency } from '../lib/format.js';

interface Project {
  id: number;
  path: string;
  git_remote: string | null;
  total_sessions: number;
  total_cost: number;
  exists: boolean;
}

type StatusFilter = 'all' | 'available' | 'missing';
type SortMode = 'cost' | 'sessions' | 'name';

export function ProjectsPage() {
  const { t } = useI18n();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<StatusFilter>('all');
  const [sort, setSort] = useState<SortMode>('cost');
  const [hidingId, setHidingId] = useState<number | null>(null);
  const { data, loading, error, refetch } = useApi<{ data: Project[] }>('/api/projects');

  const allProjects = data?.data ?? [];
  const projects = useMemo(() => {
    const term = search.trim().toLowerCase();
    return [...allProjects]
      .filter((project) => {
        const matchesSearch =
          !term ||
          project.path.toLowerCase().includes(term) ||
          basename(project.path).toLowerCase().includes(term);
        const matchesStatus =
          status === 'all' || (status === 'available' ? project.exists : !project.exists);
        return matchesSearch && matchesStatus;
      })
      .sort((a, b) => {
        if (sort === 'sessions') return b.total_sessions - a.total_sessions;
        if (sort === 'name') return basename(a.path).localeCompare(basename(b.path));
        return b.total_cost - a.total_cost;
      });
  }, [allProjects, search, sort, status]);

  const summary = useMemo(
    () => ({
      visible: projects.length,
      available: projects.filter((project) => project.exists).length,
      missing: projects.filter((project) => !project.exists).length,
      spend: projects.reduce((sum, project) => sum + Number(project.total_cost || 0), 0),
      maxCost: Math.max(1, ...projects.map((project) => Number(project.total_cost || 0))),
    }),
    [projects],
  );

  const topProjects = projects
    .filter((project) => project.total_cost > 0 || project.total_sessions > 0)
    .slice(0, 3);

  async function hideProject(id: number) {
    setHidingId(id);
    try {
      await fetch(`/api/projects/${id}`, { method: 'DELETE' });
      await refetch();
    } finally {
      setHidingId(null);
    }
  }

  if (error) {
    return (
      <div className="p-6">
        <ErrorState
          title={t('projects.failed')}
          message={error.message}
          code={error.code}
          details={error.details}
          onRetry={refetch}
        />
      </div>
    );
  }

  return (
    <div className="space-y-5 p-4 lg:p-6">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricTile
          icon={FolderOpen}
          label={t('projects.summary.visible')}
          value={String(summary.visible)}
          tone="info"
        />
        <MetricTile
          icon={HardDrive}
          label={t('projects.summary.available')}
          value={String(summary.available)}
          tone="success"
        />
        <MetricTile
          icon={HardDrive}
          label={t('projects.summary.missing')}
          value={String(summary.missing)}
          tone="warning"
        />
        <MetricTile
          icon={SlidersHorizontal}
          label={t('projects.summary.spend')}
          value={formatCurrency(summary.spend)}
          tone="info"
        />
      </div>

      <FilterBar
        actions={
          <>
            <Select
              value={status}
              onChange={(event) => setStatus(event.target.value as StatusFilter)}
              options={[
                { label: t('projects.allStatuses'), value: 'all' },
                { label: t('common.available'), value: 'available' },
                { label: t('common.missing'), value: 'missing' },
              ]}
            />
            <Select
              value={sort}
              onChange={(event) => setSort(event.target.value as SortMode)}
              options={[
                { label: t('projects.sortCost'), value: 'cost' },
                { label: t('projects.sortSessions'), value: 'sessions' },
                { label: t('projects.sortName'), value: 'name' },
              ]}
            />
            <div className="hidden items-center gap-2 rounded-md border border-border px-3 py-2 font-mono text-xs text-muted-foreground md:flex">
              <SlidersHorizontal className="h-4 w-4" />
              {projects.length} {t('projects.shown')}
            </div>
          </>
        }
      >
        <div className="relative max-w-xl flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle-foreground" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={t('projects.search.placeholder')}
            className="pl-9"
          />
        </div>
      </FilterBar>

      {topProjects.length > 0 && (
        <section className="space-y-3">
          <SectionHeader
            title={t('projects.top.title')}
            description={t('projects.top.description')}
          />
          <div className="grid gap-4 lg:grid-cols-3">
            {topProjects.map((project, index) => (
              <ProjectCard
                key={project.id}
                project={project}
                rank={index + 1}
                maxCost={summary.maxCost}
                onHide={hideProject}
                hiding={hidingId === project.id}
                featured
              />
            ))}
          </div>
        </section>
      )}

      <section className="space-y-3">
        <SectionHeader
          title={t('projects.all.title')}
          description={t('projects.all.description')}
        />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {loading
            ? Array.from({ length: 9 }).map((_, index) => <ProjectSkeleton key={index} />)
            : projects.map((project) => (
                <ProjectCard
                  key={project.id}
                  project={project}
                  maxCost={summary.maxCost}
                  onHide={hideProject}
                  hiding={hidingId === project.id}
                />
              ))}
        </div>
      </section>

      {!loading && projects.length === 0 && (
        <EmptyState
          title={t('projects.empty.title')}
          description={t('projects.empty.description')}
          icon={FolderOpen}
        />
      )}
    </div>
  );
}

function ProjectCard({
  project,
  maxCost,
  onHide,
  hiding,
  featured,
  rank,
}: {
  project: Project;
  maxCost: number;
  onHide: (id: number) => void;
  hiding: boolean;
  featured?: boolean;
  rank?: number;
}) {
  const { t } = useI18n();
  const percent = Math.min(100, Math.round((Number(project.total_cost || 0) / maxCost) * 100));
  return (
    <Card interactive className="h-full overflow-hidden">
      <CardContent className="space-y-5">
        <div className="flex items-start justify-between gap-4">
          <Link to={`/projects/${project.id}`} className="flex min-w-0 flex-1 items-center gap-3">
            <div
              className={`grid h-11 w-11 shrink-0 place-items-center rounded-md border ${project.exists ? 'border-accent/20 bg-accent-soft text-accent' : 'border-warning/20 bg-warning-soft text-warning'}`}
            >
              {featured && rank ? (
                <span className="font-mono text-sm font-semibold">#{rank}</span>
              ) : (
                <FolderOpen className="h-5 w-5" />
              )}
            </div>
            <div className="min-w-0">
              <div className="truncate font-mono text-sm font-semibold tracking-[-0.02em] text-foreground">
                {basename(project.path)}
              </div>
              <div className="truncate text-xs text-subtle-foreground">
                {compactPath(project.path)}
              </div>
            </div>
          </Link>
          <div className="flex shrink-0 items-center gap-1">
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={t('projects.hide')}
              title={t('projects.hide.help')}
              disabled={hiding}
              onClick={() => onHide(project.id)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
            <Link
              to={`/projects/${project.id}`}
              className="rounded-md border border-transparent p-2 text-subtle-foreground transition-colors hover:border-border hover:bg-surface-hover hover:text-foreground"
            >
              <ArrowUpRight className="h-4 w-4" />
            </Link>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={project.exists ? 'success' : 'warning'}>
            {project.exists ? t('common.available') : t('common.missing')}
          </Badge>
          {project.git_remote && (
            <Badge variant="neutral">
              <GitBranch className="h-3 w-3" /> git
            </Badge>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Metric label={t('common.sessions')} value={String(project.total_sessions)} />
          <Metric label={t('common.cost')} value={formatCurrency(project.total_cost)} />
        </div>

        <div className="space-y-2">
          <div className="flex justify-between text-[11px] text-subtle-foreground">
            <span>{t('common.cost')}</span>
            <span>{percent}%</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded bg-surface-muted">
            <div className="h-full rounded bg-accent" style={{ width: `${percent}%` }} />
          </div>
        </div>

        {project.git_remote ? (
          <div className="flex items-center gap-2 rounded-md border border-border bg-surface-muted px-3 py-2 font-mono text-xs text-muted-foreground">
            <GitBranch className="h-3.5 w-3.5" />
            <span className="truncate">{project.git_remote}</span>
          </div>
        ) : (
          <div className="rounded-md border border-dashed border-border px-3 py-2 font-mono text-xs text-subtle-foreground">
            {t('projects.noRemote')}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border bg-surface-muted p-3">
      <div className="font-mono text-[10px] uppercase tracking-[0.12em] text-subtle-foreground">
        {label}
      </div>
      <div className="mt-1 truncate font-mono text-lg font-semibold tracking-[-0.04em] text-foreground">
        {value}
      </div>
    </div>
  );
}

function ProjectSkeleton() {
  return (
    <Card>
      <CardContent>
        <div className="h-52 animate-pulse rounded-lg border border-border bg-surface-muted" />
      </CardContent>
    </Card>
  );
}
