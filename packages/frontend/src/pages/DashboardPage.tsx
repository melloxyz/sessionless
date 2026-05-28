import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowUpRight,
  Coins,
  Database,
  MessageSquare,
  MoreHorizontal,
  Timer,
  WalletCards,
} from 'lucide-react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { StatCard } from '../components/StatCard.js';
import { BrandBadge, BrandMark, getBrandMeta } from '../components/brand/BrandMark.js';
import { Badge } from '../components/ui/Badge.js';
import { Button } from '../components/ui/Button.js';
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
import { TokenUsageBar } from '../components/session/TokenUsageBar.js';
import { EmptyState } from '../components/ui/EmptyState.js';
import { ErrorState } from '../components/ui/ErrorState.js';
import { useDateRange } from '../components/filters/DateRangeProvider.js';
import { useI18n } from '../components/i18n/LanguageProvider.js';
import { useApi } from '../hooks/useApi.js';
import { CLI_COLORS, chartColor } from '../lib/chart-colors.js';
import {
  basename,
  compactPath,
  formatCurrency,
  formatDate,
  formatDuration,
  formatRelativeTime,
  formatTokens,
} from '../lib/format.js';

interface Overview {
  todaySpend: number;
  weeklySpend: number;
  monthlySpend: number;
  totalSpend: number;
  sessionCount: number;
  averageSessionCost: number;
  mostUsedCli: string | null;
}

interface SessionRow {
  id: number;
  cli: string;
  provider: string;
  model: string | null;
  project_path: string | null;
  started_at: string;
  ended_at: string | null;
  duration_ms: number | null;
  total_cost_usd: number | null;
  cost_source: 'actual' | 'estimated' | 'unknown';
  source_confidence: string;
  message_count: number;
  tool_call_count: number;
  session_id: string;
}

interface SessionDetail extends SessionRow {
  usageEvents: {
    input_tokens: number;
    output_tokens: number;
    cache_read_tokens: number;
    cache_write_tokens: number;
    reasoning_tokens: number;
    tool_calls_count: number;
  }[];
  messages: { id: number; role: string; content: string; timestamp: string }[];
}

const tooltipStyle = {
  background: 'var(--surface-elevated)',
  border: '1px solid var(--border)',
  borderRadius: 6,
  color: 'var(--foreground)',
  boxShadow: 'none',
  fontSize: 12,
};

export function DashboardPage() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const { queryString } = useDateRange();
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const queryPrefix = queryString ? `?${queryString}` : '';
  const querySuffix = queryString ? `&${queryString}` : '';
  const {
    data: overview,
    loading: overviewLoading,
    error: overviewError,
  } = useApi<Overview>(`/api/overview${queryPrefix}`);
  const { data: spendData, error: spendError } = useApi<{
    points: { date: string; spend: number; tokens: number; sessions: number }[];
  }>(`/api/analytics/spend-over-time${queryPrefix}`);
  const { data: tokenData, error: tokenError } = useApi<{
    points: {
      date: string;
      inputTokens: number;
      outputTokens: number;
      cacheReadTokens?: number;
      cacheWriteTokens?: number;
    }[];
  }>(`/api/analytics/tokens-over-time${queryPrefix}`);
  const { data: cliBreakdown, error: cliError } = useApi<{
    breakdown: { label: string; value: number; percentage: number }[];
  }>(`/api/analytics/breakdown?dimension=cli&metric=cost${querySuffix}`);
  const { data: modelBreakdown, error: modelError } = useApi<{
    breakdown: { label: string; value: number; percentage: number }[];
  }>(`/api/analytics/breakdown?dimension=model&metric=cost${querySuffix}`);
  const { data: recentSessions, error: recentSessionsError } = useApi<{
    data: SessionRow[];
    total: number;
  }>(`/api/sessions?limit=9&sortBy=started_at&sortOrder=desc${querySuffix}`);
  const { data: allSessions, error: allSessionsError } = useApi<{
    data: SessionRow[];
    total: number;
  }>(`/api/sessions?limit=500&sortBy=started_at&sortOrder=desc${querySuffix}`);
  const { data: selectedSession, error: selectedSessionError } = useApi<SessionDetail>(
    selectedId ? `/api/sessions/${selectedId}` : null,
    { immediate: Boolean(selectedId) },
  );

  useEffect(() => {
    if (!selectedId && recentSessions?.data?.[0]) setSelectedId(recentSessions.data[0].id);
  }, [recentSessions, selectedId]);

  const spendPoints = spendData?.points ?? [];
  const tokenPoints = tokenData?.points ?? [];
  const cliData = (cliBreakdown?.breakdown ?? []).filter((item) => item.value > 0);
  const modelData = (modelBreakdown?.breakdown ?? []).filter((item) => item.value > 0).slice(0, 5);
  const totalTokens = tokenPoints.reduce(
    (sum, point) => sum + point.inputTokens + point.outputTokens,
    0,
  );
  const totalDurationMs = (allSessions?.data ?? []).reduce(
    (sum, session) => sum + (session.duration_ms ?? 0),
    0,
  );
  const totalMessages = (allSessions?.data ?? []).reduce(
    (sum, session) => sum + (session.message_count ?? 0),
    0,
  );

  const selectedUsage = useMemo(() => {
    const events = selectedSession?.usageEvents ?? [];
    return events.reduce(
      (acc, item) => ({
        input: acc.input + (item.input_tokens ?? 0),
        output: acc.output + (item.output_tokens ?? 0),
        cacheRead: acc.cacheRead + (item.cache_read_tokens ?? 0),
        cacheWrite: acc.cacheWrite + (item.cache_write_tokens ?? 0),
      }),
      { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
    );
  }, [selectedSession]);

  const anyError =
    overviewError ||
    spendError ||
    tokenError ||
    cliError ||
    modelError ||
    recentSessionsError ||
    allSessionsError ||
    selectedSessionError;

  return (
    <div className="grid min-h-full grid-cols-1 gap-5 p-4 lg:p-6 xl:grid-cols-[minmax(0,1fr)_380px]">
      {anyError && (
        <section className="xl:col-span-2">
          <ErrorState
            title={t('dashboard.failed')}
            message={anyError.message}
            code={anyError.code}
            details={anyError.details}
            onRetry={() => window.location.reload()}
          />
        </section>
      )}
      <section className="xl:col-span-2">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
          <StatCard
            label={t('dashboard.totalSpend')}
            value={formatCurrency(overview?.totalSpend)}
            icon={WalletCards}
            loading={overviewLoading}
            change={`+ ${t('dashboard.live')}`}
            changeTone="success"
            sparkline
          />
          <StatCard
            label={t('dashboard.totalTokens')}
            value={formatTokens(totalTokens)}
            icon={Database}
            loading={overviewLoading}
            change={t('dashboard.allSources')}
            changeTone="info"
            sparkline
          />
          <StatCard
            label={t('dashboard.totalSessions')}
            value={String(overview?.sessionCount ?? 0)}
            icon={MessageSquare}
            loading={overviewLoading}
            change={`${formatTokens(totalMessages)} ${t('common.messages').toLowerCase()}`}
            changeTone="info"
            sparkline
          />
          <StatCard
            label={t('dashboard.avgCostSession')}
            value={formatCurrency(overview?.averageSessionCost)}
            icon={Coins}
            loading={overviewLoading}
            change={overview?.mostUsedCli ?? '—'}
            changeTone="warning"
            sparkline
          />
          <StatCard
            label={t('dashboard.totalDuration')}
            value={formatDuration(totalDurationMs)}
            icon={Timer}
            loading={overviewLoading}
            change={t('dashboard.indexed')}
            changeTone="success"
            sparkline
          />
        </div>
      </section>

      <section className="space-y-5">
        <div className="grid grid-cols-1 items-stretch gap-4 lg:grid-cols-2 2xl:grid-cols-[1.35fr_1fr_1fr]">
          <DataPanel
            className="lg:col-span-2 2xl:col-span-1"
            title={t('project.spendOverTime')}
            description={t('dashboard.spendTrendDescription')}
            action={
              <Button variant="outline" size="sm">
                {t('common.daily')}
              </Button>
            }
            contentClassName="pt-4"
          >
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={spendPoints}>
                <defs>
                  <linearGradient id="spendGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--accent)" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="var(--accent)" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="var(--border)" vertical={false} />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 11, fill: 'var(--subtle-foreground)' }}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: 'var(--subtle-foreground)' }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(value: number) => `$${value.toFixed(0)}`}
                />
                <Tooltip
                  contentStyle={tooltipStyle}
                  formatter={(value: number) => [formatCurrency(value), t('common.cost')]}
                />
                <Area
                  type="monotone"
                  dataKey="spend"
                  stroke="var(--accent)"
                  fill="url(#spendGradient)"
                  strokeWidth={2.4}
                  dot={{ r: 3, fill: 'var(--accent)' }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </DataPanel>

          <DonutCard
            title={t('dashboard.spendByCli')}
            data={cliData}
            center={formatCurrency(overview?.totalSpend)}
            centerLabel={t('common.total')}
            emptyTitle={t('dashboard.noSpend.title')}
            emptyDescription={t('dashboard.noSpend.description')}
            colorFor={(label, index) => CLI_COLORS[label] ?? chartColor(index)}
          />
          <DonutCard
            title={t('dashboard.spendByModel')}
            data={modelData}
            center={`${modelData.length}`}
            centerLabel={t('dashboard.modelsLabel')}
            emptyTitle={t('dashboard.noSpend.title')}
            emptyDescription={t('dashboard.noSpend.description')}
            colorFor={(_, index) => chartColor(index)}
          />
        </div>

        <DataPanel
          className="overflow-hidden"
          title={t('dashboard.recentSessions')}
          description={t('dashboard.recentSessionsDescription')}
          action={
            <Link
              to="/sessions"
              className="inline-flex items-center gap-2 rounded-sm font-mono text-xs font-medium text-accent transition-colors hover:text-accent-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/25"
            >
              {t('dashboard.viewAllSessions')} <ArrowUpRight className="h-4 w-4" />
            </Link>
          }
          contentClassName="p-0"
        >
          <DataTableContainer className="max-h-[560px] overflow-auto">
            <DataTable>
              <DataTableHead className="sticky top-0 z-10 bg-surface">
                <DataTableRow className="hover:bg-transparent">
                  <DataTableHeaderCell>{t('common.session')}</DataTableHeaderCell>
                  <DataTableHeaderCell>{t('common.cli')}</DataTableHeaderCell>
                  <DataTableHeaderCell>{t('common.model')}</DataTableHeaderCell>
                  <DataTableHeaderCell>{t('common.project')}</DataTableHeaderCell>
                  <DataTableHeaderCell className="text-right">
                    {t('common.duration')}
                  </DataTableHeaderCell>
                  <DataTableHeaderCell className="text-right">
                    {t('common.cost')}
                  </DataTableHeaderCell>
                  <DataTableHeaderCell className="text-right">
                    {t('common.time')}
                  </DataTableHeaderCell>
                  <DataTableHeaderCell className="w-10" />
                </DataTableRow>
              </DataTableHead>
              <DataTableBody>
                {(recentSessions?.data ?? []).map((session) => (
                  <DataTableRow
                    key={session.id}
                    onClick={() => navigate(`/sessions/${session.id}`)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        navigate(`/sessions/${session.id}`);
                      }
                    }}
                    tabIndex={0}
                    role="button"
                    aria-label={t('dashboard.openSession')}
                    className="cursor-pointer"
                  >
                    <DataTableCell>
                      <div className="flex items-center gap-3">
                        <BrandMark value={session.cli} size="sm" />
                        <div>
                          <div className="font-mono text-sm font-medium text-foreground">
                            {session.session_id.slice(0, 8)}
                          </div>
                          <div className="text-xs text-subtle-foreground">{session.provider}</div>
                        </div>
                      </div>
                    </DataTableCell>
                    <DataTableCell>
                      <BrandBadge value={session.cli} />
                    </DataTableCell>
                    <DataTableCell className="font-mono text-xs text-muted-foreground">
                      {session.model ?? t('common.unknown')}
                    </DataTableCell>
                    <DataTableCell className="max-w-[220px] truncate text-muted-foreground">
                      {compactPath(session.project_path)}
                    </DataTableCell>
                    <DataTableCell className="text-right font-mono tabular-nums text-muted-foreground">
                      {formatDuration(session.duration_ms)}
                    </DataTableCell>
                    <DataTableCell className="text-right font-mono tabular-nums font-medium text-foreground">
                      <div>{formatCurrency(session.total_cost_usd)}</div>
                      {session.cost_source === 'estimated' && (
                        <div className="mt-1 text-[10px] uppercase tracking-[0.12em] text-warning">
                          {t('common.estimated')}
                        </div>
                      )}
                    </DataTableCell>
                    <DataTableCell className="text-right text-muted-foreground">
                      {formatRelativeTime(session.started_at)}
                    </DataTableCell>
                    <DataTableCell className="text-right">
                      <MoreHorizontal className="h-4 w-4 text-subtle-foreground" />
                    </DataTableCell>
                  </DataTableRow>
                ))}
              </DataTableBody>
            </DataTable>
          </DataTableContainer>
        </DataPanel>
      </section>

      <aside className="space-y-4">
        <DataPanel className="h-full" contentClassName="space-y-5">
          <div className="flex items-start gap-3">
            <BrandMark value={selectedSession?.cli} size="lg" />
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <h2 className="truncate font-mono text-base font-semibold text-foreground">
                  {selectedSession?.session_id?.slice(0, 8) ?? t('common.session')}
                </h2>
                <Badge
                  variant={
                    selectedSession?.source_confidence === 'HIGH'
                      ? 'success'
                      : selectedSession?.source_confidence === 'MEDIUM'
                        ? 'default'
                        : 'warning'
                  }
                >
                  {selectedSession?.source_confidence ?? '—'}
                </Badge>
              </div>
              <p className="mt-1 truncate text-sm text-muted-foreground">
                {getBrandMeta(selectedSession?.cli).label} ·{' '}
                {selectedSession?.model ?? t('common.unknown')}
              </p>
            </div>
          </div>

          {selectedSessionError ? (
            <ErrorState
              title={
                selectedSessionError.status === 404 ? t('session.notFound') : t('session.unable')
              }
              message={selectedSessionError.message}
              code={selectedSessionError.code}
              details={selectedSessionError.details}
              onRetry={() => selectedId && setSelectedId(selectedId)}
            />
          ) : (
            <>
              <div className="grid grid-cols-1 gap-2 rounded-lg border border-border bg-surface-muted p-2 text-center sm:grid-cols-3">
                <MiniMetric
                  label={t('common.cost')}
                  value={formatCurrency(selectedSession?.total_cost_usd)}
                />
                <MiniMetric
                  label={t('common.tokens')}
                  value={formatTokens(selectedUsage.input + selectedUsage.output)}
                />
                <MiniMetric
                  label={t('common.tools')}
                  value={String(selectedSession?.tool_call_count ?? 0)}
                />
              </div>

              <div className="grid grid-cols-1 gap-2 rounded-lg border border-border bg-surface-muted p-2 text-center sm:grid-cols-2">
                <MiniMetric
                  label={t('common.messages')}
                  value={String(selectedSession?.message_count ?? 0)}
                />
                <MiniMetric
                  label={t('common.duration')}
                  value={formatDuration(selectedSession?.duration_ms)}
                />
              </div>

              <div className="rounded-md border border-border p-4">
                <div className="mb-4 font-mono text-sm font-semibold text-foreground">
                  {t('session.tokenUsage')}
                </div>
                <TokenUsageBar
                  input={selectedUsage.input}
                  output={selectedUsage.output}
                  cacheRead={selectedUsage.cacheRead}
                  cacheWrite={selectedUsage.cacheWrite}
                />
              </div>

              <div className="rounded-md border border-border p-4 text-sm">
                <div className="mb-4 font-mono text-sm font-semibold text-foreground">
                  {t('session.metadata')}
                </div>
                <InfoRow
                  label={t('common.project')}
                  value={basename(selectedSession?.project_path)}
                />
                <InfoRow label={t('common.provider')} value={selectedSession?.provider ?? '—'} />
                <InfoRow
                  label={t('common.model')}
                  value={selectedSession?.model ?? t('common.unknown')}
                />
                <InfoRow
                  label={t('common.started')}
                  value={selectedSession?.started_at ? formatDate(selectedSession.started_at) : '—'}
                />
                <InfoRow
                  label={t('common.ended')}
                  value={selectedSession?.ended_at ? formatDate(selectedSession.ended_at) : '—'}
                />
                <InfoRow
                  label={t('common.duration')}
                  value={formatDuration(selectedSession?.duration_ms)}
                />
              </div>
            </>
          )}

          {selectedId && (
            <Link to={`/sessions/${selectedId}`}>
              <Button variant="outline" className="w-full">
                {t('dashboard.openSession')} <ArrowUpRight className="h-4 w-4" />
              </Button>
            </Link>
          )}
        </DataPanel>
      </aside>
    </div>
  );
}

function DonutCard({
  title,
  data,
  center,
  centerLabel,
  emptyTitle,
  emptyDescription,
  colorFor,
}: {
  title: string;
  data: { label: string; value: number; percentage: number }[];
  center: string;
  centerLabel: string;
  emptyTitle: string;
  emptyDescription: string;
  colorFor: (label: string, index: number) => string;
}) {
  const { t } = useI18n();

  return (
    <DataPanel
      className="h-full min-h-[348px]"
      title={title}
      description={t('dashboard.topContributors')}
      contentClassName="grid min-h-[292px] grid-rows-[160px_1fr] gap-4 pt-3"
    >
      <div className="relative mx-auto h-40 w-40">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="label"
              cx="50%"
              cy="50%"
              innerRadius={54}
              outerRadius={76}
              paddingAngle={2}
              stroke="var(--surface)"
              strokeWidth={2}
            >
              {data.map((item, index) => (
                <Cell key={item.label} fill={colorFor(item.label, index)} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={tooltipStyle}
              formatter={(value: number) => [formatCurrency(value), t('common.cost')]}
            />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
          <div>
            <div className="font-mono text-sm font-semibold text-foreground">{center}</div>
            <div className="font-mono text-[10px] uppercase tracking-[0.1em] text-subtle-foreground">
              {centerLabel}
            </div>
          </div>
        </div>
      </div>
      <div className="space-y-2.5">
        {data.map((item, index) => (
          <div
            key={item.label}
            className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3 text-xs"
          >
            <div className="flex min-w-0 items-start gap-2">
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-sm"
                style={{ background: colorFor(item.label, index) }}
              />
              <span className="break-words leading-snug text-muted-foreground">{item.label}</span>
            </div>
            <div className="flex shrink-0 items-center gap-3 tabular-nums">
              <span className="hidden text-subtle-foreground 2xl:inline">
                {formatCurrency(item.value)}
              </span>
              <span className="min-w-12 text-right font-mono font-semibold text-foreground">
                {item.percentage}%
              </span>
            </div>
          </div>
        ))}
        {data.length === 0 && (
          <EmptyState title={emptyTitle} description={emptyDescription} className="p-4" />
        )}
      </div>
    </DataPanel>
  );
}

function MiniMetric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="font-mono text-[10px] uppercase tracking-[0.12em] text-subtle-foreground">
        {label}
      </div>
      <div className="mt-1 truncate font-mono text-sm font-semibold text-foreground">{value}</div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="mb-3 flex justify-between gap-4 last:mb-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="truncate text-right font-mono font-medium text-foreground">{value}</span>
    </div>
  );
}
