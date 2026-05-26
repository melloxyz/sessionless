import { Badge } from '../components/ui/Badge.js';
import { Card, CardContent } from '../components/ui/Card.js';
import { ErrorState } from '../components/ui/ErrorState.js';
import { useApi } from '../hooks/useApi.js';

interface ModelRow {
  id: number;
  provider: string;
  model_name: string;
  input_cost_per_million: number;
  output_cost_per_million: number;
  cached_input_cost: number | null;
}

export function ModelsPage() {
  const { data, loading, error, refetch } = useApi<{ data: ModelRow[] }>('/api/models');

  if (error) {
    return (
      <div className="p-6">
        <ErrorState title="Models failed to load" message={error.message} code={error.code} details={error.details} onRetry={refetch} />
      </div>
    );
  }

  return (
    <div className="p-6">
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-xs text-subtle-foreground">
                  <th className="px-5 py-3 text-left font-medium">Provider</th>
                  <th className="px-5 py-3 text-left font-medium">Model</th>
                  <th className="px-5 py-3 text-right font-medium">Input $/1M</th>
                  <th className="px-5 py-3 text-right font-medium">Output $/1M</th>
                  <th className="px-5 py-3 text-right font-medium">Cache $/1M</th>
                </tr>
              </thead>
              <tbody>
                {loading ? Array.from({ length: 8 }).map((_, row) => (
                  <tr key={row} className="border-b border-border">{Array.from({ length: 5 }).map((_, col) => <td key={col} className="px-5 py-4"><div className="h-4 w-24 animate-pulse rounded bg-surface-muted" /></td>)}</tr>
                )) : data?.data.map((model) => (
                  <tr key={model.id} className="border-b border-border transition-colors hover:bg-surface-hover">
                    <td className="px-5 py-4"><Badge variant="neutral">{model.provider}</Badge></td>
                    <td className="px-5 py-4 font-mono text-xs text-foreground">{model.model_name}</td>
                    <td className="px-5 py-4 text-right tabular-nums text-muted-foreground">${model.input_cost_per_million.toFixed(2)}</td>
                    <td className="px-5 py-4 text-right tabular-nums font-medium text-foreground">${model.output_cost_per_million.toFixed(2)}</td>
                    <td className="px-5 py-4 text-right tabular-nums text-muted-foreground">{model.cached_input_cost == null ? '—' : `$${model.cached_input_cost.toFixed(2)}`}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
