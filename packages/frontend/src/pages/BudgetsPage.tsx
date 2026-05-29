import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  CheckCircle2,
  Plus,
  ShieldAlert,
  Trash2,
  WalletCards,
  X,
} from 'lucide-react';
import { useApi } from '../hooks/useApi.js';
import { Badge } from '../components/ui/Badge.js';
import { Button } from '../components/ui/Button.js';
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
import { SectionHeader } from '../components/ui/SectionHeader.js';
import { formatCurrency, formatDateTime } from '../lib/format.js';

interface BudgetLimit {
  id: number;
  scope_type: 'global' | 'project' | 'cli' | 'model' | 'provider';
  scope_value: string | null;
  limit_usd: number;
  period: 'daily' | 'weekly' | 'monthly' | 'all_time';
  enabled: number;
}

interface BudgetStatus {
  id: number;
  scope_type: string;
  scope_value: string | null;
  limit_usd: number;
  period: string;
  current_spend: number;
  percentage: number;
  status: 'ok' | 'warning' | 'approaching' | 'exceeded';
}

interface AlertRow {
  id: number;
  type: string;
  title: string;
  message: string;
  current_spend: number;
  limit_usd: number;
  acknowledged: number;
  created_at: string;
}

export function BudgetsPage() {
  const {
    data: budgets,
    loading: budgetsLoading,
    error: budgetsError,
    refetch: refetchBudgets,
  } = useApi<BudgetLimit[]>('/api/budgets', { initialData: [] });

  const {
    data: status,
    loading: statusLoading,
    refetch: refetchStatus,
  } = useApi<BudgetStatus[]>('/api/budgets/status', { initialData: [] });

  const {
    data: alertsData,
    loading: alertsLoading,
    refetch: refetchAlerts,
  } = useApi<{ alerts: AlertRow[]; total: number }>('/api/alerts', {
    initialData: { alerts: [], total: 0 },
  });

  const [showForm, setShowForm] = useState(false);
  const [formScope, setFormScope] = useState('global');
  const [formScopeValue, setFormScopeValue] = useState('');
  const [formLimit, setFormLimit] = useState('');
  const [formPeriod, setFormPeriod] = useState('monthly');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  async function handleCreate() {
    const limitUsd = parseFloat(formLimit);
    if (isNaN(limitUsd) || limitUsd <= 0) {
      setFormError('Enter a valid amount greater than 0');
      return;
    }

    setSaving(true);
    setFormError(null);
    try {
      const res = await fetch('/api/budgets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scope_type: formScope,
          scope_value: formScopeValue || null,
          limit_usd: limitUsd,
          period: formPeriod,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      setShowForm(false);
      setFormScope('global');
      setFormScopeValue('');
      setFormLimit('');
      setFormPeriod('monthly');
      await Promise.all([refetchBudgets(), refetchStatus()]);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: number) {
    await fetch(`/api/budgets/${id}`, { method: 'DELETE' });
    await Promise.all([refetchBudgets(), refetchStatus()]);
  }

  const unacknowledgedAlerts = (alertsData?.alerts ?? []).filter((a) => !a.acknowledged);

  const scopeLabels: Record<string, string> = {
    global: 'Global',
    project: 'Project',
    cli: 'CLI',
    model: 'Model',
    provider: 'Provider',
  };

  const periodLabels: Record<string, string> = {
    daily: 'Daily',
    weekly: 'Weekly',
    monthly: 'Monthly',
    all_time: 'All time',
  };

  return (
    <div className="grid gap-4 p-4 lg:p-6 xl:grid-cols-[minmax(0,1fr)_360px]">
      <section className="space-y-5">
        <SectionHeader
          title="Budget Limits"
          description="Set spending limits per project, CLI, model or globally."
          action={
            <Button onClick={() => setShowForm(true)} disabled={showForm}>
              <Plus className="h-4 w-4" />
              Add Budget
            </Button>
          }
        />

        {budgetsError ? (
          <ErrorState
            title="Failed to load budgets"
            message={budgetsError.message}
            code={budgetsError.code}
            details={budgetsError.details}
            onRetry={refetchBudgets}
          />
        ) : budgetsLoading && !budgets ? (
          <DataPanel contentClassName="p-3">
            <DataTableContainer>
              <DataTable>
                <DataTableHead>
                  <DataTableHeaderCell>Scope</DataTableHeaderCell>
                  <DataTableHeaderCell>Value</DataTableHeaderCell>
                  <DataTableHeaderCell>Limit</DataTableHeaderCell>
                  <DataTableHeaderCell>Period</DataTableHeaderCell>
                  <DataTableHeaderCell />
                </DataTableHead>
              </DataTable>
            </DataTableContainer>
          </DataPanel>
        ) : (budgets ?? []).length === 0 ? (
          <DataPanel contentClassName="p-3">
            <EmptyState
              title="No budget limits"
              description="Create your first budget limit to track spending."
              icon={WalletCards}
            />
          </DataPanel>
        ) : (
          <DataPanel contentClassName="p-0">
            <DataTableContainer>
              <DataTable>
                <DataTableHead>
                  <DataTableHeaderCell>Scope</DataTableHeaderCell>
                  <DataTableHeaderCell>Value</DataTableHeaderCell>
                  <DataTableHeaderCell>Limit</DataTableHeaderCell>
                  <DataTableHeaderCell>Period</DataTableHeaderCell>
                  <DataTableHeaderCell />
                </DataTableHead>
                <DataTableBody>
                  {(budgets ?? []).map((b) => (
                    <DataTableRow key={b.id}>
                      <DataTableCell>
                        <Badge variant="neutral">{scopeLabels[b.scope_type] ?? b.scope_type}</Badge>
                      </DataTableCell>
                      <DataTableCell>
                        <span className="font-mono text-sm text-foreground">
                          {b.scope_value ? (
                            b.scope_type === 'project' ? (
                              <Link to="/projects" className="text-accent hover:underline">
                                {b.scope_value.split(/[/\\]/).pop() ?? b.scope_value}
                              </Link>
                            ) : (
                              b.scope_value
                            )
                          ) : (
                            <span className="text-subtle-foreground">—</span>
                          )}
                        </span>
                      </DataTableCell>
                      <DataTableCell>
                        <span className="font-mono text-sm font-semibold text-foreground">
                          {formatCurrency(b.limit_usd)}
                        </span>
                      </DataTableCell>
                      <DataTableCell>
                        <span className="text-sm text-muted-foreground">
                          {periodLabels[b.period] ?? b.period}
                        </span>
                      </DataTableCell>
                      <DataTableCell>
                        <button
                          onClick={() => handleDelete(b.id)}
                          className="rounded p-1 text-subtle-foreground transition-colors hover:text-danger"
                          aria-label="Delete budget"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </DataTableCell>
                    </DataTableRow>
                  ))}
                </DataTableBody>
              </DataTable>
            </DataTableContainer>
          </DataPanel>
        )}

        {showForm && (
          <DataPanel title="New Budget Limit" contentClassName="space-y-4">
            {formError && (
              <div className="rounded-lg border border-danger/30 bg-danger/5 p-3 font-mono text-sm text-danger">
                {formError}
              </div>
            )}

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">Scope Type</label>
                <select
                  value={formScope}
                  onChange={(e) => setFormScope(e.target.value)}
                  className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground focus:border-accent focus:outline-none"
                >
                  <option value="global">Global</option>
                  <option value="project">Project</option>
                  <option value="cli">CLI</option>
                  <option value="model">Model</option>
                  <option value="provider">Provider</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">Period</label>
                <select
                  value={formPeriod}
                  onChange={(e) => setFormPeriod(e.target.value)}
                  className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground focus:border-accent focus:outline-none"
                >
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                  <option value="all_time">All time</option>
                </select>
              </div>
            </div>

            {formScope !== 'global' && (
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">
                  {formScope === 'project'
                    ? 'Project path'
                    : formScope === 'cli'
                      ? 'CLI name (e.g. codex, claude)'
                      : formScope === 'model'
                        ? 'Model name (e.g. claude-opus-4)'
                        : 'Provider name (e.g. anthropic)'}
                </label>
                <input
                  type="text"
                  value={formScopeValue}
                  onChange={(e) => setFormScopeValue(e.target.value)}
                  placeholder={
                    formScope === 'project'
                      ? '/path/to/project'
                      : formScope === 'cli'
                        ? 'codex'
                        : 'claude-opus-4'
                  }
                  className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground placeholder:text-subtle-foreground focus:border-accent focus:outline-none"
                />
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">Limit (USD)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={formLimit}
                onChange={(e) => setFormLimit(e.target.value)}
                placeholder="50.00"
                className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground placeholder:text-subtle-foreground focus:border-accent focus:outline-none"
              />
            </div>

            <div className="flex gap-2">
              <Button onClick={handleCreate} disabled={saving}>
                {saving ? 'Saving' : 'Create Budget'}
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setShowForm(false);
                  setFormError(null);
                }}
              >
                <X className="h-4 w-4" />
                Cancel
              </Button>
            </div>
          </DataPanel>
        )}

        <div className="flex items-end justify-between gap-2 px-1">
          <SectionHeader
            title="Status"
            description="Current spending against your budget limits."
          />
        </div>

        {statusLoading && (!status || status.length === 0) ? (
          <DataPanel contentClassName="p-3">
            <EmptyState
              title="Loading"
              description="Checking budget status..."
              icon={WalletCards}
            />
          </DataPanel>
        ) : (status ?? []).length === 0 ? (
          <DataPanel contentClassName="p-3">
            <EmptyState
              title="No budget status"
              description="Create a budget limit to see spending status."
              icon={WalletCards}
            />
          </DataPanel>
        ) : (
          <DataPanel contentClassName="p-0">
            <DataTableContainer>
              <DataTable>
                <DataTableHead>
                  <DataTableHeaderCell>Scope</DataTableHeaderCell>
                  <DataTableHeaderCell>Spent / Limit</DataTableHeaderCell>
                  <DataTableHeaderCell>Period</DataTableHeaderCell>
                  <DataTableHeaderCell>Status</DataTableHeaderCell>
                </DataTableHead>
                <DataTableBody>
                  {(status ?? []).map((s) => (
                    <DataTableRow key={`${s.id}-${s.scope_type}-${s.scope_value}`}>
                      <DataTableCell>
                        <div className="flex flex-col">
                          <span className="text-sm text-foreground">
                            {scopeLabels[s.scope_type] ?? s.scope_type}
                          </span>
                          {s.scope_value && (
                            <span className="font-mono text-xs text-subtle-foreground">
                              {s.scope_value}
                            </span>
                          )}
                        </div>
                      </DataTableCell>
                      <DataTableCell>
                        <div className="flex flex-col">
                          <span className="font-mono text-sm font-semibold text-foreground">
                            {formatCurrency(s.current_spend)} / {formatCurrency(s.limit_usd)}
                          </span>
                          <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-surface-muted">
                            <div
                              className={`h-full rounded-full transition-all ${
                                s.status === 'exceeded'
                                  ? 'bg-danger'
                                  : s.status === 'approaching'
                                    ? 'bg-warning'
                                    : s.status === 'warning'
                                      ? 'bg-amber-400'
                                      : 'bg-accent'
                              }`}
                              style={{ width: `${Math.min(s.percentage, 100)}%` }}
                            />
                          </div>
                        </div>
                      </DataTableCell>
                      <DataTableCell>
                        <span className="text-sm text-muted-foreground">
                          {periodLabels[s.period] ?? s.period}
                        </span>
                      </DataTableCell>
                      <DataTableCell>
                        <Badge
                          variant={
                            s.status === 'exceeded'
                              ? 'danger'
                              : s.status === 'approaching'
                                ? 'warning'
                                : s.status === 'warning'
                                  ? 'warning'
                                  : 'success'
                          }
                        >
                          {s.status === 'ok'
                            ? 'OK'
                            : s.status === 'warning'
                              ? `${s.percentage}%`
                              : s.status === 'approaching'
                                ? `${s.percentage}%`
                                : 'Exceeded'}
                        </Badge>
                      </DataTableCell>
                    </DataTableRow>
                  ))}
                </DataTableBody>
              </DataTable>
            </DataTableContainer>
          </DataPanel>
        )}
      </section>

      <aside className="space-y-5">
        <DataPanel
          title="Alert History"
          action={
            unacknowledgedAlerts.length > 0 ? (
              <Badge variant="danger">{unacknowledgedAlerts.length}</Badge>
            ) : (
              <Badge variant="success">{alertsData?.alerts.length ?? 0}</Badge>
            )
          }
          contentClassName="p-3 space-y-3"
        >
          {alertsLoading && !alertsData ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="rounded-lg border border-border bg-surface-muted p-3">
                  <div className="h-4 w-24 animate-pulse rounded bg-surface-hover" />
                  <div className="mt-1 h-3 w-48 animate-pulse rounded bg-surface-hover" />
                </div>
              ))}
            </div>
          ) : alertsData && alertsData.total === 0 ? (
            <div className="py-2 text-center text-sm text-muted-foreground">
              <CheckCircle2 className="mx-auto mb-2 h-5 w-5 text-subtle-foreground" />
              No alerts yet
            </div>
          ) : (
            <div className="max-h-[400px] space-y-2 overflow-y-auto">
              {(alertsData?.alerts ?? []).slice(0, 20).map((a) => (
                <div
                  key={a.id}
                  className={`rounded-lg border p-2.5 text-sm ${
                    a.acknowledged
                      ? 'border-border bg-surface-muted'
                      : a.type === 'exceeded'
                        ? 'border-danger/30 bg-danger/5'
                        : a.type === 'approaching'
                          ? 'border-warning/30 bg-warning/5'
                          : 'border-amber-400/30 bg-amber-50/5'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        {a.type === 'exceeded' ? (
                          <ShieldAlert className="h-3.5 w-3.5 text-danger" />
                        ) : (
                          <AlertTriangle className="h-3.5 w-3.5 text-warning" />
                        )}
                        <span className="font-mono text-xs font-semibold text-foreground">
                          {a.title}
                        </span>
                        {a.acknowledged ? (
                          <Badge variant="neutral">Seen</Badge>
                        ) : (
                          <Badge variant={a.type === 'exceeded' ? 'danger' : 'warning'}>New</Badge>
                        )}
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground">{a.message}</div>
                      <div className="mt-1 font-mono text-[10px] text-subtle-foreground">
                        {formatDateTime(a.created_at)}
                      </div>
                    </div>
                    {!a.acknowledged && (
                      <button
                        onClick={async () => {
                          await fetch(`/api/alerts/${a.id}/acknowledge`, { method: 'POST' });
                          await refetchAlerts();
                        }}
                        className="shrink-0 rounded p-1 text-subtle-foreground transition-colors hover:text-accent"
                        aria-label="Acknowledge"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </DataPanel>

        <DataPanel title="Quick Summary" contentClassName="p-3 space-y-3 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Active budgets</span>
            <span className="font-mono font-medium text-foreground">
              {(budgets ?? []).filter((b) => b.enabled).length}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Exceeded</span>
            <span className="font-mono font-medium text-danger">
              {(status ?? []).filter((s) => s.status === 'exceeded').length}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Unread alerts</span>
            <span className="font-mono font-medium text-warning">
              {unacknowledgedAlerts.length}
            </span>
          </div>
        </DataPanel>
      </aside>
    </div>
  );
}
