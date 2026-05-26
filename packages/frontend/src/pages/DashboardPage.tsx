import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight, Coins, Database, MessageSquare, MoreHorizontal, Timer, WalletCards } from 'lucide-react';
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
import { Badge } from '../components/ui/Badge.js';
import { Button } from '../components/ui/Button.js';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card.js';
import { TokenUsageBar } from '../components/session/TokenUsageBar.js';
import { ErrorState } from '../components/ui/ErrorState.js';
import { useApi } from '../hooks/useApi.js';
import { CLI_COLORS, chartColor } from '../lib/chart-colors.js';
import { basename, compactPath, formatCurrency, formatDate, formatDuration, formatRelativeTime, formatTokens } from '../lib/format.js';

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
  borderRadius: 12,
  color: 'var(--foreground)',
  boxShadow: 'var(--shadow-card)',
  fontSize: 12,
};

export function DashboardPage() {
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const { data: overview, loading: overviewLoading, error: overviewError } = useApi<Overview>('/api/overview');
  const { data: spendData, error: spendError } = useApi<{ points: { date: string; spend: number; tokens: number; sessions: number }[] }>('/api/analytics/spend-over-time');
  const { data: tokenData, error: tokenError } = useApi<{ points: { date: string; inputTokens: number; outputTokens: number; cacheReadTokens?: number; cacheWriteTokens?: number }[] }>('/api/analytics/tokens-over-time');
  const { data: cliBreakdown, error: cliError } = useApi<{ breakdown: { label: string; value: number; percentage: number }[] }>('/api/analytics/breakdown?dimension=cli&metric=cost');
  const { data: modelBreakdown, error: modelError } = useApi<{ breakdown: { label: string; value: number; percentage: number }[] }>('/api/analytics/breakdown?dimension=model&metric=cost');
  const { data: recentSessions, error: recentSessionsError } = useApi<{ data: SessionRow[]; total: number }>('/api/sessions?limit=9&sortBy=started_at&sortOrder=desc');
  const { data: allSessions, error: allSessionsError } = useApi<{ data: SessionRow[]; total: number }>('/api/sessions?limit=500&sortBy=started_at&sortOrder=desc');
  const { data: selectedSession, error: selectedSessionError } = useApi<SessionDetail>(selectedId ? `/api/sessions/${selectedId}` : null, { immediate: Boolean(selectedId) });

  useEffect(() => {
    if (!selectedId && recentSessions?.data?.[0]) setSelectedId(recentSessions.data[0].id);
  }, [recentSessions, selectedId]);

  const spendPoints = spendData?.points ?? [];
  const tokenPoints = tokenData?.points ?? [];
  const cliData = (cliBreakdown?.breakdown ?? []).filter((item) => item.value > 0);
  const modelData = (modelBreakdown?.breakdown ?? []).filter((item) => item.value > 0).slice(0, 5);
  const totalTokens = tokenPoints.reduce((sum, point) => sum + point.inputTokens + point.outputTokens, 0);
  const totalDurationMs = (allSessions?.data ?? []).reduce((sum, session) => sum + (session.duration_ms ?? 0), 0);
  const totalMessages = (allSessions?.data ?? []).reduce((sum, session) => sum + (session.message_count ?? 0), 0);

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

  const anyError = overviewError || spendError || tokenError || cliError || modelError || recentSessionsError || allSessionsError || selectedSessionError;

  return (
    <div className="grid min-h-full grid-cols-1 gap-6 p-6 xl:grid-cols-[minmax(0,1fr)_380px]">
      {anyError && (
        <section className="xl:col-span-2">
          <ErrorState
            title="Dashboard requests failed"
            message={anyError.message}
            code={anyError.code}
            details={anyError.details}
            onRetry={() => window.location.reload()}
          />
        </section>
      )}
      <section className="xl:col-span-2">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
          <StatCard label="Total Spend" value={formatCurrency(overview?.totalSpend)} icon={WalletCards} loading={overviewLoading} change="+ live" changeTone="success" sparkline />
          <StatCard label="Total Tokens" value={formatTokens(totalTokens)} icon={Database} loading={overviewLoading} change="all sources" changeTone="info" sparkline />
          <StatCard label="Total Sessions" value={String(overview?.sessionCount ?? 0)} icon={MessageSquare} loading={overviewLoading} change={`${formatTokens(totalMessages)} messages`} changeTone="info" sparkline />
          <StatCard label="Avg. Cost / Session" value={formatCurrency(overview?.averageSessionCost)} icon={Coins} loading={overviewLoading} change={overview?.mostUsedCli ?? '—'} changeTone="warning" sparkline />
          <StatCard label="Total Duration" value={formatDuration(totalDurationMs)} icon={Timer} loading={overviewLoading} change="indexed" changeTone="success" sparkline />
        </div>
      </section>

      <section className="space-y-6">
        <div className="grid grid-cols-1 items-stretch gap-4 lg:grid-cols-2 2xl:grid-cols-[1.35fr_1fr_1fr]">
          <Card className="lg:col-span-2 2xl:col-span-1">
            <CardHeader>
              <div>
                <CardTitle>Spend Over Time</CardTitle>
                <p className="mt-1 text-xs text-subtle-foreground">Daily cost across all AI coding CLIs</p>
              </div>
              <Button variant="outline" size="sm">Daily</Button>
            </CardHeader>
            <CardContent className="pt-4">
              <ResponsiveContainer width="100%" height={280}>
                <AreaChart data={spendPoints}>
                  <defs>
                    <linearGradient id="spendGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#22c55e" stopOpacity={0.35} />
                      <stop offset="95%" stopColor="#22c55e" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="date" tick={{ fontSize: 11, fill: 'var(--subtle-foreground)' }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: 'var(--subtle-foreground)' }} tickLine={false} axisLine={false} tickFormatter={(value: number) => `$${value.toFixed(0)}`} />
                  <Tooltip contentStyle={tooltipStyle} formatter={(value: number) => [formatCurrency(value), 'Spend']} />
                  <Area type="monotone" dataKey="spend" stroke="#22c55e" fill="url(#spendGradient)" strokeWidth={2.4} dot={{ r: 3, fill: '#22c55e' }} />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <DonutCard title="Spend by CLI" data={cliData} center={formatCurrency(overview?.totalSpend)} centerLabel="Total" colorFor={(label, index) => CLI_COLORS[label] ?? chartColor(index)} />
          <DonutCard title="Spend by Model" data={modelData} center={`${modelData.length}`} centerLabel="models" colorFor={(_, index) => chartColor(index)} />
        </div>

        <Card className="overflow-hidden">
          <CardHeader>
            <div>
              <CardTitle>Recent Sessions</CardTitle>
              <p className="mt-1 text-xs text-subtle-foreground">Latest indexed conversations across Codex, OpenCode and Claude</p>
            </div>
            <Link to="/sessions" className="inline-flex items-center gap-2 text-sm font-medium text-accent hover:text-accent-hover">
              View all sessions <ArrowUpRight className="h-4 w-4" />
            </Link>
          </CardHeader>
          <CardContent className="p-0">
            <div className="max-h-[560px] overflow-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 z-10 bg-surface">
                  <tr className="border-b border-border text-xs text-subtle-foreground">
                    <th className="px-5 py-3 text-left font-medium">Session</th>
                    <th className="px-5 py-3 text-left font-medium">CLI</th>
                    <th className="px-5 py-3 text-left font-medium">Model</th>
                    <th className="px-5 py-3 text-left font-medium">Project</th>
                    <th className="px-5 py-3 text-right font-medium">Duration</th>
                    <th className="px-5 py-3 text-right font-medium">Cost</th>
                    <th className="px-5 py-3 text-right font-medium">Time</th>
                    <th className="w-10 px-5 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {(recentSessions?.data ?? []).map((session) => (
                    <tr key={session.id} onClick={() => setSelectedId(session.id)} className="cursor-pointer border-b border-border transition-colors hover:bg-surface-hover">
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-3">
                          <div className="grid h-8 w-8 place-items-center rounded-xl border border-border bg-surface-elevated text-xs font-semibold text-muted-foreground">{session.cli.slice(0, 2).toUpperCase()}</div>
                          <div>
                            <div className="font-medium text-foreground">{session.session_id.slice(0, 8)}</div>
                            <div className="text-xs text-subtle-foreground">{session.provider}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3"><Badge variant="neutral">{session.cli}</Badge></td>
                      <td className="px-5 py-3 font-mono text-xs text-muted-foreground">{session.model ?? 'unknown'}</td>
                      <td className="max-w-[220px] truncate px-5 py-3 text-muted-foreground">{compactPath(session.project_path)}</td>
                      <td className="px-5 py-3 text-right tabular-nums text-muted-foreground">{formatDuration(session.duration_ms)}</td>
                      <td className="px-5 py-3 text-right tabular-nums font-medium text-foreground">{formatCurrency(session.total_cost_usd)}</td>
                      <td className="px-5 py-3 text-right text-muted-foreground">{formatRelativeTime(session.started_at)}</td>
                      <td className="px-5 py-3 text-right"><MoreHorizontal className="h-4 w-4 text-subtle-foreground" /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </section>

      <aside className="space-y-4">
        <Card className="h-full">
          <CardContent className="space-y-5">
            <div className="flex items-start gap-3">
              <div className="grid h-11 w-11 place-items-center rounded-2xl bg-slate-950 text-sm font-semibold text-white dark:bg-white dark:text-slate-950">AI</div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <h2 className="truncate text-base font-semibold text-foreground">{selectedSession?.session_id?.slice(0, 8) ?? 'Session'}</h2>
                  <Badge variant={selectedSession?.source_confidence === 'HIGH' ? 'success' : selectedSession?.source_confidence === 'MEDIUM' ? 'default' : 'warning'}>
                    {selectedSession?.source_confidence ?? '—'}
                  </Badge>
                </div>
                <p className="mt-1 truncate text-sm text-muted-foreground">{selectedSession?.cli ?? '—'} · {selectedSession?.model ?? 'unknown'}</p>
              </div>
            </div>

            {selectedSessionError ? (
              <ErrorState
                title={selectedSessionError.status === 404 ? 'Session not found' : 'Unable to load session'}
                message={selectedSessionError.message}
                code={selectedSessionError.code}
                details={selectedSessionError.details}
                onRetry={() => selectedId && setSelectedId(selectedId)}
              />
            ) : (
              <>
                <div className="grid grid-cols-3 gap-2 rounded-2xl border border-border bg-surface-muted p-2 text-center">
                  <MiniMetric label="Cost" value={formatCurrency(selectedSession?.total_cost_usd)} />
                  <MiniMetric label="Tokens" value={formatTokens(selectedUsage.input + selectedUsage.output)} />
                  <MiniMetric label="Tools" value={String(selectedSession?.tool_call_count ?? 0)} />
                </div>

                <div className="grid grid-cols-2 gap-2 rounded-2xl border border-border bg-surface-muted p-2 text-center">
                  <MiniMetric label="Messages" value={String(selectedSession?.message_count ?? 0)} />
                  <MiniMetric label="Duration" value={formatDuration(selectedSession?.duration_ms)} />
                </div>

                <div className="rounded-2xl border border-border p-4">
                  <div className="mb-4 text-sm font-semibold text-foreground">Token Usage</div>
                  <TokenUsageBar input={selectedUsage.input} output={selectedUsage.output} cacheRead={selectedUsage.cacheRead} cacheWrite={selectedUsage.cacheWrite} />
                </div>

                <div className="rounded-2xl border border-border p-4 text-sm">
                  <div className="mb-4 text-sm font-semibold text-foreground">Metadata</div>
                  <InfoRow label="Project" value={basename(selectedSession?.project_path)} />
                  <InfoRow label="Provider" value={selectedSession?.provider ?? '—'} />
                  <InfoRow label="Model" value={selectedSession?.model ?? 'unknown'} />
                  <InfoRow label="Started" value={selectedSession?.started_at ? formatDate(selectedSession.started_at) : '—'} />
                  <InfoRow label="Ended" value={selectedSession?.ended_at ? formatDate(selectedSession.ended_at) : '—'} />
                  <InfoRow label="Duration" value={formatDuration(selectedSession?.duration_ms)} />
                </div>
              </>
            )}

            {selectedId && (
              <Link to={`/sessions/${selectedId}`}>
                <Button variant="outline" className="w-full">Open in Session Explorer <ArrowUpRight className="h-4 w-4" /></Button>
              </Link>
            )}
          </CardContent>
        </Card>
      </aside>
    </div>
  );
}

function DonutCard({ title, data, center, centerLabel, colorFor }: { title: string; data: { label: string; value: number; percentage: number }[]; center: string; centerLabel: string; colorFor: (label: string, index: number) => string }) {
  return (
    <Card className="h-full min-h-[348px]">
      <CardHeader className="pb-1">
        <div>
          <CardTitle>{title}</CardTitle>
          <p className="mt-1 text-xs text-subtle-foreground">Top contributors by cost</p>
        </div>
      </CardHeader>
      <CardContent className="grid min-h-[292px] grid-rows-[160px_1fr] gap-4 pt-3">
        <div className="relative mx-auto h-40 w-40">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={data} dataKey="value" nameKey="label" cx="50%" cy="50%" innerRadius={54} outerRadius={76} paddingAngle={2} stroke="var(--surface)" strokeWidth={2}>
                {data.map((item, index) => <Cell key={item.label} fill={colorFor(item.label, index)} />)}
              </Pie>
              <Tooltip contentStyle={tooltipStyle} formatter={(value: number) => [formatCurrency(value), 'Spend']} />
            </PieChart>
          </ResponsiveContainer>
          <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
            <div>
              <div className="text-sm font-semibold text-foreground">{center}</div>
              <div className="text-[11px] text-subtle-foreground">{centerLabel}</div>
            </div>
          </div>
        </div>
        <div className="space-y-2.5">
          {data.map((item, index) => (
            <div key={item.label} className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3 text-xs">
              <div className="flex min-w-0 items-start gap-2">
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: colorFor(item.label, index) }} />
                <span className="break-words leading-snug text-muted-foreground">{item.label}</span>
              </div>
              <div className="flex shrink-0 items-center gap-3 tabular-nums">
                <span className="hidden text-subtle-foreground 2xl:inline">{formatCurrency(item.value)}</span>
                <span className="min-w-12 text-right font-semibold text-foreground">{item.percentage}%</span>
              </div>
            </div>
          ))}
          {data.length === 0 && <div className="rounded-xl border border-dashed border-border p-4 text-center text-xs text-subtle-foreground">No spend data yet</div>}
        </div>
      </CardContent>
    </Card>
  );
}

function MiniMetric({ label, value }: { label: string; value: string }) {
  return <div><div className="text-[11px] text-subtle-foreground">{label}</div><div className="mt-1 truncate text-sm font-semibold text-foreground">{value}</div></div>;
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return <div className="mb-3 flex justify-between gap-4 last:mb-0"><span className="text-muted-foreground">{label}</span><span className="truncate text-right font-medium text-foreground">{value}</span></div>;
}
