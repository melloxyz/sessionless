import { CheckCircle2, Database, Globe2, Languages, LockKeyhole, Moon, RefreshCw, ShieldCheck, Sun } from 'lucide-react';
import { useI18n } from '../components/i18n/LanguageProvider.js';
import { useTheme } from '../components/theme/ThemeProvider.js';
import { Badge } from '../components/ui/Badge.js';
import { Button } from '../components/ui/Button.js';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/Card.js';
import { ErrorState } from '../components/ui/ErrorState.js';
import { useApi } from '../hooks/useApi.js';
import { formatCurrency } from '../lib/format.js';

interface Overview {
  totalSpend: number;
  sessionCount: number;
  mostUsedCli: string | null;
}

export function SettingsPage() {
  const { theme, setTheme } = useTheme();
  const { locale, setLocale, t } = useI18n();
  const { data: overview, error: overviewError } = useApi<Overview>('/api/overview');
  const { data: ingestStatus, error: ingestError, refetch } = useApi<Record<string, unknown>>('/api/ingest/status');

  async function runIngestion() {
    await fetch('/api/ingest', { method: 'POST' });
    refetch();
  }

  return (
    <div className="grid gap-5 p-6 xl:grid-cols-[minmax(0,1fr)_360px]">
      <section className="space-y-5">
        <Card>
          <CardHeader>
            <div>
              <CardTitle>{t('settings.appearance')}</CardTitle>
              <CardDescription>Choose how AIMeter looks on this machine.</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            <button onClick={() => setTheme('light')} className={`rounded-2xl border p-4 text-left transition-all hover:bg-surface-hover ${theme === 'light' ? 'border-accent bg-accent-soft' : 'border-border bg-surface'}`}>
              <Sun className="mb-4 h-5 w-5 text-warning" />
              <div className="font-medium text-foreground">Light</div>
              <div className="mt-1 text-sm text-muted-foreground">Clean Linear-style surfaces.</div>
            </button>
            <button onClick={() => setTheme('dark')} className={`rounded-2xl border p-4 text-left transition-all hover:bg-surface-hover ${theme === 'dark' ? 'border-accent bg-accent-soft' : 'border-border bg-surface'}`}>
              <Moon className="mb-4 h-5 w-5 text-accent" />
              <div className="font-medium text-foreground">Dark</div>
              <div className="mt-1 text-sm text-muted-foreground">OpenCode-inspired OLED theme.</div>
            </button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div>
              <CardTitle>{t('settings.language')}</CardTitle>
              <CardDescription>Interface language is stored locally in your browser.</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            <LanguageButton active={locale === 'en'} label="English" description="Default UI language" onClick={() => setLocale('en')} />
            <LanguageButton active={locale === 'pt-BR'} label="Português" description="Interface em português do Brasil" onClick={() => setLocale('pt-BR')} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div>
              <CardTitle>{t('settings.privacy')}</CardTitle>
              <CardDescription>AIMeter is local-first by design.</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-3">
            <PrivacyItem icon={ShieldCheck} title="No telemetry" description="No product analytics are sent externally." />
            <PrivacyItem icon={LockKeyhole} title="Local prompts" description="Prompts and responses stay on disk." />
            <PrivacyItem icon={Database} title="SQLite database" description="Data is persisted locally only." />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div>
              <CardTitle>{t('settings.ingestion')}</CardTitle>
              <CardDescription>Refresh indexed data from supported AI CLIs.</CardDescription>
            </div>
            <Button onClick={runIngestion}><RefreshCw className="h-4 w-4" /> Run ingestion</Button>
          </CardHeader>
          <CardContent>
            {ingestError ? (
              <ErrorState title="Ingestion status failed" message={ingestError.message} code={ingestError.code} details={ingestError.details} onRetry={refetch} />
            ) : (
              <pre className="max-h-64 overflow-auto rounded-2xl border border-border bg-surface-muted p-4 text-xs text-muted-foreground">{JSON.stringify(ingestStatus ?? {}, null, 2)}</pre>
            )}
          </CardContent>
        </Card>
      </section>

      <aside className="space-y-5">
        <Card>
          <CardHeader><CardTitle>Workspace Summary</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {overviewError && <ErrorState title="Overview failed to load" message={overviewError.message} code={overviewError.code} details={overviewError.details} onRetry={refetch} />}
            <SummaryRow label="Sessions" value={String(overview?.sessionCount ?? 0)} />
            <SummaryRow label="Total spend" value={formatCurrency(overview?.totalSpend)} />
            <SummaryRow label="Top CLI" value={overview?.mostUsedCli ?? '—'} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>{t('settings.integrations')}</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {['Codex CLI', 'OpenCode', 'Claude Code'].map((name) => (
              <div key={name} className="flex items-center justify-between rounded-2xl border border-border bg-surface-muted p-3">
                <div className="flex items-center gap-3">
                  <div className="grid h-8 w-8 place-items-center rounded-xl bg-surface-elevated"><Globe2 className="h-4 w-4 text-accent" /></div>
                  <span className="text-sm font-medium text-foreground">{name}</span>
                </div>
                <Badge variant="success">Detected</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      </aside>
    </div>
  );
}

function LanguageButton({ active, label, description, onClick }: { active: boolean; label: string; description: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className={`flex items-start justify-between gap-4 rounded-2xl border p-4 text-left transition-all hover:bg-surface-hover ${active ? 'border-accent bg-accent-soft' : 'border-border bg-surface'}`}>
      <div>
        <Languages className="mb-4 h-5 w-5 text-accent" />
        <div className="font-medium text-foreground">{label}</div>
        <div className="mt-1 text-sm text-muted-foreground">{description}</div>
      </div>
      {active && <CheckCircle2 className="h-5 w-5 text-accent" />}
    </button>
  );
}

function PrivacyItem({ icon: Icon, title, description }: { icon: typeof ShieldCheck; title: string; description: string }) {
  return <div className="rounded-2xl border border-border bg-surface-muted p-4"><Icon className="mb-4 h-5 w-5 text-accent" /><div className="font-medium text-foreground">{title}</div><div className="mt-1 text-sm text-muted-foreground">{description}</div></div>;
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return <div className="flex justify-between gap-4 text-sm"><span className="text-muted-foreground">{label}</span><span className="font-medium text-foreground">{value}</span></div>;
}
