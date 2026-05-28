import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import type { LucideIcon } from 'lucide-react';
import {
  ArrowLeft,
  Bot,
  Clock,
  Database,
  DollarSign,
  MessageSquare,
  Terminal,
  Wrench,
  Zap,
} from 'lucide-react';
import { BrandBadge, BrandMark } from '../components/brand/BrandMark.js';
import { Badge } from '../components/ui/Badge.js';
import { Button } from '../components/ui/Button.js';
import { DataPanel } from '../components/ui/DataPanel.js';
import { MetricTile } from '../components/ui/MetricTile.js';
import { TokenUsageBar } from '../components/session/TokenUsageBar.js';
import { EmptyState } from '../components/ui/EmptyState.js';
import { ErrorState } from '../components/ui/ErrorState.js';
import { LoadingState } from '../components/ui/LoadingState.js';
import { useI18n } from '../components/i18n/LanguageProvider.js';
import { useApi } from '../hooks/useApi.js';
import {
  basename,
  compactPath,
  formatCurrency,
  formatDate,
  formatDateTime,
  formatDuration,
  formatRelativeTime,
  formatTokens,
} from '../lib/format.js';

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
  cost_source: 'actual' | 'estimated' | 'unknown';
  source_confidence: string;
  message_count: number;
  tool_call_count: number;
  session_id: string;
  project_exists: boolean;
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
  const { t } = useI18n();
  const { id } = useParams<{ id: string }>();
  const [openingProject, setOpeningProject] = useState(false);
  const {
    data: session,
    loading,
    error,
    refetch,
  } = useApi<SessionDetail>(id ? `/api/sessions/${id}` : null, { immediate: Boolean(id) });

  if (loading) return <LoadingState />;

  if (error) {
    return (
      <div className="p-4 lg:p-6">
        <ErrorState
          title={error.status === 404 ? t('session.notFound') : t('session.unable')}
          message={error.message}
          code={error.code}
          details={error.details}
          onRetry={refetch}
        />
      </div>
    );
  }

  if (!session)
    return (
      <div className="p-4 lg:p-6">
        <EmptyState
          title={t('session.notFound')}
          description={t('session.notFound.description')}
          icon={MessageSquare}
        />
      </div>
    );

  const messages = session.messages ?? [];
  const usageEvents = session.usageEvents ?? [];
  const totalInput = usageEvents.reduce((sum, event) => sum + (event.input_tokens ?? 0), 0);
  const totalOutput = usageEvents.reduce((sum, event) => sum + (event.output_tokens ?? 0), 0);
  const cacheRead = usageEvents.reduce((sum, event) => sum + (event.cache_read_tokens ?? 0), 0);
  const cacheWrite = usageEvents.reduce((sum, event) => sum + (event.cache_write_tokens ?? 0), 0);
  const reasoning = usageEvents.reduce((sum, event) => sum + (event.reasoning_tokens ?? 0), 0);
  const totalTokens = totalInput + totalOutput + cacheRead + cacheWrite + reasoning;
  const modelUsage = session.modelUsage ?? [];

  async function openProject() {
    if (!id || !session?.project_exists) return;
    setOpeningProject(true);
    try {
      await fetch(`/api/sessions/${id}/open-project`, { method: 'POST' });
    } finally {
      setOpeningProject(false);
    }
  }

  return (
    <div className="space-y-5 p-4 lg:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          to="/sessions"
          className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> {t('session.back')}
        </Link>
        <Badge
          variant={
            session.source_confidence === 'HIGH'
              ? 'success'
              : session.source_confidence === 'MEDIUM'
                ? 'default'
                : 'warning'
          }
        >
          {session.source_confidence} confidence
        </Badge>
      </div>

      <DataPanel contentClassName="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 items-start gap-4">
          <BrandMark value={session.cli} size="lg" />
          <div className="min-w-0">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <BrandBadge value={session.cli} />
              <BrandBadge value={session.provider} kind="provider" />
              <span className="text-xs text-subtle-foreground">
                {formatRelativeTime(session.started_at)}
              </span>
            </div>
            <h1 className="truncate font-mono text-2xl font-semibold tracking-[-0.04em] text-foreground">
              Session {session.session_id.slice(0, 12)}
            </h1>
            <p className="mt-1 truncate text-sm text-muted-foreground">
              {compactPath(session.project_path)}
            </p>
          </div>
        </div>
        <Button
          variant="outline"
          onClick={openProject}
          disabled={!session.project_exists || openingProject}
        >
          {openingProject
            ? t('session.opening')
            : session.project_exists
              ? t('session.openFolder')
              : t('session.folderMissing')}
        </Button>
      </DataPanel>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-6">
        <MetricBadge
          icon={DollarSign}
          label={
            session.cost_source === 'estimated' ? t('session.costEstimated') : t('common.cost')
          }
          value={formatCurrency(session.total_cost_usd)}
          tone="success"
        />
        <MetricBadge
          icon={Database}
          label={t('common.tokens')}
          value={formatTokens(totalTokens)}
          tone="info"
        />
        <MetricBadge
          icon={MessageSquare}
          label={t('common.messages')}
          value={String(session.message_count ?? messages.length)}
          tone="info"
        />
        <MetricBadge
          icon={Wrench}
          label={t('common.tools')}
          value={String(session.tool_call_count ?? 0)}
          tone="warning"
        />
        <MetricBadge
          icon={Clock}
          label={t('common.duration')}
          value={formatDuration(session.duration_ms)}
          tone="success"
        />
        <MetricBadge
          icon={Zap}
          label={t('common.model')}
          value={session.model ?? t('common.unknown')}
          tone="warning"
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
        <DataPanel
          className="min-w-0"
          title={t('session.conversation')}
          description={`${messages.length} ${t('session.normalizedMessages')}`}
          contentClassName="p-0"
        >
          <div className="max-h-[68vh] space-y-4 overflow-y-auto p-5">
            {messages.map((message) => (
              <MessageBubble key={message.id} message={message} />
            ))}
            {messages.length === 0 && (
              <EmptyState
                title={t('session.noMessages.title')}
                description={t('session.noMessages.description')}
                icon={MessageSquare}
              />
            )}
          </div>
        </DataPanel>

        <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
          {modelUsage.length > 1 && (
            <DataPanel title={t('session.modelsUsed')} contentClassName="space-y-3 pt-3">
              {modelUsage.map((item) => (
                <div
                  key={`${item.provider}/${item.model}`}
                  className="rounded-lg border border-border bg-surface-elevated p-3 text-sm"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-mono text-sm font-medium text-foreground">
                        {item.provider}/{item.model}
                      </div>
                      <div className="text-xs text-subtle-foreground">
                        {item.message_count} messages
                      </div>
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
            </DataPanel>
          )}

          <DataPanel title={t('session.tokenUsage')} contentClassName="space-y-5 pt-3">
            <TokenUsageBar
              input={totalInput}
              output={totalOutput}
              cacheRead={cacheRead}
              cacheWrite={cacheWrite}
            />
            {reasoning > 0 && <DetailRow label="Reasoning" value={formatTokens(reasoning)} />}
          </DataPanel>

          <DataPanel title={t('session.metadata')} contentClassName="space-y-3 pt-3 text-sm">
            <DetailRow label={t('common.project')} value={basename(session.project_path)} />
            <DetailRow label="Path" value={compactPath(session.project_path)} />
            <DetailRow label="CLI" value={session.cli} />
            <DetailRow label={t('common.provider')} value={session.provider} />
            <DetailRow label={t('common.model')} value={session.model ?? t('common.unknown')} />
            <DetailRow
              label={t('session.costSource')}
              value={session.cost_source ?? t('common.unknown')}
            />
            <DetailRow label={t('common.started')} value={formatDateTime(session.started_at)} />
            <DetailRow
              label={t('common.ended')}
              value={session.ended_at ? formatDateTime(session.ended_at) : '—'}
            />
            <DetailRow label={t('common.date')} value={formatDate(session.started_at)} />
            <DetailRow label="Session ID" value={session.session_id} mono />
          </DataPanel>
        </aside>
      </div>
    </div>
  );
}

function DetailMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border bg-surface p-2">
      <div className="font-mono text-[10px] uppercase tracking-[0.12em] text-subtle-foreground">
        {label}
      </div>
      <div className="mt-1 font-mono font-medium text-foreground">{value}</div>
    </div>
  );
}

function MetricBadge({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  tone: 'success' | 'warning' | 'info';
}) {
  return (
    <MetricTile label={label} value={value} tone={tone} icon={Icon} className="min-h-[92px]" />
  );
}

function MessageBubble({ message }: { message: Message }) {
  const isUser = message.role === 'user';
  const isAssistant = message.role === 'assistant';
  const Icon = isUser ? Terminal : Bot;

  return (
    <div className={`flex gap-3 ${isUser ? 'justify-end' : 'justify-start'}`}>
      {!isUser && (
        <div className="mt-1 grid h-8 w-8 shrink-0 place-items-center rounded-md border border-border bg-surface-elevated text-muted-foreground">
          <Icon className="h-4 w-4" />
        </div>
      )}
      <div className={`max-w-[min(780px,92%)] ${isUser ? 'order-first' : ''}`}>
        <div
          className={
            isUser
              ? 'rounded-lg border border-accent bg-accent px-4 py-3 text-sm text-accent-foreground'
              : isAssistant
                ? 'rounded-lg border border-border bg-surface-elevated px-4 py-3 text-sm text-foreground'
                : 'rounded-lg border border-border bg-surface-muted px-4 py-3 text-sm text-muted-foreground'
          }
        >
          <div className="mb-2 flex items-center justify-between gap-4 text-[11px] uppercase tracking-[0.14em] opacity-60">
            <span>{message.role}</span>
            <span className="normal-case tracking-normal">{formatDateTime(message.timestamp)}</span>
          </div>
          <pre className="whitespace-pre-wrap break-words font-mono text-xs leading-6 [overflow-wrap:anywhere]">
            {message.content}
          </pre>
        </div>
      </div>
      {isUser && (
        <div className="mt-1 grid h-8 w-8 shrink-0 place-items-center rounded-md border border-accent/20 bg-accent-soft text-accent">
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
      <span
        className={`min-w-0 text-right font-mono font-medium text-foreground ${mono ? 'break-all text-xs' : 'truncate'}`}
      >
        {value}
      </span>
    </div>
  );
}
