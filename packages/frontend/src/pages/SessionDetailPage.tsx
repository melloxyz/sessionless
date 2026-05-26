import { Link, useParams } from 'react-router-dom';
import type { LucideIcon } from 'lucide-react';
import { ArrowLeft, Bot, Clock, Database, DollarSign, MessageSquare, Terminal, Wrench, Zap } from 'lucide-react';
import { Badge } from '../components/ui/Badge.js';
import { Button } from '../components/ui/Button.js';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card.js';
import { TokenUsageBar } from '../components/session/TokenUsageBar.js';
import { ErrorState } from '../components/ui/ErrorState.js';
import { useApi } from '../hooks/useApi.js';
import { basename, compactPath, formatCurrency, formatDate, formatDateTime, formatDuration, formatRelativeTime, formatTokens } from '../lib/format.js';

interface Message {
  id: number;
  role: string;
  content: string;
  timestamp: string;
}

interface UsageEvent {
  id: number;
  timestamp: string;
  input_tokens: number;
  output_tokens: number;
  cache_read_tokens: number;
  cache_write_tokens: number;
  reasoning_tokens: number;
  tool_calls_count: number;
}

interface SessionDetail {
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
  messages: Message[];
  usageEvents: UsageEvent[];
  modelUsage?: ModelUsage[];
}

interface ModelUsage {
  provider: string;
  model: string;
  message_count: number;
  input_tokens: number;
  output_tokens: number;
  reasoning_tokens: number;
  cache_read_tokens: number;
  cache_write_tokens: number;
  tool_calls_count: number;
  total_cost_usd: number;
}

export function SessionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: session, loading, error, refetch } = useApi<SessionDetail>(id ? `/api/sessions/${id}` : null, { immediate: Boolean(id) });

  if (loading) {
    return (
      <div className="space-y-5 p-6">
        <div className="h-9 w-36 animate-pulse rounded-xl bg-surface-muted" />
        <div className="h-44 animate-pulse rounded-2xl bg-surface" />
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div className="h-96 animate-pulse rounded-2xl bg-surface" />
          <div className="h-96 animate-pulse rounded-2xl bg-surface" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <ErrorState
          title={error.status === 404 ? 'Session not found' : 'Unable to load session'}
          message={error.message}
          code={error.code}
          details={error.details}
          onRetry={refetch}
        />
      </div>
    );
  }

  if (!session) return <div className="p-6 text-sm text-subtle-foreground">Session not found</div>;

  const messages = session.messages ?? [];
  const usageEvents = session.usageEvents ?? [];
  const totalInput = usageEvents.reduce((sum, event) => sum + (event.input_tokens ?? 0), 0);
  const totalOutput = usageEvents.reduce((sum, event) => sum + (event.output_tokens ?? 0), 0);
  const cacheRead = usageEvents.reduce((sum, event) => sum + (event.cache_read_tokens ?? 0), 0);
  const cacheWrite = usageEvents.reduce((sum, event) => sum + (event.cache_write_tokens ?? 0), 0);
  const reasoning = usageEvents.reduce((sum, event) => sum + (event.reasoning_tokens ?? 0), 0);
  const totalTokens = totalInput + totalOutput + cacheRead + cacheWrite + reasoning;
  const modelUsage = session.modelUsage ?? [];

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link to="/sessions" className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Back to sessions
        </Link>
        <Badge variant={session.source_confidence === 'HIGH' ? 'success' : session.source_confidence === 'MEDIUM' ? 'default' : 'warning'}>
          {session.source_confidence} confidence
        </Badge>
      </div>

      <Card>
        <CardContent className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 items-start gap-4">
            <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-slate-950 text-sm font-semibold text-white dark:bg-white dark:text-slate-950">
              {session.cli.slice(0, 2).toUpperCase()}
            </div>
            <div className="min-w-0">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <Badge variant="neutral">{session.cli}</Badge>
                <Badge variant="info">{session.provider}</Badge>
                <span className="text-xs text-subtle-foreground">{formatRelativeTime(session.started_at)}</span>
              </div>
              <h1 className="truncate text-2xl font-semibold tracking-[-0.04em] text-foreground">Session {session.session_id.slice(0, 12)}</h1>
              <p className="mt-1 truncate text-sm text-muted-foreground">{compactPath(session.project_path)}</p>
            </div>
          </div>
          <Link to="/sessions">
            <Button variant="outline">Open explorer</Button>
          </Link>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <MetricBadge icon={DollarSign} label="Cost" value={formatCurrency(session.total_cost_usd)} tone="success" />
        <MetricBadge icon={Database} label="Tokens" value={formatTokens(totalTokens)} tone="info" />
        <MetricBadge icon={MessageSquare} label="Messages" value={String(session.message_count ?? messages.length)} tone="info" />
        <MetricBadge icon={Wrench} label="Tools" value={String(session.tool_call_count ?? 0)} tone="warning" />
        <MetricBadge icon={Clock} label="Duration" value={formatDuration(session.duration_ms)} tone="success" />
        <MetricBadge icon={Zap} label="Model" value={session.model ?? 'unknown'} tone="warning" />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
        <Card className="min-w-0">
          <CardHeader className="border-b border-border pb-5">
            <div>
              <CardTitle>Conversation</CardTitle>
              <p className="mt-1 text-xs text-subtle-foreground">{messages.length} normalized messages from this local session</p>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="max-h-[68vh] space-y-4 overflow-y-auto p-5">
              {messages.map((message) => <MessageBubble key={message.id} message={message} />)}
              {messages.length === 0 && (
                <div className="rounded-2xl border border-dashed border-border p-10 text-center text-sm text-subtle-foreground">No messages in this session</div>
              )}
            </div>
          </CardContent>
        </Card>

        <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
          {modelUsage.length > 1 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle>Models Used</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 pt-3">
                {modelUsage.map((item) => (
                  <div key={`${item.provider}/${item.model}`} className="rounded-2xl border border-border bg-surface-elevated p-3 text-sm">
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="font-medium text-foreground">{item.provider}/{item.model}</div>
                        <div className="text-xs text-subtle-foreground">{item.message_count} messages</div>
                      </div>
                      <Badge variant="neutral">{formatCurrency(item.total_cost_usd)}</Badge>
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-subtle-foreground">
                      <DetailMetric label="Input" value={formatTokens(item.input_tokens)} />
                      <DetailMetric label="Output" value={formatTokens(item.output_tokens)} />
                      <DetailMetric label="Reasoning" value={formatTokens(item.reasoning_tokens)} />
                      <DetailMetric label="Tools" value={String(item.tool_calls_count)} />
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader className="pb-2">
              <CardTitle>Token Usage</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5 pt-3">
              <TokenUsageBar input={totalInput} output={totalOutput} cacheRead={cacheRead} cacheWrite={cacheWrite} />
              {reasoning > 0 && <DetailRow label="Reasoning" value={formatTokens(reasoning)} />}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle>Metadata</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 pt-3 text-sm">
              <DetailRow label="Project" value={basename(session.project_path)} />
              <DetailRow label="Path" value={compactPath(session.project_path)} />
              <DetailRow label="CLI" value={session.cli} />
              <DetailRow label="Provider" value={session.provider} />
              <DetailRow label="Model" value={session.model ?? 'unknown'} />
              <DetailRow label="Started" value={formatDateTime(session.started_at)} />
              <DetailRow label="Ended" value={session.ended_at ? formatDateTime(session.ended_at) : '—'} />
              <DetailRow label="Date" value={formatDate(session.started_at)} />
              <DetailRow label="Session ID" value={session.session_id} mono />
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}

function DetailMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-surface p-2">
      <div className="text-[11px] uppercase tracking-[0.12em] text-subtle-foreground">{label}</div>
      <div className="mt-1 font-medium text-foreground">{value}</div>
    </div>
  );
}

function MetricBadge({ icon: Icon, label, value, tone }: { icon: LucideIcon; label: string; value: string; tone: 'success' | 'warning' | 'info' }) {
  const toneClass = {
    success: 'bg-success-soft text-success',
    warning: 'bg-warning-soft text-warning',
    info: 'bg-info-soft text-info',
  }[tone];

  return (
    <Card className="overflow-hidden">
      <CardContent className="flex min-h-[92px] items-center gap-3 p-4">
        <div className={`grid h-10 w-10 shrink-0 place-items-center rounded-2xl ${toneClass}`}>
          <Icon className="h-[18px] w-[18px]" />
        </div>
        <div className="min-w-0">
          <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-subtle-foreground">{label}</p>
          <p className="mt-1 truncate text-sm font-semibold text-foreground">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function MessageBubble({ message }: { message: Message }) {
  const isUser = message.role === 'user';
  const isAssistant = message.role === 'assistant';
  const Icon = isUser ? Terminal : Bot;

  return (
    <div className={`flex gap-3 ${isUser ? 'justify-end' : 'justify-start'}`}>
      {!isUser && (
        <div className="mt-1 grid h-8 w-8 shrink-0 place-items-center rounded-xl border border-border bg-surface-elevated text-muted-foreground">
          <Icon className="h-4 w-4" />
        </div>
      )}
      <div className={`max-w-[min(780px,92%)] ${isUser ? 'order-first' : ''}`}>
        <div
          className={
            isUser
              ? 'rounded-2xl bg-accent px-4 py-3 text-sm text-accent-foreground shadow-sm'
              : isAssistant
                ? 'rounded-2xl border border-border bg-surface-elevated px-4 py-3 text-sm text-foreground'
                : 'rounded-2xl border border-border bg-surface-muted px-4 py-3 text-sm text-muted-foreground'
          }
        >
          <div className="mb-2 flex items-center justify-between gap-4 text-[11px] uppercase tracking-[0.14em] opacity-60">
            <span>{message.role}</span>
            <span className="normal-case tracking-normal">{formatDateTime(message.timestamp)}</span>
          </div>
          <pre className="whitespace-pre-wrap break-words font-sans leading-6 [overflow-wrap:anywhere]">{message.content}</pre>
        </div>
      </div>
      {isUser && (
        <div className="mt-1 grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-accent-soft text-accent">
          <Icon className="h-4 w-4" />
        </div>
      )}
    </div>
  );
}

function DetailRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-border pb-3 last:border-0 last:pb-0">
      <span className="shrink-0 text-muted-foreground">{label}</span>
      <span className={`min-w-0 text-right font-medium text-foreground ${mono ? 'break-all font-mono text-xs' : 'truncate'}`}>{value}</span>
    </div>
  );
}
