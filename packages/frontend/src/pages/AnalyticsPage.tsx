import { useMemo, useState } from 'react';
import { AlertTriangle, ChevronRight, CircleAlert, Gauge, Sparkles, TrendingUp, type LucideIcon } from 'lucide-react';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
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
import { formatCurrency, formatTokens } from '../lib/format.js';
import { Badge } from '../components/ui/Badge.js';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card.js';
import { Select } from '../components/ui/Select.js';

const COLORS = ['#6366f1', '#818cf8', '#a78bfa', '#22c55e', '#eab308', '#ef4444', '#ec4899'];

interface Insight {
  id: string;
  kind: 'growth' | 'project' | 'model' | 'session' | 'cache';
  severity: 'high' | 'medium' | 'low';
  title: string;
  description: string;
  value: string;
}

interface Anomaly {
  id: string;
  kind: 'spend' | 'token' | 'session';
  severity: 'high' | 'medium' | 'low';
  title: string;
  description: string;
  value: string;
}

interface AnalyticsReport {
  generatedAt: string;
  summary: {
    totalSpend: number;
    current7DaySpend: number;
    previous7DaySpend: number;
    growthPercent: number | null;
    baselineDailySpend: number;
  };
  insights: Insight[];
  anomalies: Anomaly[];
  trend: { date: string; spend: number }[];
  productivity: {
    totalToolCalls: number;
    avgToolCallsPerSession: number;
    avgToolCallsPerMinute: number | null;
    avgTokensPerToolCall: number | null;
    avgCostPerToolCall: number | null;
    avgMessagesPerToolCall: number | null;
    costToolCallCorrelation: number | null;
    topToolCallSessions: {
      sessionId: string;
      cli: string;
      provider: string;
      model: string | null;
      projectPath: string | null;
      cost: number;
      durationMs: number | null;
      messages: number;
      toolCalls: number;
      tokens: number;
      toolCallsPerMinute: number | null;
      tokensPerToolCall: number | null;
      costPerToolCall: number | null;
      messagesPerToolCall: number | null;
    }[];
    filesModifiedSupported: boolean;
    notes: string[];
  };
}

export function AnalyticsPage() {
  const [dimension, setDimension] = useState('model');
  const [metric, setMetric] = useState('cost');

  const { data: report } = useApi<AnalyticsReport>('/api/analytics/report');
  const { data: spendData } = useApi<{ points: { date: string; spend: number; tokens: number }[] }>('/api/analytics/spend-over-time?granularity=week');
  const { data: tokenData } = useApi<{ points: { date: string; inputTokens: number; outputTokens: number }[] }>('/api/analytics/tokens-over-time');
  const { data: breakdownData } = useApi<{ breakdown: { label: string; value: number; percentage: number }[] }>(`/api/analytics/breakdown?dimension=${dimension}&metric=${metric}`);

  const breakdown = useMemo(() => (breakdownData?.breakdown ?? []).filter((d) => d.value > 0), [breakdownData]);
  const insights = report?.insights ?? [];
  const anomalies = report?.anomalies ?? [];
  const productivity = report?.productivity;

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-lg font-semibold text-foreground">Analytics</h1>
          <p className="text-sm text-subtle-foreground">Insights engine, anomaly detection and usage breakdowns</p>
        </div>
        <div className="flex gap-3">
          <Select
            options={[
              { label: 'By Model', value: 'model' },
              { label: 'By Provider', value: 'provider' },
              { label: 'By CLI', value: 'cli' },
              { label: 'By Project', value: 'project' },
            ]}
            value={dimension}
            onChange={(e) => setDimension(e.target.value)}
          />
          <Select
            options={[
              { label: 'Cost', value: 'cost' },
              { label: 'Sessions', value: 'sessions' },
              { label: 'Tokens', value: 'tokens' },
            ]}
            value={metric}
            onChange={(e) => setMetric(e.target.value)}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <SummaryCard icon={TrendingUp} label="7d Spend" value={formatCurrency(report?.summary.current7DaySpend)} sub={report?.summary.growthPercent != null ? `${report.summary.growthPercent >= 0 ? '+' : ''}${report.summary.growthPercent.toFixed(0)}% vs prior week` : 'Not enough data'} tone="success" />
        <SummaryCard icon={Gauge} label="Baseline / day" value={formatCurrency(report?.summary.baselineDailySpend)} sub="7-day moving baseline" tone="info" />
        <SummaryCard icon={Sparkles} label="Insights" value={String(insights.length)} sub="Actionable findings" tone="warning" />
        <SummaryCard icon={AlertTriangle} label="Anomalies" value={String(anomalies.length)} sub="Outliers and spikes" tone="danger" />
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <SummaryCard icon={Sparkles} label="Tool Calls" value={String(productivity?.totalToolCalls ?? 0)} sub="Total across sessions" tone="info" />
        <SummaryCard icon={Gauge} label="Calls / Session" value={(productivity?.avgToolCallsPerSession ?? 0).toFixed(1)} sub="Average interaction density" tone="success" />
        <SummaryCard icon={TrendingUp} label="Tokens / Tool" value={formatTokens(productivity?.avgTokensPerToolCall)} sub="Efficiency indicator" tone="warning" />
        <SummaryCard icon={AlertTriangle} label="Cost / Tool" value={formatCurrency(productivity?.avgCostPerToolCall)} sub={productivity?.costToolCallCorrelation != null ? `Correlation ${productivity.costToolCallCorrelation.toFixed(2)}` : 'Correlation unavailable'} tone="danger" />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Insights Engine</CardTitle>
              <p className="mt-1 text-xs text-subtle-foreground">Heuristics computed from local sessions only</p>
            </div>
            <Badge variant="neutral">{report ? 'Live' : 'Loading'}</Badge>
          </CardHeader>
          <CardContent className="space-y-3">
            {insights.length > 0 ? insights.map((insight) => <InsightRow key={insight.id} item={insight} />) : <EmptyState title="No insights yet" description="Run more sessions or ingest newer history to surface patterns." icon={Sparkles} />}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div>
              <CardTitle>Anomaly Detection</CardTitle>
              <p className="mt-1 text-xs text-subtle-foreground">Spikes, outliers and elevated cache miss rates</p>
            </div>
            <Badge variant="neutral">Baseline</Badge>
          </CardHeader>
          <CardContent className="space-y-3">
            {anomalies.length > 0 ? anomalies.map((anomaly) => <AnomalyRow key={anomaly.id} item={anomaly} />) : <EmptyState title="No anomalies detected" description="Current sessions do not exceed the baseline thresholds." icon={CircleAlert} />}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Weekly Spend</CardTitle>
              <p className="mt-1 text-xs text-subtle-foreground">Recent trend across all local sessions</p>
            </div>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={spendData?.points ?? report?.trend ?? []}>
                <defs>
                  <linearGradient id="spendGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="var(--border)" vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: 'var(--subtle-foreground)' }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 11, fill: 'var(--subtle-foreground)' }} tickLine={false} axisLine={false} tickFormatter={(v: number) => `$${v.toFixed(0)}`} />
                <Tooltip contentStyle={tooltipStyle} formatter={(value: number) => [formatCurrency(value), 'Spend']} />
                <Area type="monotone" dataKey="spend" stroke="#6366f1" fill="url(#spendGradient)" strokeWidth={2.4} dot={{ r: 3, fill: '#6366f1' }} />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div>
              <CardTitle>Token Usage</CardTitle>
              <p className="mt-1 text-xs text-subtle-foreground">Input vs output over time</p>
            </div>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={tokenData?.points ?? []}>
                <CartesianGrid stroke="var(--border)" vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: 'var(--subtle-foreground)' }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 11, fill: 'var(--subtle-foreground)' }} tickLine={false} axisLine={false} tickFormatter={(v: number) => formatTokens(v)} />
                <Tooltip contentStyle={tooltipStyle} />
                <Area type="monotone" dataKey="inputTokens" stroke="#818cf8" fill="rgba(129,140,248,0.1)" strokeWidth={2} name="Input" />
                <Area type="monotone" dataKey="outputTokens" stroke="#22c55e" fill="rgba(34,197,94,0.1)" strokeWidth={2} name="Output" />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[0.9fr_1.1fr]">
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Breakdown</CardTitle>
              <p className="mt-1 text-xs text-subtle-foreground">Distribution by selected dimension</p>
            </div>
          </CardHeader>
          <CardContent className="flex items-center gap-6">
            <ResponsiveContainer width="55%" height={220}>
              <PieChart>
                <Pie data={breakdown} dataKey="value" nameKey="label" cx="50%" cy="50%" outerRadius={90} innerRadius={55}>
                  {breakdown.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip contentStyle={tooltipStyle} formatter={(value: number) => [metric === 'cost' ? formatCurrency(value) : formatTokens(value), '']} />
              </PieChart>
            </ResponsiveContainer>
            <div className="space-y-2 text-xs">
              {breakdown.map((d, i) => (
                <div key={d.label} className="flex items-center gap-2">
                  <div className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />
                  <span className="max-w-[120px] truncate text-subtle-foreground">{d.label}</span>
                  <span className="ml-auto font-medium text-foreground">{d.percentage}%</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div>
              <CardTitle>Top Projects Spend</CardTitle>
              <p className="mt-1 text-xs text-subtle-foreground">Highest contributors in the selected breakdown</p>
            </div>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={breakdown.slice(0, 8)} layout="vertical" margin={{ left: 80 }}>
                <CartesianGrid stroke="var(--border)" vertical={false} />
                <XAxis type="number" tick={{ fontSize: 11, fill: 'var(--subtle-foreground)' }} tickLine={false} axisLine={false} tickFormatter={(v: number) => metric === 'cost' ? formatCurrency(v) : String(v)} />
                <YAxis type="category" dataKey="label" tick={{ fontSize: 11, fill: 'var(--subtle-foreground)' }} width={80} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={tooltipStyle} />
                <Bar dataKey="value" fill="#6366f1" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Productivity Analytics</CardTitle>
              <p className="mt-1 text-xs text-subtle-foreground">Tool-call efficiency across local sessions</p>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <MetricLine label="Avg tool calls / minute" value={formatNumber(productivity?.avgToolCallsPerMinute)} />
            <MetricLine label="Avg messages / tool call" value={formatNumber(productivity?.avgMessagesPerToolCall)} />
            <MetricLine label="Avg cost / tool call" value={formatCurrency(productivity?.avgCostPerToolCall)} />
            <MetricLine label="Files modified / session" value="Pending source" muted />
            <div className="rounded-2xl border border-dashed border-border p-4 text-xs text-subtle-foreground">
              {productivity?.notes?.[0] ?? 'Files modified per session will be added once a reliable adapter source exists.'}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div>
              <CardTitle>Top Tool-Heavy Sessions</CardTitle>
              <p className="mt-1 text-xs text-subtle-foreground">Sessions with the highest number of tool calls</p>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {(productivity?.topToolCallSessions ?? []).length > 0 ? productivity!.topToolCallSessions.map((session) => (
              <div key={session.sessionId} className="rounded-2xl border border-border bg-surface-elevated p-4 text-sm">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-medium text-foreground">{session.sessionId.slice(0, 12)}</div>
                    <div className="text-xs text-subtle-foreground">{session.cli} · {session.model ?? 'unknown'} · {session.provider}</div>
                  </div>
                  <Badge variant="neutral">{session.toolCalls} tools</Badge>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-subtle-foreground md:grid-cols-4">
                  <MetricChip label="Cost" value={formatCurrency(session.cost)} />
                  <MetricChip label="Tokens" value={formatTokens(session.tokens)} />
                  <MetricChip label="Msgs/tool" value={formatNumber(session.messagesPerToolCall)} />
                  <MetricChip label="Tokens/tool" value={formatNumber(session.tokensPerToolCall)} />
                </div>
              </div>
            )) : <EmptyState title="No productivity data yet" description="Tool call efficiency will appear after the next ingest cycle." icon={Sparkles} />}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function SummaryCard({ icon: Icon, label, value, sub, tone }: { icon: LucideIcon; label: string; value: string; sub: string; tone: 'success' | 'info' | 'warning' | 'danger' }) {
  const toneMap = {
    success: 'bg-success-soft text-success',
    info: 'bg-info-soft text-info',
    warning: 'bg-warning-soft text-warning',
    danger: 'bg-destructive-soft text-destructive',
  }[tone];

  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-4">
        <div className={`grid h-10 w-10 shrink-0 place-items-center rounded-2xl ${toneMap}`}>
          <Icon className="h-4.5 w-4.5" />
        </div>
        <div className="min-w-0">
          <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-subtle-foreground">{label}</p>
          <p className="mt-1 text-base font-semibold text-foreground">{value}</p>
          <p className="text-xs text-subtle-foreground">{sub}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function InsightRow({ item }: { item: Insight }) {
  return (
    <div className="rounded-2xl border border-border bg-surface-elevated p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="mb-2 flex items-center gap-2">
            <Badge variant={item.severity === 'high' ? 'success' : item.severity === 'medium' ? 'default' : 'neutral'}>{item.kind}</Badge>
            <span className="text-xs text-subtle-foreground">Insight</span>
          </div>
          <div className="font-medium text-foreground">{item.title}</div>
          <p className="mt-1 text-sm text-subtle-foreground">{item.description}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2 text-xs text-muted-foreground">
          <span className="font-medium text-foreground">{item.value}</span>
          <ChevronRight className="h-4 w-4" />
        </div>
      </div>
    </div>
  );
}

function AnomalyRow({ item }: { item: Anomaly }) {
  return (
    <div className="rounded-2xl border border-border bg-surface-elevated p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="mb-2 flex items-center gap-2">
            <Badge variant={item.severity === 'high' ? 'warning' : item.severity === 'medium' ? 'default' : 'neutral'}>{item.kind}</Badge>
            <span className="text-xs text-subtle-foreground">Anomaly</span>
          </div>
          <div className="font-medium text-foreground">{item.title}</div>
          <p className="mt-1 text-sm text-subtle-foreground">{item.description}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2 text-xs text-muted-foreground">
          <span className="font-medium text-foreground">{item.value}</span>
          <CircleAlert className="h-4 w-4" />
        </div>
      </div>
    </div>
  );
}

function EmptyState({ title, description, icon: Icon }: { title: string; description: string; icon: LucideIcon }) {
  return (
    <div className="rounded-2xl border border-dashed border-border p-6 text-center">
      <div className="mx-auto mb-3 grid h-10 w-10 place-items-center rounded-2xl bg-surface-muted text-subtle-foreground">
        <Icon className="h-4 w-4" />
      </div>
      <div className="font-medium text-foreground">{title}</div>
      <p className="mt-1 text-sm text-subtle-foreground">{description}</p>
    </div>
  );
}

function MetricLine({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-surface-elevated px-4 py-3 text-sm">
      <span className={muted ? 'text-subtle-foreground' : 'text-foreground'}>{label}</span>
      <span className={`font-medium ${muted ? 'text-subtle-foreground' : 'text-foreground'}`}>{value}</span>
    </div>
  );
}

function MetricChip({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-surface p-3">
      <div className="text-[11px] uppercase tracking-[0.12em] text-subtle-foreground">{label}</div>
      <div className="mt-1 font-medium text-foreground">{value}</div>
    </div>
  );
}

function formatNumber(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return '—';
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

const tooltipStyle = {
  background: 'var(--surface-elevated)',
  border: '1px solid var(--border)',
  borderRadius: 12,
  color: 'var(--foreground)',
  boxShadow: 'var(--shadow-card)',
  fontSize: 12,
};
