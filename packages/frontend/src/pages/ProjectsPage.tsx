import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight, FolderOpen, GitBranch, Search, SlidersHorizontal } from 'lucide-react';
import { Badge } from '../components/ui/Badge.js';
import { Card, CardContent } from '../components/ui/Card.js';
import { Input } from '../components/ui/Input.js';
import { Select } from '../components/ui/Select.js';
import { ErrorState } from '../components/ui/ErrorState.js';
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
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<StatusFilter>('all');
  const [sort, setSort] = useState<SortMode>('cost');
  const { data, loading, error, refetch } = useApi<{ data: Project[] }>('/api/projects');

  if (error) {
    return (
      <div className="p-6">
        <ErrorState title="Projects failed to load" message={error.message} code={error.code} details={error.details} onRetry={refetch} />
      </div>
    );
  }

  const projects = useMemo(() => {
    const term = search.trim().toLowerCase();
    return [...(data?.data ?? [])]
      .filter((project) => {
        const matchesSearch = !term || project.path.toLowerCase().includes(term) || basename(project.path).toLowerCase().includes(term);
        const matchesStatus = status === 'all' || (status === 'available' ? project.exists : !project.exists);
        return matchesSearch && matchesStatus;
      })
      .sort((a, b) => {
        if (sort === 'sessions') return b.total_sessions - a.total_sessions;
        if (sort === 'name') return basename(a.path).localeCompare(basename(b.path));
        return b.total_cost - a.total_cost;
      });
  }, [data, search, sort, status]);

  return (
    <div className="space-y-5 p-6">
      <Card>
        <CardContent className="flex flex-col gap-3 p-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="relative max-w-lg flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle-foreground" />
            <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search projects by name or path" className="pl-9" />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Select
              value={status}
              onChange={(event) => setStatus(event.target.value as StatusFilter)}
              options={[{ label: 'All statuses', value: 'all' }, { label: 'Available', value: 'available' }, { label: 'Missing', value: 'missing' }]}
            />
            <Select
              value={sort}
              onChange={(event) => setSort(event.target.value as SortMode)}
              options={[{ label: 'Sort by cost', value: 'cost' }, { label: 'Sort by sessions', value: 'sessions' }, { label: 'Sort by name', value: 'name' }]}
            />
            <div className="hidden items-center gap-2 rounded-xl border border-border px-3 py-2 text-sm text-muted-foreground md:flex">
              <SlidersHorizontal className="h-4 w-4" />
              {projects.length} shown
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {loading ? Array.from({ length: 9 }).map((_, index) => <ProjectSkeleton key={index} />) : projects.map((project) => (
          <Link key={project.id} to={`/projects/${project.id}`}>
            <Card interactive className="h-full overflow-hidden">
              <CardContent className="space-y-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className={`grid h-11 w-11 place-items-center rounded-2xl ring-1 ${project.exists ? 'bg-accent-soft text-accent ring-accent/15' : 'bg-warning-soft text-warning ring-warning/15'}`}>
                      <FolderOpen className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <div className="truncate font-semibold tracking-[-0.02em] text-foreground">{basename(project.path)}</div>
                      <div className="truncate text-xs text-subtle-foreground">{compactPath(project.path)}</div>
                    </div>
                  </div>
                  <ArrowUpRight className="h-4 w-4 shrink-0 text-subtle-foreground" />
                </div>

                <div className="flex items-center gap-2">
                  <Badge variant={project.exists ? 'success' : 'warning'}>{project.exists ? 'Available' : 'Missing'}</Badge>
                  {project.git_remote && <Badge variant="neutral">git</Badge>}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-2xl border border-border bg-surface-muted p-3">
                    <div className="text-[11px] uppercase tracking-[0.12em] text-subtle-foreground">Sessions</div>
                    <div className="mt-1 text-2xl font-semibold tracking-[-0.05em] text-foreground">{project.total_sessions}</div>
                  </div>
                  <div className="rounded-2xl border border-border bg-surface-muted p-3">
                    <div className="text-[11px] uppercase tracking-[0.12em] text-subtle-foreground">Cost</div>
                    <div className="mt-1 text-2xl font-semibold tracking-[-0.05em] text-foreground">{formatCurrency(project.total_cost)}</div>
                  </div>
                </div>

                {project.git_remote ? (
                  <div className="flex items-center gap-2 rounded-xl border border-border bg-surface-muted px-3 py-2 text-xs text-muted-foreground">
                    <GitBranch className="h-3.5 w-3.5" />
                    <span className="truncate">{project.git_remote}</span>
                  </div>
                ) : (
                  <div className="rounded-xl border border-dashed border-border px-3 py-2 text-xs text-subtle-foreground">No git remote detected</div>
                )}
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {!loading && projects.length === 0 && (
        <Card>
          <CardContent className="py-16 text-center">
            <FolderOpen className="mx-auto mb-3 h-10 w-10 text-subtle-foreground" />
            <div className="font-medium text-foreground">No projects found</div>
            <div className="mt-1 text-sm text-muted-foreground">Try adjusting search or filters.</div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function ProjectSkeleton() {
  return <Card><CardContent><div className="h-40 animate-pulse rounded-2xl bg-surface-muted" /></CardContent></Card>;
}
