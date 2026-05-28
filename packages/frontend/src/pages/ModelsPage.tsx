import { useMemo, useState } from 'react';
import { RefreshCw, Search, Sparkles } from 'lucide-react';
import { BrandBadge, BrandMark } from '../components/brand/BrandMark.js';
import { Badge } from '../components/ui/Badge.js';
import { Button } from '../components/ui/Button.js';
import { Card, CardContent } from '../components/ui/Card.js';
import { DataPanel } from '../components/ui/DataPanel.js';
import {
  DataTable,
  DataTableBody,
  DataTableCell,
  DataTableContainer,
  DataTableHead,
  DataTableHeaderCell,
  DataTableRow,
} from '../components/ui/DataTable.js';
import { EmptyState } from '../components/ui/EmptyState.js';
import { ErrorState } from '../components/ui/ErrorState.js';
import { FilterBar } from '../components/ui/FilterBar.js';
import { Input } from '../components/ui/Input.js';
import { TableSkeletonRows } from '../components/ui/LoadingState.js';
import { Select } from '../components/ui/Select.js';
import { SectionHeader } from '../components/ui/SectionHeader.js';
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

interface ProvidersResponse {
  providers: string[];
}

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

  const { data, loading, error, refetch } = useApi<{ data: ModelRow[] }>(
    `/api/models?${query.toString()}`,
  );
  const { data: providers } = useApi<ProvidersResponse>('/api/models/providers', {
    initialData: { providers: [] },
  });
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
      <div className="p-4 lg:p-6">
        <ErrorState
          title={t('models.failed')}
          message={error.message}
          code={error.code}
          details={error.details}
          onRetry={refetch}
        />
      </div>
    );
  }

  return (
    <div className="space-y-5 p-4 lg:p-6">
      <FilterBar
        actions={
          <>
            <Button
              variant={usedOnly ? 'secondary' : 'outline'}
              onClick={() => setUsedOnly((value) => !value)}
            >
              {t('models.usedOnly')}
            </Button>
            <Button onClick={syncOpenRouter} disabled={syncing}>
              <RefreshCw className={`h-4 w-4 ${syncing ? 'animate-spin' : ''}`} />
              {syncing ? t('models.syncing') : t('models.syncOpenRouter')}
            </Button>
          </>
        }
      >
        <div className="relative w-full min-w-0 flex-1 sm:min-w-[260px]">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle-foreground" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={t('models.search.placeholder')}
            className="pl-9"
          />
        </div>
        <Select
          value={provider}
          onChange={(event) => setProvider(event.target.value)}
          options={[
            { label: t('models.allProviders'), value: '' },
            ...(providers?.providers ?? []).map((item) => ({ label: item, value: item })),
          ]}
        />
        <Select
          value={sort}
          onChange={(event) => setSort(event.target.value)}
          options={[
            { label: t('models.sortRecommended'), value: 'recommended' },
            { label: t('models.sortName'), value: 'name' },
            { label: t('models.sortInput'), value: 'price-input' },
            { label: t('models.sortOutput'), value: 'price-output' },
          ]}
        />
      </FilterBar>

      {usedModels.length > 0 && (
        <section className="space-y-3">
          <SectionHeader
            title={t('models.usedTitle')}
            description={t('models.usedDescription')}
            action={<Badge variant="neutral">{usedModels.length}</Badge>}
          />
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {usedModels.map((model) => (
              <UsedModelCard
                key={`${model.provider}/${model.model_name}`}
                model={model}
                labels={{
                  sessions: t('common.sessions'),
                  spend: t('models.spend'),
                  input: t('models.inputPer1M'),
                }}
              />
            ))}
          </div>
        </section>
      )}

      <DataPanel
        title={t('models.catalogTitle')}
        description={t('models.catalogDescription')}
        action={<Badge variant="neutral">{models.length}</Badge>}
        contentClassName="p-0"
      >
        <DataTableContainer>
          <DataTable>
            <DataTableHead>
              <DataTableRow className="hover:bg-transparent">
                <DataTableHeaderCell>{t('common.provider')}</DataTableHeaderCell>
                <DataTableHeaderCell>{t('common.model')}</DataTableHeaderCell>
                <DataTableHeaderCell className="text-right">
                  {t('models.inputPer1M')}
                </DataTableHeaderCell>
                <DataTableHeaderCell className="text-right">
                  {t('models.outputPer1M')}
                </DataTableHeaderCell>
                <DataTableHeaderCell className="text-right">
                  {t('models.cachePer1M')}
                </DataTableHeaderCell>
                <DataTableHeaderCell className="text-right">
                  {t('models.usage')}
                </DataTableHeaderCell>
              </DataTableRow>
            </DataTableHead>
            <DataTableBody>
              {loading ? (
                <TableSkeletonRows rows={8} columns={6} />
              ) : (
                models.map((model) => (
                  <DataTableRow key={model.id}>
                    <DataTableCell>
                      <BrandBadge value={model.provider} kind="provider" />
                    </DataTableCell>
                    <DataTableCell>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs text-foreground">
                          {model.model_name}
                        </span>
                        {Boolean(model.is_used) && (
                          <Badge variant="success">{t('models.used')}</Badge>
                        )}
                        {!model.is_used && Boolean(model.is_popular) && (
                          <Badge variant="neutral">
                            <Sparkles className="h-3 w-3" /> {t('models.popular')}
                          </Badge>
                        )}
                      </div>
                    </DataTableCell>
                    <DataTableCell className="text-right font-mono tabular-nums text-muted-foreground">
                      {formatCurrency(model.input_cost_per_million)}
                    </DataTableCell>
                    <DataTableCell className="text-right font-mono tabular-nums font-medium text-foreground">
                      {formatCurrency(model.output_cost_per_million)}
                    </DataTableCell>
                    <DataTableCell className="text-right font-mono tabular-nums text-muted-foreground">
                      {model.cached_input_cost == null
                        ? '—'
                        : formatCurrency(model.cached_input_cost)}
                    </DataTableCell>
                    <DataTableCell className="text-right font-mono text-xs text-muted-foreground">
                      {model.usage_session_count > 0 ? (
                        <>
                          <div className="font-medium text-foreground">
                            {model.usage_session_count} {t('common.sessions').toLowerCase()}
                          </div>
                          <div>{formatCurrency(model.usage_total_cost)}</div>
                        </>
                      ) : (
                        '—'
                      )}
                    </DataTableCell>
                  </DataTableRow>
                ))
              )}
            </DataTableBody>
          </DataTable>
        </DataTableContainer>
        {!loading && models.length === 0 && (
          <div className="p-5">
            <EmptyState
              title={t('models.noPricing.title')}
              description={t('models.noPricing.description')}
            />
          </div>
        )}
      </DataPanel>
    </div>
  );
}

function UsedModelCard({
  model,
  labels,
}: {
  model: ModelRow;
  labels: { sessions: string; spend: string; input: string };
}) {
  return (
    <Card>
      <CardContent className="space-y-4">
        <div className="flex items-start gap-3">
          <BrandMark value={model.provider} kind="provider" size="md" />
          <div className="min-w-0">
            <div className="truncate font-mono text-xs font-medium text-foreground">
              {model.model_name}
            </div>
            <div className="mt-1 text-xs text-subtle-foreground">
              {model.last_used_at ? formatDate(model.last_used_at) : '—'}
            </div>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-2 rounded-lg border border-border bg-surface-muted p-2 text-center text-xs sm:grid-cols-3">
          <Metric label={labels.sessions} value={String(model.usage_session_count)} />
          <Metric label={labels.spend} value={formatCurrency(model.usage_total_cost)} />
          <Metric label={labels.input} value={formatCurrency(model.input_cost_per_million)} />
        </div>
      </CardContent>
    </Card>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="font-mono text-[10px] uppercase tracking-[0.1em] text-subtle-foreground">
        {label}
      </div>
      <div className="mt-1 truncate font-mono font-semibold text-foreground">{value}</div>
    </div>
  );
}
