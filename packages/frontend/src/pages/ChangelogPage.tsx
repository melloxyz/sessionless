import { CheckCircle2, CircleDot, Clock3, GitBranch, Layers3, Sparkles } from 'lucide-react';
import { Badge } from '../components/ui/Badge.js';
import { DataPanel } from '../components/ui/DataPanel.js';
import { SectionHeader } from '../components/ui/SectionHeader.js';
import { useI18n } from '../components/i18n/LanguageProvider.js';

const latest = [
  ['changelog.core', 'Background auto-ingestion with local filesystem watcher'],
  ['changelog.analytics', 'Real analytics filters across report, charts and breakdowns'],
  ['changelog.pricing', 'OpenRouter pricing sync with estimated cost backfill'],
];

const released = [
  {
    version: 'v0.7.1',
    title: 'Background ingestion',
    tags: ['changelog.core', 'changelog.localFirst'],
    items: [
      'Filesystem watcher for supported local CLI data sources',
      'Auto-ingestion toggle in Settings',
      'Ingestion concurrency guard for sql.js',
    ],
  },
  {
    version: 'v0.7.0',
    title: 'Sessionless foundation',
    tags: ['changelog.core', 'changelog.ui'],
    items: [
      'Sessionless branding and package rename',
      'Changelog and project status page',
      'Windows-safe dev orchestration',
    ],
  },
  {
    version: 'v0.6.4',
    title: 'Models and analytics filters',
    tags: ['changelog.analytics', 'changelog.pricing'],
    items: [
      'Model catalog search and used-model ranking',
      'Provider/model/project analytics filters',
      'OpenRouter model pricing sync',
    ],
  },
  {
    version: 'v0.6.3',
    title: 'Cost accuracy',
    tags: ['changelog.pricing', 'changelog.localFirst'],
    items: [
      'actual / estimated / unknown cost sources',
      'Token-based fallback cost estimation',
      'Backfill for sessions previously showing $0.00',
    ],
  },
  {
    version: 'v0.6.2',
    title: 'Project intelligence',
    tags: ['changelog.core'],
    items: [
      'Hide projects without deleting local folders',
      'Open project folder from session detail',
      'Git commit timeline for existing repositories',
    ],
  },
  {
    version: 'v0.6.0',
    title: 'UI polish',
    tags: ['changelog.ui'],
    items: [
      'Premium OpenCode/Linear-style shell',
      'Light and dark themes',
      'English and Portuguese interface',
    ],
  },
  {
    version: 'v0.5.0',
    title: 'CLI expansion',
    tags: ['changelog.adapters'],
    items: [
      'Gemini, Kimi, Aider, Qwen and Antigravity adapters',
      'Integration detection in sidebar',
      'Adapter-isolated parsing',
    ],
  },
  {
    version: 'v0.4.0',
    title: 'Advanced analytics',
    tags: ['changelog.analytics'],
    items: ['Insights Engine', 'Anomaly detection', 'Multi-model session usage'],
  },
  {
    version: 'v0.3.0',
    title: 'Multi-CLI core',
    tags: ['changelog.adapters'],
    items: [
      'Codex, Claude and OpenCode support',
      'Cross-provider normalization',
      'Project refresh and usage aggregation',
    ],
  },
  {
    version: 'v0.1.0',
    title: 'Local-first bootstrap',
    tags: ['changelog.core', 'changelog.localFirst'],
    items: ['pnpm monorepo', 'Fastify + Vite app shell', 'sql.js local SQLite database'],
  },
];

const inProgress = [
  'More robust adapter validation across local AI coding CLIs',
  'Better explainability for estimated cost calculations',
  'Restore hidden projects controls',
];
const planned = [
  'Local budget limits and alerts',
  'System tray integration',
  'Optional Electron runtime',
];

export function ChangelogPage() {
  const { t } = useI18n();

  return (
    <div className="space-y-5 p-4 lg:p-6">
      <DataPanel contentClassName="space-y-5 p-5">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="default" className="gap-1.5">
                <Sparkles className="h-3 w-3" /> Sessionless
              </Badge>
              <Badge variant="success">{t('changelog.current')}</Badge>
            </div>
            <h2 className="mt-4 font-mono text-3xl font-semibold tracking-[-0.06em] text-foreground">
              {t('changelog.version')}
            </h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              {t('changelog.hero.description')}
            </p>
          </div>
          <a
            href="https://github.com/melloxyz/sessionless"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 rounded-md border border-border bg-surface-elevated px-3 py-2 font-mono text-xs font-medium text-accent transition-colors hover:border-border-strong hover:text-accent-hover"
          >
            <GitBranch className="h-4 w-4" /> github.com/melloxyz/sessionless
          </a>
        </div>
      </DataPanel>

      <section className="space-y-3">
        <SectionTitle
          title={t('changelog.latest')}
          description={t('changelog.latest.description')}
        />
        <div className="grid gap-3 lg:grid-cols-3">
          {latest.map(([tag, title]) => (
            <DataPanel key={title} contentClassName="space-y-3 p-4">
              <Badge variant="neutral">{t(tag)}</Badge>
              <div className="font-mono text-sm font-medium text-foreground">{title}</div>
            </DataPanel>
          ))}
        </div>
      </section>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <section className="space-y-3">
          <SectionTitle
            title={t('changelog.released')}
            description={t('changelog.released.description')}
          />
          <div className="space-y-4">
            {released.map((entry) => (
              <ReleaseCard key={entry.version} entry={entry} />
            ))}
          </div>
        </section>

        <aside className="space-y-4">
          <RoadmapCard
            icon={Clock3}
            title={t('changelog.inProgress')}
            description={t('changelog.progress.description')}
            items={inProgress}
            tone="warning"
          />
          <RoadmapCard
            icon={Layers3}
            title={t('changelog.planned')}
            description={t('changelog.planned.description')}
            items={planned}
            tone="info"
          />
          <DataPanel title={t('changelog.status.title')} contentClassName="space-y-3 text-sm">
            <StatusRow
              label={t('changelog.status.localFirst')}
              value={t('changelog.status.active')}
            />
            <StatusRow label={t('changelog.status.pricing')} value="OpenRouter" />
            <StatusRow label={t('changelog.status.name')} value="Sessionless" />
          </DataPanel>
        </aside>
      </div>
    </div>
  );
}

function SectionTitle({ title, description }: { title: string; description: string }) {
  return <SectionHeader title={title} description={description} />;
}

function ReleaseCard({
  entry,
}: {
  entry: { version: string; title: string; tags: string[]; items: string[] };
}) {
  const { t } = useI18n();
  return (
    <DataPanel contentClassName="grid gap-0 p-0 md:grid-cols-[160px_minmax(0,1fr)]">
      <div className="border-b border-border p-5 md:border-b-0 md:border-r">
        <div className="flex items-center gap-2 font-mono text-sm font-semibold text-foreground">
          <CheckCircle2 className="h-4 w-4 text-success" />
          {entry.version}
        </div>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {entry.tags.map((tag) => (
            <Badge key={tag} variant="neutral">
              {t(tag)}
            </Badge>
          ))}
        </div>
      </div>
      <div className="p-5">
        <div className="font-mono text-sm font-semibold text-foreground">{entry.title}</div>
        <div className="mt-3 space-y-2">
          {entry.items.map((item) => (
            <div key={item} className="flex gap-2 text-sm text-muted-foreground">
              <CircleDot className="mt-1 h-3 w-3 shrink-0 fill-accent text-accent" />
              <span>{item}</span>
            </div>
          ))}
        </div>
      </div>
    </DataPanel>
  );
}

function RoadmapCard({
  icon: Icon,
  title,
  description,
  items,
  tone,
}: {
  icon: typeof Clock3;
  title: string;
  description: string;
  items: string[];
  tone: 'warning' | 'info';
}) {
  const toneClass = tone === 'warning' ? 'bg-warning-soft text-warning' : 'bg-info-soft text-info';
  return (
    <DataPanel
      title={title}
      description={description}
      contentClassName="space-y-2"
      action={
        <div className={`grid h-9 w-9 place-items-center rounded-md border ${toneClass}`}>
          <Icon className="h-4 w-4" />
        </div>
      }
    >
      {items.map((item) => (
        <div
          key={item}
          className="rounded-md border border-border bg-surface-muted p-3 text-sm text-muted-foreground"
        >
          {item}
        </div>
      ))}
    </DataPanel>
  );
}

function StatusRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 font-mono text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-foreground">{value}</span>
    </div>
  );
}
