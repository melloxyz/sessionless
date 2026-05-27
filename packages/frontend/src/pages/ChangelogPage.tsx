import { CheckCircle2, CircleDot, Clock3, GitBranch, Sparkles } from 'lucide-react';
import { Badge } from '../components/ui/Badge.js';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card.js';
import { useI18n } from '../components/i18n/LanguageProvider.js';

const entries = [
  {
    version: '0.6.4',
    status: 'shipped',
    icon: CheckCircle2,
    titleKey: 'changelog.entry.models.title',
    date: '2026-05-26',
    items: ['changelog.entry.models.1', 'changelog.entry.models.2', 'changelog.entry.models.3'],
  },
  {
    version: '0.6.3',
    status: 'shipped',
    icon: CheckCircle2,
    titleKey: 'changelog.entry.costs.title',
    date: '2026-05-26',
    items: ['changelog.entry.costs.1', 'changelog.entry.costs.2', 'changelog.entry.costs.3'],
  },
  {
    version: '0.6.2',
    status: 'shipped',
    icon: CheckCircle2,
    titleKey: 'changelog.entry.ui.title',
    date: '2026-05-26',
    items: ['changelog.entry.ui.1', 'changelog.entry.ui.2', 'changelog.entry.ui.3'],
  },
  {
    version: 'Next',
    status: 'in-progress',
    icon: Clock3,
    titleKey: 'changelog.entry.next.title',
    date: 'In progress',
    items: ['changelog.entry.next.1', 'changelog.entry.next.2', 'changelog.entry.next.3'],
  },
];

export function ChangelogPage() {
  const { t } = useI18n();

  return (
    <div className="space-y-6 p-6">
      <Card className="overflow-hidden">
        <CardContent className="relative p-6">
          <div className="absolute right-6 top-6 hidden h-24 w-24 rounded-full bg-accent-soft blur-2xl md:block" />
          <div className="relative max-w-2xl">
            <Badge variant="default" className="gap-1.5"><Sparkles className="h-3 w-3" /> Sessionless</Badge>
            <h2 className="mt-4 text-2xl font-semibold tracking-[-0.05em] text-foreground">{t('changelog.hero.title')}</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">{t('changelog.hero.description')}</p>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
        <section className="space-y-4">
          {entries.map((entry, index) => {
            const Icon = entry.icon;
            return (
              <Card key={entry.version}>
                <CardContent className="p-0">
                  <div className="grid gap-0 md:grid-cols-[150px_minmax(0,1fr)]">
                    <div className="border-b border-border p-5 md:border-b-0 md:border-r">
                      <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                        <Icon className="h-4 w-4 text-accent" />
                        {entry.version}
                      </div>
                      <div className="mt-2 text-xs text-subtle-foreground">{entry.date}</div>
                    </div>
                    <div className="p-5">
                      <div className="mb-3 flex flex-wrap items-center gap-2">
                        <h3 className="font-semibold text-foreground">{t(entry.titleKey)}</h3>
                        <Badge variant={entry.status === 'shipped' ? 'success' : 'warning'}>{entry.status === 'shipped' ? t('changelog.shipped') : t('changelog.inProgress')}</Badge>
                      </div>
                      <div className="space-y-2">
                        {entry.items.map((item) => (
                          <div key={item} className="flex gap-2 text-sm text-muted-foreground">
                            <CircleDot className="mt-1 h-3 w-3 shrink-0 fill-accent text-accent" />
                            <span>{t(item)}</span>
                          </div>
                        ))}
                      </div>
                      {index < entries.length - 1 && <div className="mt-5 h-px bg-border md:hidden" />}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </section>

        <aside className="space-y-4">
          <Card>
            <CardHeader><CardTitle>{t('changelog.status.title')}</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-sm">
              <StatusRow label={t('changelog.status.localFirst')} value={t('changelog.status.active')} />
              <StatusRow label={t('changelog.status.pricing')} value="OpenRouter" />
              <StatusRow label={t('changelog.status.name')} value="Sessionless" />
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>{t('changelog.github.title')}</CardTitle></CardHeader>
            <CardContent>
              <a href="https://github.com/melloxyz/sessionless" target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 text-sm font-medium text-accent hover:text-accent-hover">
                <GitBranch className="h-4 w-4" />
                github.com/melloxyz/sessionless
              </a>
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}

function StatusRow({ label, value }: { label: string; value: string }) {
  return <div className="flex justify-between gap-4"><span className="text-muted-foreground">{label}</span><span className="font-medium text-foreground">{value}</span></div>;
}
