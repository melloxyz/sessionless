import { useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import {
  AlertTriangle,
  CheckCircle2,
  Database,
  Languages,
  LockKeyhole,
  Monitor,
  Moon,
  RadioTower,
  RefreshCw,
  ShieldAlert,
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
import { Skeleton } from '../components/ui/Skeleton.js';
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

interface TrayStatus {
  enabled: boolean;
  autoStart: boolean;
  startMinimized: boolean;
  available: boolean;
}

interface AlertRow {
  id: number;
  budget_id: number | null;
  type: string;
  title: string;
  message: string;
  current_spend: number;
  limit_usd: number;
  acknowledged: number;
  created_at: string;
}

export function SettingsPage() {
  const { theme, setTheme } = useTheme();
  const { locale, setLocale, t } = useI18n();
  const [ingestionRunning, setIngestionRunning] = useState(false);
  const [autoUpdating, setAutoUpdating] = useState(false);
  const [autoMutationError, setAutoMutationError] = useState<string | null>(null);
  const {
    data: overview,
    loading: overviewLoading,
    validating: overviewValidating,
    error: overviewError,
    refetch: refetchOverview,
  } = useApi<Overview>('/api/overview');
  const {
    data: ingestStatus,
    loading: ingestLoading,
    validating: ingestValidating,
    error: ingestError,
    refetch: refetchIngest,
  } = useApi<IngestionStatus>('/api/ingest/status');
  const {
    data: autoIngestion,
    loading: autoLoading,
    validating: autoValidating,
    error: autoError,
    refetch: refetchAuto,
  } = useApi<AutoIngestionStatus>('/api/ingest/auto');
  const { data: integrations, loading: integrationsLoading } = useApi<{
    integrations: IntegrationStatusItem[];
  }>('/api/integrations/status', { initialData: { integrations: [] } });
  const {
    data: trayStatus,
    loading: trayLoading,
    error: trayError,
    refetch: refetchTray,
  } = useApi<TrayStatus>('/api/tray/status');
  const [trayUpdating, setTrayUpdating] = useState(false);
  const [trayMutationError, setTrayMutationError] = useState<string | null>(null);

  const {
    data: alertsData,
    loading: alertsLoading,
    refetch: refetchAlerts,
  } = useApi<{ alerts: AlertRow[]; total: number }>('/api/alerts', {
    initialData: { alerts: [], total: 0 },
  });

  const unacknowledgedAlerts = (alertsData?.alerts ?? []).filter((a) => !a.acknowledged);

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

  async function updateTraySetting(key: string, value: boolean) {
    setTrayUpdating(true);
    setTrayMutationError(null);
    try {
      const res = await fetch('/api/tray/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [key]: value }),
      });
      if (!res.ok) throw new Error(await res.text());
      await refetchTray();
    } catch (err) {
      setTrayMutationError(err instanceof Error ? err.message : String(err));
    } finally {
      setTrayUpdating(false);
    }
  }

  const adapterRows = Object.entries(ingestStatus?.adapters ?? {});
  const detectedCount = (integrations?.integrations ?? []).filter(
    (item) => item.status === 'available',
  ).length;
  const isValidating = overviewValidating || ingestValidating || autoValidating;

  return (
    <div
      className="grid gap-4 p-4 lg:p-6 xl:grid-cols-[minmax(0,1fr)_380px]"
      aria-busy={isValidating}
    >
      <section className="space-y-5">
        <DataPanel
          title={t('settings.appearance')}
          description={t('settings.appearance.description')}
          contentClassName="grid gap-3 sm:grid-cols-2"
        >
          <PreferenceButton
            active={theme === 'light'}
            icon={Sun}
            title={t('settings.light')}
            description={t('settings.light.description')}
            onClick={() => setTheme('light')}
            tone="warning"
          />
          <PreferenceButton
            active={theme === 'dark'}
            icon={Moon}
            title={t('settings.dark')}
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
            label={t('settings.english')}
            description={t('settings.english.description')}
            onClick={() => setLocale('en')}
          />
          <LanguageButton
            active={locale === 'pt-BR'}
            label={t('settings.portuguese')}
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

        {trayStatus && trayStatus.available && (
          <DataPanel
            title={t('settings.tray')}
            description={t('settings.tray.description')}
            action={<Badge variant="success">{t('settings.tray.available')}</Badge>}
            contentClassName="space-y-4"
          >
            {trayError ? (
              <ErrorState
                title={t('settings.tray.loadFailed')}
                message={trayError.message}
                code={trayError.code}
                details={trayError.details}
                onRetry={refetchTray}
              />
            ) : (
              <>
                <ToggleRow
                  icon={Monitor}
                  title={t('settings.tray.enable')}
                  description={t('settings.tray.enable.description')}
                  enabled={trayStatus.enabled}
                  loading={trayLoading && !trayStatus}
                  updating={trayUpdating}
                  onChange={() => updateTraySetting('enabled', !trayStatus.enabled)}
                />
                <ToggleRow
                  title={t('settings.tray.autoStart')}
                  description={t('settings.tray.autoStart.description')}
                  enabled={trayStatus.autoStart}
                  loading={trayLoading && !trayStatus}
                  updating={trayUpdating}
                  onChange={() => updateTraySetting('autoStart', !trayStatus.autoStart)}
                />
                <ToggleRow
                  title={t('settings.tray.startMinimized')}
                  description={t('settings.tray.startMinimized.description')}
                  enabled={trayStatus.startMinimized}
                  loading={trayLoading && !trayStatus}
                  updating={trayUpdating}
                  onChange={() => updateTraySetting('startMinimized', !trayStatus.startMinimized)}
                />
                {trayMutationError && (
                  <div className="font-mono text-sm text-danger">{trayMutationError}</div>
                )}
                <div className="rounded-lg border border-border bg-surface-muted p-3 text-sm">
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-subtle-foreground" />
                    <span className="text-muted-foreground">{t('settings.tray.restartNote')}</span>
                  </div>
                </div>
              </>
            )}
          </DataPanel>
        )}

        {trayStatus && !trayStatus.available && (
          <DataPanel
            title={t('settings.tray')}
            description={t('settings.tray.description')}
            action={<Badge variant="neutral">{t('settings.tray.unavailable')}</Badge>}
            contentClassName="p-4"
          >
            <div className="rounded-lg border border-border bg-surface-muted p-4 text-sm text-muted-foreground">
              {t('settings.tray.windowsOnly')}
            </div>
          </DataPanel>
        )}

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
                  loading={ingestLoading && !ingestStatus && overviewLoading && !overview}
                />
                <StatusTile
                  label={t('settings.new')}
                  value={String(ingestStatus?.newSessions ?? 0)}
                  loading={ingestLoading && !ingestStatus}
                />
                <StatusTile
                  label={t('settings.updated')}
                  value={String(ingestStatus?.updatedSessions ?? 0)}
                  loading={ingestLoading && !ingestStatus}
                />
              </div>
              <div className="rounded-lg border border-border bg-surface-elevated p-4">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex gap-3">
                    <div className="grid h-10 w-10 shrink-0 place-items-center rounded-md border border-border bg-transparent text-subtle-foreground">
                      <RadioTower className="h-4.5 w-4.5" />
                    </div>
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="font-mono text-sm font-semibold text-foreground">
                          {t('settings.autoIngestion')}
                        </div>
                        <Badge variant={autoIngestion?.enabled ? 'success' : 'neutral'}>
                          {autoLoading && !autoIngestion
                            ? t('common.loading')
                            : autoIngestion?.enabled
                              ? t('settings.enabled')
                              : t('settings.disabled')}
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
                <div className="mt-4 grid gap-3 rounded-lg border border-border bg-surface-muted p-3 text-sm md:grid-cols-2">
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
              <div className="rounded-lg border border-border bg-surface-muted p-3 text-sm">
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
                      className="flex items-center justify-between gap-3 rounded-lg border border-border bg-surface-elevated p-2.5"
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
          <SummaryRow
            label={t('common.sessions')}
            value={String(overview?.sessionCount ?? 0)}
            loading={overviewLoading && !overview}
          />
          <SummaryRow
            label={t('settings.totalSpend')}
            value={formatCurrency(overview?.totalSpend)}
            loading={overviewLoading && !overview}
          />
          <SummaryRow
            label={t('settings.topCli')}
            value={overview?.mostUsedCli ? getBrandMeta(overview.mostUsedCli).label : '—'}
            loading={overviewLoading && !overview}
          />
        </DataPanel>

        <DataPanel
          title={t('settings.localDatabase')}
          action={<Badge variant="success">{t('settings.local')}</Badge>}
          contentClassName="space-y-4"
        >
          <div className="grid gap-3 rounded-lg border border-border bg-surface-muted p-4 text-sm">
            <SummaryRow label={t('settings.engine')} value="SQLite via sql.js" />
            <SummaryRow label={t('settings.scope')} value={t('settings.thisMachine')} />
            <SummaryRow
              label={t('settings.sessionsIndexed')}
              value={String(overview?.sessionCount ?? 0)}
              loading={overviewLoading && !overview}
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
          {integrationsLoading && !integrations
            ? Array.from({ length: 5 }).map((_, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between rounded-lg border border-border bg-surface-muted p-3"
                >
                  <div className="flex items-center gap-3">
                    <Skeleton className="h-8 w-8 rounded-md" />
                    <Skeleton className="h-4 w-24" />
                  </div>
                  <Skeleton className="h-6 w-16" />
                </div>
              ))
            : (integrations?.integrations ?? []).map((item) => (
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

        <DataPanel
          title="Budget Alerts"
          action={
            unacknowledgedAlerts.length > 0 ? (
              <Badge variant="danger">{unacknowledgedAlerts.length}</Badge>
            ) : (
              <Badge variant="success">0</Badge>
            )
          }
          contentClassName="p-3 space-y-2"
        >
          {alertsLoading && !alertsData ? (
            <div className="py-2 text-center text-sm text-muted-foreground">Loading</div>
          ) : alertsData && alertsData.alerts.length === 0 ? (
            <div className="py-2 text-center text-sm text-muted-foreground">
              <CheckCircle2 className="mx-auto mb-1.5 h-4 w-4 text-subtle-foreground" />
              No budget alerts
            </div>
          ) : (
            <div className="max-h-[300px] space-y-2 overflow-y-auto">
              {(alertsData?.alerts ?? []).slice(0, 10).map((a) => (
                <div
                  key={a.id}
                  className={`rounded-lg border p-2.5 text-xs ${
                    a.acknowledged
                      ? 'border-border bg-surface-muted'
                      : a.type === 'exceeded'
                        ? 'border-danger/30 bg-danger/5'
                        : 'border-warning/30 bg-warning/5'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        {a.type === 'exceeded' ? (
                          <ShieldAlert className="h-3 w-3 shrink-0 text-danger" />
                        ) : (
                          <AlertTriangle className="h-3 w-3 shrink-0 text-warning" />
                        )}
                        <span className="font-mono font-semibold text-foreground">{a.title}</span>
                      </div>
                      <div className="mt-0.5 text-muted-foreground">{a.message}</div>
                    </div>
                    {!a.acknowledged && (
                      <button
                        onClick={async () => {
                          await fetch(`/api/alerts/${a.id}/acknowledge`, {
                            method: 'POST',
                          });
                          await refetchAlerts();
                        }}
                        className="shrink-0 rounded p-1 text-subtle-foreground transition-colors hover:text-accent"
                      >
                        <CheckCircle2 className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
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
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`flex items-start justify-between gap-4 rounded-md border p-4 text-left transition-colors hover:bg-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/25 ${active ? 'border-accent bg-accent-soft' : 'border-border bg-surface'}`}
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
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`flex items-start justify-between gap-4 rounded-md border p-4 text-left transition-colors hover:bg-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/25 ${active ? 'border-accent bg-accent-soft' : 'border-border bg-surface'}`}
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

function StatusTile({
  label,
  value,
  loading,
}: {
  label: string;
  value: string;
  loading?: boolean;
}) {
  return (
    <div className="rounded-lg border border-border bg-surface-muted p-3">
      <div className="font-mono text-[9px] uppercase tracking-[0.14em] text-subtle-foreground">
        {label}
      </div>
      {loading ? (
        <Skeleton className="mt-2 h-7 w-20" />
      ) : (
        <div className="mt-1 font-mono text-[1.55rem] font-semibold tracking-[-0.05em] text-foreground">
          {value}
        </div>
      )}
    </div>
  );
}

function SummaryRow({
  label,
  value,
  loading,
}: {
  label: string;
  value: string;
  loading?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-4 text-sm">
      <span className="text-muted-foreground">{label}</span>
      {loading ? (
        <Skeleton className="h-4 w-20" />
      ) : (
        <span className="text-right font-mono font-medium text-foreground">{value}</span>
      )}
    </div>
  );
}

function ToggleRow({
  icon: Icon,
  title,
  description,
  enabled,
  loading,
  updating,
  onChange,
}: {
  icon?: LucideIcon;
  title: string;
  description: string;
  enabled: boolean;
  loading?: boolean;
  updating?: boolean;
  onChange: () => void;
}) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-lg border border-border bg-surface-elevated p-4">
      <div className="flex gap-3">
        {Icon && (
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-md border border-border bg-transparent text-subtle-foreground">
            <Icon className="h-4.5 w-4.5" />
          </div>
        )}
        <div>
          <div className="font-mono text-sm font-semibold text-foreground">{title}</div>
          <div className="mt-1 text-sm leading-6 text-muted-foreground">{description}</div>
        </div>
      </div>
      <Button
        variant={enabled ? 'default' : 'outline'}
        onClick={onChange}
        disabled={updating || loading}
      >
        {loading ? '...' : enabled ? 'Enabled' : 'Disabled'}
      </Button>
    </div>
  );
}
