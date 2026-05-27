import { useMemo, useState } from 'react';
import { RefreshCw, Search, Sparkles } from 'lucide-react';
import { BrandBadge, BrandMark } from '../components/brand/BrandMark.js';
import { Badge } from '../components/ui/Badge.js';
import { Button } from '../components/ui/Button.js';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card.js';
import { EmptyState } from '../components/ui/EmptyState.js';
import { ErrorState } from '../components/ui/ErrorState.js';
import { Input } from '../components/ui/Input.js';
import { TableSkeletonRows } from '../components/ui/LoadingState.js';
import { Select } from '../components/ui/Select.js';
import { useI18n } from '../components/i18n/LanguageProvider.js';
import { useApi } from '../hooks/useApi.js';
import { formatCurrency, formatDate } from '../lib/format.js';

interface ModelRow {
  id: number;
  provider: string;
  model_name: string;
  input_cost_per_million: number;
  output_cost_per_million: number;
  cached_input_cost: number | null;
  usage_session_count: number;
  usage_total_cost: number;
  last_used_at: string | null;
  is_used: number;
  is_popular: number;
}

interface ProvidersResponse { providers: string[] }

export function ModelsPage() {
  const { t } = useI18n();
  const [search, setSearch] = useState('');
  const [provider, setProvider] = useState('');
  const [usedOnly, setUsedOnly] = useState(false);
  const [sort, setSort] = useState('recommended');
  const [syncing, setSyncing] = useState(false);

  const query = new URLSearchParams();
  if (search.trim()) query.set('search', search.trim());
  if (provider) query.set('provider', provider);
  if (usedOnly) query.set('usedOnly', 'true');
  if (sort) query.set('sort', sort);

  const { data, loading, error, refetch } = useApi<{ data: ModelRow[] }>(`/api/models?${query.toString()}`);
  const { data: providers } = useApi<ProvidersResponse>('/api/models/providers', { initialData: { providers: [] } });
  const models = data?.data ?? [];
  const usedModels = useMemo(() => models.filter((model) => model.is_used).slice(0, 8), [models]);

  async function syncOpenRouter() {
    setSyncing(true);
    try {
      await fetch('/api/models/sync-openrouter');
      await refetch();
    } finally {
      setSyncing(false);
    }
  }

  if (error) {
    return (
      <div className="p-6">
        <ErrorState title={t('models.failed')} message={error.message} code={error.code} details={error.details} onRetry={refetch} />
      </div>
    );
  }

  return (
    <div className="space-y-5 p-6">
      <Card>
        <CardContent className="flex flex-col gap-3 p-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex min-w-0 flex-1 flex-col gap-3 md:flex-row md:items-center">
            <div className="relative min-w-[260px] flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle-foreground" />
              <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={t('models.search.placeholder')} className="pl-9" />
            </div>
            <Select value={provider} onChange={(event) => setProvider(event.target.value)} options={[{ label: t('models.allProviders'), value: '' }, ...(providers?.providers ?? []).map((item) => ({ label: item, value: item }))]} />
            <Select value={sort} onChange={(event) => setSort(event.target.value)} options={[{ label: t('models.sortRecommended'), value: 'recommended' }, { label: t('models.sortName'), value: 'name' }, { label: t('models.sortInput'), value: 'price-input' }, { label: t('models.sortOutput'), value: 'price-output' }]} />
          </div>
          <div className="flex items-center gap-2">
            <Button variant={usedOnly ? 'secondary' : 'outline'} onClick={() => setUsedOnly((value) => !value)}>{t('models.usedOnly')}</Button>
            <Button onClick={syncOpenRouter} disabled={syncing}>
              <RefreshCw className={`h-4 w-4 ${syncing ? 'animate-spin' : ''}`} />
              {syncing ? t('models.syncing') : t('models.syncOpenRouter')}
            </Button>
          </div>
        </CardContent>
      </Card>

      {usedModels.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-foreground">{t('models.usedTitle')}</h2>
              <p className="text-xs text-subtle-foreground">{t('models.usedDescription')}</p>
            </div>
            <Badge variant="neutral">{usedModels.length}</Badge>
          </div>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {usedModels.map((model) => <UsedModelCard key={`${model.provider}/${model.model_name}`} model={model} labels={{ sessions: t('common.sessions'), spend: t('models.spend'), input: t('models.inputPer1M') }} />)}
          </div>
        </section>
      )}

      <Card>
        <CardHeader>
          <div>
            <CardTitle>{t('models.catalogTitle')}</CardTitle>
            <p className="mt-1 text-xs text-subtle-foreground">{t('models.catalogDescription')}</p>
          </div>
          <Badge variant="neutral">{models.length}</Badge>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-xs text-subtle-foreground">
                  <th className="px-5 py-3 text-left font-medium">{t('common.provider')}</th>
                  <th className="px-5 py-3 text-left font-medium">{t('common.model')}</th>
                  <th className="px-5 py-3 text-right font-medium">{t('models.inputPer1M')}</th>
                  <th className="px-5 py-3 text-right font-medium">{t('models.outputPer1M')}</th>
                  <th className="px-5 py-3 text-right font-medium">{t('models.cachePer1M')}</th>
                  <th className="px-5 py-3 text-right font-medium">{t('models.usage')}</th>
                </tr>
              </thead>
              <tbody>
                {loading ? <TableSkeletonRows rows={8} columns={6} /> : models.map((model) => (
                  <tr key={model.id} className="border-b border-border transition-colors hover:bg-surface-hover">
                    <td className="px-5 py-4"><BrandBadge value={model.provider} kind="provider" /></td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs text-foreground">{model.model_name}</span>
                        {Boolean(model.is_used) && <Badge variant="success">{t('models.used')}</Badge>}
                        {!model.is_used && Boolean(model.is_popular) && <Badge variant="neutral"><Sparkles className="h-3 w-3" /> {t('models.popular')}</Badge>}
                      </div>
                    </td>
                    <td className="px-5 py-4 text-right tabular-nums text-muted-foreground">{formatCurrency(model.input_cost_per_million)}</td>
                    <td className="px-5 py-4 text-right tabular-nums font-medium text-foreground">{formatCurrency(model.output_cost_per_million)}</td>
                    <td className="px-5 py-4 text-right tabular-nums text-muted-foreground">{model.cached_input_cost == null ? '—' : formatCurrency(model.cached_input_cost)}</td>
                    <td className="px-5 py-4 text-right text-xs text-muted-foreground">
                      {model.usage_session_count > 0 ? <><div className="font-medium text-foreground">{model.usage_session_count} {t('common.sessions').toLowerCase()}</div><div>{formatCurrency(model.usage_total_cost)}</div></> : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!loading && models.length === 0 && (
            <div className="p-5">
              <EmptyState title={t('models.noPricing.title')} description={t('models.noPricing.description')} />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function UsedModelCard({ model, labels }: { model: ModelRow; labels: { sessions: string; spend: string; input: string } }) {
  return (
    <Card>
      <CardContent className="space-y-4">
        <div className="flex items-start gap-3">
          <BrandMark value={model.provider} kind="provider" size="md" />
          <div className="min-w-0">
            <div className="truncate font-mono text-xs font-medium text-foreground">{model.model_name}</div>
            <div className="mt-1 text-xs text-subtle-foreground">{model.last_used_at ? formatDate(model.last_used_at) : '—'}</div>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2 rounded-2xl border border-border bg-surface-muted p-2 text-center text-xs">
          <Metric label={labels.sessions} value={String(model.usage_session_count)} />
          <Metric label={labels.spend} value={formatCurrency(model.usage_total_cost)} />
          <Metric label={labels.input} value={formatCurrency(model.input_cost_per_million)} />
        </div>
      </CardContent>
    </Card>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div><div className="text-[10px] text-subtle-foreground">{label}</div><div className="mt-1 truncate font-semibold text-foreground">{value}</div></div>;
}
