import { useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import {
  CheckCircle2,
  Database,
  Languages,
  LockKeyhole,
  Moon,
  RadioTower,
  RefreshCw,
  ShieldCheck,
  Sun,
} from 'lucide-react';
import { BrandMark, getBrandMeta } from '../components/brand/BrandMark.js';
import { useI18n } from '../components/i18n/LanguageProvider.js';
import { useTheme } from '../components/theme/ThemeProvider.js';
import { Badge } from '../components/ui/Badge.js';
import { Button } from '../components/ui/Button.js';
import { DataPanel } from '../components/ui/DataPanel.js';
import { ErrorState } from '../components/ui/ErrorState.js';
import type { IntegrationStatusItem } from '../components/layout/IntegrationStatus.js';
import { useApi } from '../hooks/useApi.js';
import { formatCurrency, formatDateTime } from '../lib/format.js';

interface Overview {
  totalSpend: number;
  sessionCount: number;
  mostUsedCli: string | null;
}

interface IngestionStatus {
  totalSessions?: number;
  newSessions?: number;
  updatedSessions?: number;
  errors?: string[];
  startedAt?: string;
  completedAt?: string | null;
  adapters?: Record<string, { detected: boolean; paths: number }>;
  message?: string;
}

interface AutoIngestionStatus {
  enabled: boolean;
  running: boolean;
  scheduled: boolean;
  watchedPathCount: number;
  debounceMs: number;
  periodicScanMs: number;
  lastTriggeredAt: string | null;
  lastTriggerReason: string | null;
  lastRunCompletedAt: string | null;
  lastError: string | null;
}

export function SettingsPage() {
  const { theme, setTheme } = useTheme();
  const { locale, setLocale, t } = useI18n();
  const [ingestionRunning, setIngestionRunning] = useState(false);
  const [autoUpdating, setAutoUpdating] = useState(false);
  const [autoMutationError, setAutoMutationError] = useState<string | null>(null);
  const {
    data: overview,
    error: overviewError,
    refetch: refetchOverview,
  } = useApi<Overview>('/api/overview');
  const {
    data: ingestStatus,
    error: ingestError,
    refetch: refetchIngest,
  } = useApi<IngestionStatus>('/api/ingest/status');
  const {
    data: autoIngestion,
    error: autoError,
    refetch: refetchAuto,
  } = useApi<AutoIngestionStatus>('/api/ingest/auto');
  const { data: integrations } = useApi<{ integrations: IntegrationStatusItem[] }>(
    '/api/integrations/status',
    { initialData: { integrations: [] } },
  );

  async function runIngestion() {
    setIngestionRunning(true);
    try {
      await fetch('/api/ingest', { method: 'POST' });
      await Promise.all([refetchIngest(), refetchOverview(), refetchAuto()]);
    } finally {
      setIngestionRunning(false);
    }
  }

  async function setAutoIngestion(enabled: boolean) {
    setAutoUpdating(true);
    setAutoMutationError(null);
    try {
      const res = await fetch('/api/ingest/auto', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled }),
      });
      if (!res.ok) throw new Error(await res.text());
      await refetchAuto();
    } catch (err) {
      setAutoMutationError(err instanceof Error ? err.message : String(err));
    } finally {
      setAutoUpdating(false);
    }
  }

  const adapterRows = Object.entries(ingestStatus?.adapters ?? {});
  const detectedCount = (integrations?.integrations ?? []).filter(
    (item) => item.status === 'available',
  ).length;

  return (
    <div className="grid gap-5 p-4 lg:p-6 xl:grid-cols-[minmax(0,1fr)_380px]">
      <section className="space-y-5">
        <DataPanel
          title={t('settings.appearance')}
          description={t('settings.appearance.description')}
          contentClassName="grid gap-3 sm:grid-cols-2"
        >
          <PreferenceButton
            active={theme === 'light'}
            icon={Sun}
            title="Light"
            description={t('settings.light.description')}
            onClick={() => setTheme('light')}
            tone="warning"
          />
          <PreferenceButton
            active={theme === 'dark'}
            icon={Moon}
            title="Dark"
            description={t('settings.dark.description')}
            onClick={() => setTheme('dark')}
            tone="accent"
          />
        </DataPanel>

        <DataPanel
          title={t('settings.language')}
          description={t('settings.language.description')}
          contentClassName="grid gap-3 sm:grid-cols-2"
        >
          <LanguageButton
            active={locale === 'en'}
            label="English"
            description={t('settings.english.description')}
            onClick={() => setLocale('en')}
          />
          <LanguageButton
            active={locale === 'pt-BR'}
            label="Português"
            description={t('settings.portuguese.description')}
            onClick={() => setLocale('pt-BR')}
          />
        </DataPanel>

        <DataPanel
          title={t('settings.privacy')}
          description={t('settings.privacy.description')}
          contentClassName="grid gap-3 md:grid-cols-3"
        >
          <PrivacyItem
            icon={ShieldCheck}
            title={t('settings.noTelemetry')}
            description={t('settings.noTelemetry.description')}
          />
          <PrivacyItem
            icon={LockKeyhole}
            title={t('settings.localPrompts')}
            description={t('settings.localPrompts.description')}
          />
          <PrivacyItem
            icon={Database}
            title={t('settings.sqlite')}
            description={t('settings.sqlite.description')}
          />
        </DataPanel>

        <DataPanel
          title={t('settings.ingestion')}
          description={t('settings.ingestion.description')}
          action={
            <Button onClick={runIngestion} disabled={ingestionRunning}>
              <RefreshCw className={`h-4 w-4 ${ingestionRunning ? 'animate-spin' : ''}`} />
              {ingestionRunning ? t('settings.running') : t('settings.runIngestion')}
            </Button>
          }
          contentClassName="space-y-4"
        >
          {ingestError ? (
            <ErrorState
              title={t('settings.ingestionFailed')}
              message={ingestError.message}
              code={ingestError.code}
              details={ingestError.details}
              onRetry={refetchIngest}
            />
          ) : (
            <>
              <div className="grid gap-3 sm:grid-cols-3">
                <StatusTile
                  label={t('settings.totalSessions')}
                  value={String(ingestStatus?.totalSessions ?? overview?.sessionCount ?? 0)}
                />
                <StatusTile
                  label={t('settings.new')}
                  value={String(ingestStatus?.newSessions ?? 0)}
                />
                <StatusTile
                  label={t('settings.updated')}
                  value={String(ingestStatus?.updatedSessions ?? 0)}
                />
              </div>
              <div className="rounded-lg border border-border bg-surface-elevated p-4">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex gap-3">
                    <div className="grid h-10 w-10 shrink-0 place-items-center rounded-md border border-accent/20 bg-accent-soft text-accent">
                      <RadioTower className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="font-mono text-sm font-medium text-foreground">
                          {t('settings.autoIngestion')}
                        </div>
                        <Badge variant={autoIngestion?.enabled ? 'success' : 'neutral'}>
                          {autoIngestion?.enabled ? t('settings.enabled') : t('settings.disabled')}
                        </Badge>
                        {autoIngestion?.running && (
                          <Badge variant="default">{t('settings.running')}</Badge>
                        )}
                        {autoIngestion?.scheduled && (
                          <Badge variant="warning">{t('settings.scheduled')}</Badge>
                        )}
                      </div>
                      <p className="mt-1 text-sm leading-6 text-muted-foreground">
                        {t('settings.autoIngestion.description')}
                      </p>
                    </div>
                  </div>
                  <Button
                    variant={autoIngestion?.enabled ? 'outline' : 'default'}
                    onClick={() => setAutoIngestion(!autoIngestion?.enabled)}
                    disabled={autoUpdating || !autoIngestion}
                  >
                    {autoUpdating
                      ? t('settings.updating')
                      : autoIngestion?.enabled
                        ? t('settings.disableAutoIngestion')
                        : t('settings.enableAutoIngestion')}
                  </Button>
                </div>
                <div className="mt-4 grid gap-3 rounded-lg border border-border bg-surface-muted p-4 text-sm md:grid-cols-2">
                  <SummaryRow
                    label={t('settings.watchedPaths')}
                    value={String(autoIngestion?.watchedPathCount ?? 0)}
                  />
                  <SummaryRow
                    label={t('settings.periodicScan')}
                    value={`${Math.round((autoIngestion?.periodicScanMs ?? 0) / 60000)} min`}
                  />
                  <SummaryRow
                    label={t('settings.lastTrigger')}
                    value={
                      autoIngestion?.lastTriggeredAt
                        ? formatDateTime(autoIngestion.lastTriggeredAt)
                        : '—'
                    }
                  />
                  <SummaryRow
                    label={t('settings.lastRun')}
                    value={
                      autoIngestion?.lastRunCompletedAt
                        ? formatDateTime(autoIngestion.lastRunCompletedAt)
                        : '—'
                    }
                  />
                </div>
                {(autoError || autoMutationError || autoIngestion?.lastError) && (
                  <div className="mt-3 font-mono text-sm text-danger">
                    {autoError?.message ?? autoMutationError ?? autoIngestion?.lastError}
                  </div>
                )}
              </div>
              <div className="rounded-lg border border-border bg-surface-muted p-4 text-sm">
                <SummaryRow
                  label={t('common.started')}
                  value={
                    ingestStatus?.startedAt
                      ? formatDateTime(ingestStatus.startedAt)
                      : t('settings.notRun')
                  }
                />
                <SummaryRow
                  label={t('settings.completed')}
                  value={
                    ingestStatus?.completedAt
                      ? formatDateTime(ingestStatus.completedAt)
                      : (ingestStatus?.message ?? '—')
                  }
                />
                <SummaryRow
                  label={t('settings.warnings')}
                  value={String(ingestStatus?.errors?.length ?? 0)}
                />
              </div>
              {adapterRows.length > 0 && (
                <div className="grid gap-2 sm:grid-cols-2">
                  {adapterRows.map(([cli, info]) => (
                    <div
                      key={cli}
                      className="flex items-center justify-between gap-3 rounded-lg border border-border bg-surface-elevated p-3"
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <BrandMark value={cli} size="sm" />
                        <div className="min-w-0">
                          <div className="truncate text-sm font-medium text-foreground">
                            {getBrandMeta(cli).label}
                          </div>
                          <div className="text-xs text-subtle-foreground">
                            {info.paths} {t('settings.pathsDiscovered')}
                          </div>
                        </div>
                      </div>
                      <Badge variant={info.detected ? 'success' : 'neutral'}>
                        {info.detected ? t('common.detected') : t('common.missing')}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </DataPanel>
      </section>

      <aside className="space-y-5">
        <DataPanel title={t('settings.workspaceSummary')} contentClassName="space-y-4">
          {overviewError && (
            <ErrorState
              title={t('settings.overviewFailed')}
              message={overviewError.message}
              code={overviewError.code}
              details={overviewError.details}
              onRetry={refetchOverview}
            />
          )}
          <SummaryRow label={t('common.sessions')} value={String(overview?.sessionCount ?? 0)} />
          <SummaryRow
            label={t('settings.totalSpend')}
            value={formatCurrency(overview?.totalSpend)}
          />
          <SummaryRow
            label={t('settings.topCli')}
            value={overview?.mostUsedCli ? getBrandMeta(overview.mostUsedCli).label : '—'}
          />
        </DataPanel>

        <DataPanel
          title={t('settings.localDatabase')}
          action={<Badge variant="success">Local</Badge>}
          contentClassName="space-y-4"
        >
          <div className="grid gap-3 rounded-lg border border-border bg-surface-muted p-4 text-sm">
            <SummaryRow label={t('settings.engine')} value="SQLite via sql.js" />
            <SummaryRow label={t('settings.scope')} value={t('settings.thisMachine')} />
            <SummaryRow
              label={t('settings.sessionsIndexed')}
              value={String(overview?.sessionCount ?? 0)}
            />
            <SummaryRow label={t('settings.storage')} value={t('settings.localFile')} />
          </div>
        </DataPanel>

        <DataPanel
          title={t('settings.integrations')}
          action={
            <Badge variant="neutral">
              {detectedCount}/{integrations?.integrations.length ?? 0}
            </Badge>
          }
          contentClassName="space-y-3"
        >
          {(integrations?.integrations ?? []).map((item) => (
            <div
              key={item.cli}
              className="flex items-center justify-between rounded-lg border border-border bg-surface-muted p-3"
            >
              <div className="flex items-center gap-3">
                <BrandMark value={item.cli} size="sm" />
                <span className="text-sm font-medium text-foreground">
                  {getBrandMeta(item.cli).label}
                </span>
              </div>
              <Badge variant={item.status === 'available' ? 'success' : 'neutral'}>
                {item.status === 'available' ? t('common.detected') : t('common.missing')}
              </Badge>
            </div>
          ))}
        </DataPanel>
      </aside>
    </div>
  );
}

function PreferenceButton({
  active,
  icon: Icon,
  title,
  description,
  onClick,
  tone,
}: {
  active: boolean;
  icon: LucideIcon;
  title: string;
  description: string;
  onClick: () => void;
  tone: 'warning' | 'accent';
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-start justify-between gap-4 rounded-lg border p-4 text-left transition-colors hover:bg-surface-hover ${active ? 'border-accent bg-accent-soft' : 'border-border bg-surface'}`}
    >
      <div>
        <Icon className={`mb-4 h-5 w-5 ${tone === 'warning' ? 'text-warning' : 'text-accent'}`} />
        <div className="font-mono text-sm font-medium text-foreground">{title}</div>
        <div className="mt-1 text-sm leading-6 text-muted-foreground">{description}</div>
      </div>
      {active && <CheckCircle2 className="h-5 w-5 text-accent" />}
    </button>
  );
}

function LanguageButton({
  active,
  label,
  description,
  onClick,
}: {
  active: boolean;
  label: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-start justify-between gap-4 rounded-lg border p-4 text-left transition-colors hover:bg-surface-hover ${active ? 'border-accent bg-accent-soft' : 'border-border bg-surface'}`}
    >
      <div>
        <Languages className="mb-4 h-5 w-5 text-accent" />
        <div className="font-mono text-sm font-medium text-foreground">{label}</div>
        <div className="mt-1 text-sm leading-6 text-muted-foreground">{description}</div>
      </div>
      {active && <CheckCircle2 className="h-5 w-5 text-accent" />}
    </button>
  );
}

function PrivacyItem({
  icon: Icon,
  title,
  description,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-surface-muted p-4">
      <Icon className="mb-4 h-5 w-5 text-accent" />
      <div className="font-mono text-sm font-medium text-foreground">{title}</div>
      <div className="mt-1 text-sm leading-6 text-muted-foreground">{description}</div>
    </div>
  );
}

function StatusTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-surface-muted p-4">
      <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-subtle-foreground">
        {label}
      </div>
      <div className="mt-1 font-mono text-2xl font-semibold tracking-[-0.05em] text-foreground">
        {value}
      </div>
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-mono font-medium text-foreground">{value}</span>
    </div>
  );
}
