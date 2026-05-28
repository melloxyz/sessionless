import { CheckCircle2, CircleDot, GitBranch, Sparkles, type LucideIcon } from 'lucide-react';
import { type ReactNode } from 'react';
import { Badge } from '../components/ui/Badge.js';
import { DataPanel } from '../components/ui/DataPanel.js';
import { useI18n } from '../components/i18n/LanguageProvider.js';

const releaseTimeline = [
  { key: 'changelog.released.10', tags: ['changelog.ui', 'changelog.i18n'] },
  { key: 'changelog.released.0', tags: ['changelog.core', 'changelog.localFirst'] },
  { key: 'changelog.released.1', tags: ['changelog.core', 'changelog.ui'] },
  { key: 'changelog.released.2', tags: ['changelog.analytics', 'changelog.pricing'] },
  { key: 'changelog.released.3', tags: ['changelog.pricing', 'changelog.localFirst'] },
  { key: 'changelog.released.4', tags: ['changelog.core'] },
  { key: 'changelog.released.5', tags: ['changelog.ui'] },
  { key: 'changelog.released.6', tags: ['changelog.adapters'] },
  { key: 'changelog.released.7', tags: ['changelog.analytics'] },
  { key: 'changelog.released.8', tags: ['changelog.adapters'] },
  { key: 'changelog.released.9', tags: ['changelog.core', 'changelog.localFirst'] },
];

const contributors = [
  {
    name: 'Mello',
    github: 'melloxyz',
    roleKey: 'changelog.contributors.mello.role',
  },
];

export function ChangelogPage() {
  const { t } = useI18n();

  return (
    <div className="flex min-h-full flex-col gap-4 overflow-auto p-4 lg:p-6 xl:h-full xl:min-h-0 xl:overflow-hidden">
      <DataPanel contentClassName="p-3 lg:p-4">
        <div className="flex min-w-0 flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <Badge variant="default" className="gap-1.5">
              <Sparkles className="h-3 w-3" /> Sessionless
            </Badge>
            <span className="font-mono text-sm font-semibold tracking-[-0.03em] text-foreground">
              Changelog
            </span>
            <Badge variant="neutral">{t('changelog.version')}</Badge>
            <Badge variant="success">{t('changelog.current')}</Badge>
          </div>

          <div className="flex flex-wrap gap-2 lg:justify-end">
            <ActionLink href="https://github.com/melloxyz/sessionless" icon={GitBranch}>
              {t('changelog.status.repository')}
            </ActionLink>
            <ActionLink href="https://github.com/melloxyz/sessionless/releases" icon={CheckCircle2}>
              {t('changelog.status.releases')}
            </ActionLink>
            <ActionLink href="https://github.com/melloxyz/sessionless/issues" icon={CircleDot}>
              {t('changelog.status.issues')}
            </ActionLink>
          </div>
        </div>
      </DataPanel>

      <div className="grid min-h-0 flex-1 gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
        <section className="flex min-h-0 min-w-0 flex-col gap-2 overflow-x-hidden">
          <div className="flex items-end justify-between gap-2 px-1">
            <div>
              <h3 className="font-mono text-xs uppercase tracking-[0.22em] text-muted-foreground">
                Timeline
              </h3>
              <p className="mt-1 max-w-2xl text-xs text-subtle-foreground">
                {t('changelog.timeline.description')}
              </p>
            </div>
          </div>

          <DataPanel
            className="min-h-0 flex-1"
            contentClassName="h-full overflow-y-auto overflow-x-hidden p-2 lg:p-3"
          >
            <div className="space-y-2">
              {releaseTimeline.map((entry) => (
                <TimelineItem key={entry.key} entryKey={entry.key} tags={entry.tags} />
              ))}
            </div>
          </DataPanel>
        </section>

        <aside className="min-w-0 space-y-4 overflow-x-hidden">
          <section className="space-y-3">
            <div className="px-1">
              <h3 className="font-mono text-xs uppercase tracking-[0.22em] text-muted-foreground">
                {t('changelog.contributors.title')}
              </h3>
              <p className="mt-1 text-xs text-subtle-foreground">
                {t('changelog.contributors.description')}
              </p>
            </div>
            <div className="space-y-3">
              {contributors.map((c) => (
                <a
                  key={c.github}
                  href={`https://github.com/${c.github}`}
                  target="_blank"
                  rel="noreferrer"
                  className="group block"
                >
                  <DataPanel contentClassName="flex items-center gap-4 p-4 transition-colors group-hover:bg-surface-hover">
                    <img
                      src={`https://avatars.githubusercontent.com/${c.github}`}
                      alt={c.name}
                      className="h-12 w-12 shrink-0 rounded-full border border-border"
                      loading="lazy"
                    />
                    <div className="min-w-0">
                      <div className="font-mono text-sm font-semibold text-foreground transition-colors group-hover:text-accent">
                        {c.name}
                      </div>
                      <div className="mt-0.5 text-xs text-muted-foreground">{t(c.roleKey)}</div>
                      <div className="mt-1 truncate font-mono text-[10px] text-subtle-foreground">
                        github.com/{c.github}
                      </div>
                    </div>
                  </DataPanel>
                </a>
              ))}
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}

function ActionLink({
  href,
  icon: Icon,
  children,
}: {
  href: string;
  icon: LucideIcon;
  children: ReactNode;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="inline-flex max-w-full items-center gap-2 rounded-md border border-border bg-surface-elevated px-3 py-2 font-mono text-xs font-medium text-accent transition-colors hover:border-border-strong hover:text-accent-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/25"
    >
      <Icon className="h-4 w-4 shrink-0" />
      <span className="truncate">{children}</span>
    </a>
  );
}

function TimelineItem({ entryKey, tags }: { entryKey: string; tags: string[] }) {
  const { t } = useI18n();
  const items = [1, 2, 3].map((n) => t(`${entryKey}.${n}`));

  return (
    <DataPanel
      className="overflow-hidden"
      contentClassName="space-y-2.5 overflow-x-hidden border-l-2 border-l-accent/35 p-3 pl-4 lg:px-4 lg:py-3 lg:pl-5"
    >
      <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1.5">
        <span className="font-mono text-xs font-semibold text-accent">
          {t(`${entryKey}.version`)}
        </span>
        <span className="text-xs text-subtle-foreground">|</span>
        <div className="flex flex-wrap gap-1.5">
          {tags.map((tag) => (
            <Badge key={tag} variant="neutral" className="px-1.5 py-0.5">
              {t(tag)}
            </Badge>
          ))}
        </div>
      </div>

      <h4 className="font-mono text-sm font-semibold tracking-[-0.02em] text-foreground">
        {t(`${entryKey}.title`)}
      </h4>

      <ul className="space-y-1.5 text-sm leading-5 text-muted-foreground">
        {items.map((item) => (
          <li key={item} className="flex gap-2">
            <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-subtle-foreground" />
            {item}
          </li>
        ))}
      </ul>
    </DataPanel>
  );
}
