import { useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ArrowLeft,
  Clock3,
  FolderOpen,
  GitBranch,
  GitCommitHorizontal,
  Layers3,
  WalletCards,
} from 'lucide-react';
import {
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { useApi } from '../hooks/useApi.js';
import {
  basename,
  compactPath,
  formatCurrency,
  formatDate,
  formatDuration,
} from '../lib/format.js';
import { Badge } from '../components/ui/Badge.js';
import { DataPanel } from '../components/ui/DataPanel.js';
import {
  DataTable,
  DataTableBody,
  DataTableCell,
  DataTableContainer,
  DataTableHead,
  DataTableHeaderCell,
  DataTableRow,
} from '../components/ui/DataTable.js';
import { EmptyState } from '../components/ui/EmptyState.js';
import { ErrorState } from '../components/ui/ErrorState.js';
import { LoadingState } from '../components/ui/LoadingState.js';
import { MetricTile } from '../components/ui/MetricTile.js';
import { useI18n } from '../components/i18n/LanguageProvider.js';

const COLORS = ['#0a84ff', '#64d2ff', '#30d158', '#ff9f0a', '#ff453a', '#9a9898'];
const tooltipStyle = {
  background: 'var(--surface-elevated)',
  border: '1px solid var(--border)',
  borderRadius: 6,
  color: 'var(--foreground)',
  boxShadow: 'var(--shadow-card)',
  fontSize: 12,
};

interface ProjectDetailResponse {
  project: Record<string, unknown>;
  sessions: Record<string, unknown>[];
  providerBreakdown: Record<string, unknown>[];
  modelBreakdown: Record<string, unknown>[];
  spendOverTime: Record<string, unknown>[];
  commits: {
    branch: string | null;
    commits: { hash: string; author: string; date: string; message: string }[];
  };
}

export function ProjectDetailPage() {
  const { t } = useI18n();
  const { id } = useParams<{ id: string }>();
  const { data, loading, error, refetch } = useApi<ProjectDetailResponse>(`/api/projects/${id}`);

  const derived = useMemo(() => {
    const sessions = data?.sessions ?? [];
    const last = [...sessions].sort((a, b) =>
      String(b.started_at).localeCompare(String(a.started_at)),
    )[0];
    const topModel = (data?.modelBreakdown ?? [])[0]?.model as string | undefined;
    const topProvider = (data?.providerBreakdown ?? [])[0]?.provider as string | undefined;
    return { last, topModel: topModel ?? '—', topProvider: topProvider ?? '—' };
  }, [data]);

  if (loading) return <LoadingState />;
  if (error)
    return (
      <div className="p-6">
        <ErrorState
          title={t('project.failed')}
          message={error.message}
          code={error.code}
          details={error.details}
          onRetry={refetch}
        />
      </div>
    );
  if (!data?.project)
    return (
      <div className="p-6">
        <EmptyState
          title={t('project.notFound.title')}
          description={t('project.notFound.description')}
          icon={FolderOpen}
        />
      </div>
    );

  const p = data.project;
  const sessions = data.sessions;
  const spendData = data.spendOverTime.map((d) => ({ ...d, spend: Number(d.spend) || 0 }));
  const modelData = data.modelBreakdown.map((d) => ({
    name: String(d.model || 'unknown'),
    value: Number(d.cost) || 0,
  }));
  const providerData = data.providerBreakdown.map((d) => ({
    name: String(d.provider || 'unknown'),
    value: Number(d.cost) || 0,
  }));

  return (
    <div className="space-y-5 p-4 lg:p-6">
      <Link
        to="/projects"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> {t('project.back')}
      </Link>

      <DataPanel className="overflow-hidden" contentClassName="p-5">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-3">
              <div className="grid h-11 w-11 place-items-center rounded-md border border-accent/20 bg-accent-soft text-accent">
                <FolderOpen className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <h1 className="truncate font-mono text-2xl font-semibold tracking-[-0.05em] text-foreground">
                  {basename(String(p.path))}
                </h1>
                <p className="mt-1 truncate text-sm text-subtle-foreground">
                  {compactPath(String(p.path))}
                </p>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <Badge variant="success">{t('common.available')}</Badge>
              {p.git_remote ? (
                <Badge variant="neutral">
                  <GitBranch className="h-3 w-3" /> git
                </Badge>
              ) : (
                <Badge variant="warning">{t('projects.noRemote')}</Badge>
              )}
              {data.commits?.branch && <Badge variant="default">{data.commits.branch}</Badge>}
            </div>
          </div>
          <div className="grid min-w-[280px] grid-cols-2 gap-3">
            <HeroMetric label={t('common.sessions')} value={String(p.total_sessions)} />
            <HeroMetric
              label={t('project.totalCost')}
              value={formatCurrency(p.total_cost as number)}
            />
            <HeroMetric
              label={t('project.lastActivity')}
              value={derived.last?.started_at ? formatDate(String(derived.last.started_at)) : '—'}
            />
            <HeroMetric label={t('project.topModel')} value={derived.topModel} compact />
          </div>
        </div>
      </DataPanel>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MetricTile
          icon={WalletCards}
          label={t('project.avgCost')}
          value={formatCurrency((Number(p.total_cost) || 0) / (Number(p.total_sessions) || 1))}
          tone="info"
        />
        <MetricTile
          icon={Layers3}
          label={t('project.topProvider')}
          value={derived.topProvider}
          tone="info"
        />
        <MetricTile
          icon={Clock3}
          label={t('common.duration')}
          value={formatDuration(Number(derived.last?.duration_ms ?? 0))}
          tone="success"
        />
        <MetricTile
          icon={GitBranch}
          label={t('project.gitRemote')}
          value={String(p.git_remote ?? '—')}
          tone="warning"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <DataPanel title={t('project.spendOverTime')}>
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={spendData}>
              <CartesianGrid stroke="var(--border)" vertical={false} />
              <XAxis
                dataKey="day"
                tick={{ fontSize: 11, fill: 'var(--subtle-foreground)' }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                tick={{ fontSize: 11, fill: 'var(--subtle-foreground)' }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v: number) => `$${v.toFixed(0)}`}
              />
              <Tooltip
                contentStyle={tooltipStyle}
                formatter={(v: number) => [formatCurrency(v), t('common.cost')]}
              />
              <Area
                type="monotone"
                dataKey="spend"
                stroke="var(--accent)"
                fill="var(--accent-soft)"
                strokeWidth={2.4}
              />
            </AreaChart>
          </ResponsiveContainer>
        </DataPanel>

        <DistributionCard
          title={t('project.distribution')}
          data={modelData.length ? modelData : providerData}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
        <DataPanel title={t('project.recentSessions')} contentClassName="p-0">
          <DataTableContainer>
            <DataTable>
              <DataTableHead>
                <DataTableRow className="hover:bg-transparent">
                  <DataTableHeaderCell>{t('common.date')}</DataTableHeaderCell>
                  <DataTableHeaderCell>{t('common.model')}</DataTableHeaderCell>
                  <DataTableHeaderCell className="text-right">
                    {t('common.cost')}
                  </DataTableHeaderCell>
                  <DataTableHeaderCell className="text-right">
                    {t('common.duration')}
                  </DataTableHeaderCell>
                  <DataTableHeaderCell className="text-right">
                    {t('common.confidence')}
                  </DataTableHeaderCell>
                </DataTableRow>
              </DataTableHead>
              <DataTableBody>
                {sessions.map((s) => (
                  <SessionRow key={String(s.id)} session={s} />
                ))}
              </DataTableBody>
            </DataTable>
          </DataTableContainer>
        </DataPanel>

        <DataPanel
          title={t('project.gitTimeline')}
          action={data.commits?.branch && <Badge variant="neutral">{data.commits.branch}</Badge>}
          contentClassName="space-y-3"
        >
          {(data.commits?.commits ?? []).slice(0, 10).map((commit) => (
            <CommitRow key={commit.hash} commit={commit} />
          ))}
          {(data.commits?.commits.length ?? 0) === 0 && (
            <EmptyState
              title={t('project.noCommits.title')}
              description={t('project.noCommits.description')}
              icon={GitCommitHorizontal}
            />
          )}
        </DataPanel>
      </div>
    </div>
  );
}

function HeroMetric({
  label,
  value,
  compact,
}: {
  label: string;
  value: string;
  compact?: boolean;
}) {
  return (
    <div className="rounded-md border border-border bg-surface-muted p-3">
      <div className="font-mono text-[10px] uppercase tracking-[0.12em] text-subtle-foreground">
        {label}
      </div>
      <div
        className={`${compact ? 'truncate text-sm' : 'text-lg'} mt-1 font-mono font-semibold text-foreground`}
      >
        {value}
      </div>
    </div>
  );
}

function DistributionCard({
  title,
  data,
}: {
  title: string;
  data: { name: string; value: number }[];
}) {
  return (
    <DataPanel
      title={title}
      contentClassName="grid gap-4 md:grid-cols-[180px_minmax(0,1fr)] xl:grid-cols-1"
    >
      <ResponsiveContainer width="100%" height={180}>
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            cx="50%"
            cy="50%"
            outerRadius={78}
            innerRadius={48}
          >
            {data.map((_, i) => (
              <Cell key={i} fill={COLORS[i % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => [formatCurrency(v), '']} />
        </PieChart>
      </ResponsiveContainer>
      <div className="space-y-2 text-xs">
        {data.slice(0, 8).map((d, i) => (
          <div key={d.name} className="flex items-center gap-2">
            <div
              className="h-2.5 w-2.5 rounded-sm"
              style={{ background: COLORS[i % COLORS.length] }}
            />
            <span className="min-w-0 flex-1 truncate text-muted-foreground">{d.name}</span>
            <span className="font-mono font-medium text-foreground">{formatCurrency(d.value)}</span>
          </div>
        ))}
      </div>
    </DataPanel>
  );
}

function SessionRow({ session }: { session: Record<string, unknown> }) {
  const { t } = useI18n();
  return (
    <DataTableRow
      className="cursor-pointer border-b border-border transition-colors hover:bg-surface-hover"
      onClick={() => {
        window.location.href = `/sessions/${session.id}`;
      }}
    >
      <DataTableCell className="font-mono text-foreground">
        {formatDate(String(session.started_at))}
      </DataTableCell>
      <DataTableCell className="font-mono text-xs text-foreground">
        {String(session.model ?? '—')}
      </DataTableCell>
      <DataTableCell className="text-right font-mono tabular-nums text-foreground">
        <div>{formatCurrency(Number(session.total_cost_usd))}</div>
        {session.cost_source === 'estimated' && (
          <div className="mt-1 text-[10px] uppercase tracking-[0.12em] text-warning">
            {t('common.estimated')}
          </div>
        )}
      </DataTableCell>
      <DataTableCell className="text-right font-mono text-muted-foreground">
        {formatDuration(Number(session.duration_ms))}
      </DataTableCell>
      <DataTableCell className="text-right">
        <Badge
          variant={
            session.source_confidence === 'HIGH'
              ? 'success'
              : session.source_confidence === 'MEDIUM'
                ? 'default'
                : 'warning'
          }
        >
          {String(session.source_confidence)}
        </Badge>
      </DataTableCell>
    </DataTableRow>
  );
}

function CommitRow({
  commit,
}: {
  commit: { hash: string; author: string; date: string; message: string };
}) {
  return (
    <div className="flex items-start gap-3 rounded-lg border border-border bg-surface-muted p-3 text-sm">
      <div className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-md border border-accent/20 bg-accent-soft text-accent">
        <GitCommitHorizontal className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate font-mono text-sm font-medium text-foreground">
          {commit.message}
        </div>
        <div className="mt-1 font-mono text-xs text-subtle-foreground">
          {commit.hash} · {commit.author} · {formatDate(commit.date)}
        </div>
      </div>
    </div>
  );
}
