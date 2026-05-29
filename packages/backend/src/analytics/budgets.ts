import { getDatabase, saveDatabase } from '../db/connection.js';

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
  budget_id: number | null;
  type: string;
  title: string;
  message: string;
  current_spend: number;
  limit_usd: number;
  acknowledged: number;
  created_at: string;
}

export function listBudgetLimits(): BudgetLimit[] {
  const db = getDatabase();
  const result = db.exec('SELECT * FROM budget_limits ORDER BY created_at DESC');
  if (result.length === 0 || result[0].values.length === 0) return [];
  return result[0].values.map(
    (row: unknown[]) =>
      ({
        id: Number(row[0]),
        scope_type: String(row[1]),
        scope_value: row[2] ? String(row[2]) : null,
        limit_usd: Number(row[3]),
        period: String(row[4]),
        enabled: Number(row[5]),
      }) as BudgetLimit,
  );
}

export function createBudgetLimit(params: {
  scope_type: string;
  scope_value?: string | null;
  limit_usd: number;
  period?: string;
}): BudgetLimit {
  const db = getDatabase();
  db.run(
    `INSERT INTO budget_limits (scope_type, scope_value, limit_usd, period) VALUES (?, ?, ?, ?)`,
    [params.scope_type, params.scope_value ?? null, params.limit_usd, params.period ?? 'monthly'],
  );
  saveDatabase();
  const id = db.exec('SELECT last_insert_rowid()')[0].values[0][0] as number;
  return {
    id: Number(id),
    scope_type: params.scope_type as BudgetLimit['scope_type'],
    scope_value: params.scope_value ?? null,
    limit_usd: params.limit_usd,
    period: (params.period ?? 'monthly') as BudgetLimit['period'],
    enabled: 1,
  };
}

export function updateBudgetLimit(
  id: number,
  params: {
    scope_type?: string;
    scope_value?: string | null;
    limit_usd?: number;
    period?: string;
    enabled?: boolean;
  },
): boolean {
  const db = getDatabase();
  const sets: string[] = [];
  const values: (string | number | null)[] = [];

  if (typeof params.scope_type === 'string') {
    sets.push('scope_type = ?');
    values.push(params.scope_type);
  }
  if (params.scope_value !== undefined) {
    sets.push('scope_value = ?');
    values.push(params.scope_value);
  }
  if (typeof params.limit_usd === 'number') {
    sets.push('limit_usd = ?');
    values.push(params.limit_usd);
  }
  if (typeof params.period === 'string') {
    sets.push('period = ?');
    values.push(params.period);
  }
  if (typeof params.enabled === 'boolean') {
    sets.push('enabled = ?');
    values.push(params.enabled ? 1 : 0);
  }

  if (sets.length === 0) return false;

  sets.push("updated_at = datetime('now')");
  values.push(id);

  db.run(`UPDATE budget_limits SET ${sets.join(', ')} WHERE id = ?`, values);
  saveDatabase();
  return true;
}

export function deleteBudgetLimit(id: number): boolean {
  const db = getDatabase();
  db.run('DELETE FROM budget_limits WHERE id = ?', [id]);
  saveDatabase();
  return true;
}

export function getBudgetStatus(): BudgetStatus[] {
  const db = getDatabase();
  const limits = listBudgetLimits().filter((l) => l.enabled);
  const statuses: BudgetStatus[] = [];

  for (const limit of limits) {
    let dateFilter = '';
    if (limit.period === 'daily') dateFilter = "AND started_at >= datetime('now', '-1 day')";
    else if (limit.period === 'weekly') dateFilter = "AND started_at >= datetime('now', '-7 days')";
    else if (limit.period === 'monthly')
      dateFilter = "AND started_at >= datetime('now', '-30 days')";

    let whereClause = '';
    const params: string[] = [];

    if (limit.scope_type === 'global') {
      whereClause = '1=1';
    } else if (limit.scope_type === 'project' && limit.scope_value) {
      whereClause = 'project_path = ?';
      params.push(limit.scope_value);
    } else if (limit.scope_type === 'cli' && limit.scope_value) {
      whereClause = 'cli = ?';
      params.push(limit.scope_value);
    } else if (limit.scope_type === 'model' && limit.scope_value) {
      whereClause = 'model = ?';
      params.push(limit.scope_value);
    } else if (limit.scope_type === 'provider' && limit.scope_value) {
      whereClause = 'provider = ?';
      params.push(limit.scope_value);
    } else {
      continue;
    }

    const sql = `SELECT COALESCE(SUM(total_cost_usd), 0) FROM sessions WHERE ${whereClause} ${dateFilter}`;
    const result = db.exec(sql, params);
    const currentSpend =
      result.length > 0 && result[0].values.length > 0 ? Number(result[0].values[0][0]) : 0;

    const percentage = limit.limit_usd > 0 ? (currentSpend / limit.limit_usd) * 100 : 0;
    let status: BudgetStatus['status'] = 'ok';
    if (percentage >= 100) status = 'exceeded';
    else if (percentage >= 80) status = 'approaching';
    else if (percentage >= 50) status = 'warning';

    statuses.push({
      id: limit.id,
      scope_type: limit.scope_type,
      scope_value: limit.scope_value,
      limit_usd: limit.limit_usd,
      period: limit.period,
      current_spend: Math.round(currentSpend * 10000) / 10000,
      percentage: Math.round(percentage * 100) / 100,
      status,
    });
  }

  return statuses;
}

export function checkBudgets(): AlertRow[] {
  const db = getDatabase();
  const statuses = getBudgetStatus();
  const newAlerts: AlertRow[] = [];

  for (const s of statuses) {
    if (s.status === 'ok') continue;

    const existing = db.exec(
      `SELECT id FROM alert_history WHERE budget_id = ? AND type = ? AND acknowledged = 0 AND created_at >= datetime('now', '-1 day')`,
      [s.id, s.status],
    );
    if (existing.length > 0 && existing[0].values.length > 0) continue;

    const scopeLabel = s.scope_value ?? 'All';
    const typeLabels: Record<string, string> = {
      warning: 'Budget Warning',
      approaching: 'Budget Approaching Limit',
      exceeded: 'Budget Exceeded',
    };

    const title = typeLabels[s.status] ?? 'Budget Alert';
    const message = `${scopeLabel} (${s.scope_type}): $${s.current_spend.toFixed(2)} of $${s.limit_usd.toFixed(2)} (${s.percentage}%)`;

    db.run(
      `INSERT INTO alert_history (budget_id, type, title, message, current_spend, limit_usd) VALUES (?, ?, ?, ?, ?, ?)`,
      [s.id, s.status, title, message, s.current_spend, s.limit_usd],
    );

    const alertId = db.exec('SELECT last_insert_rowid()')[0].values[0][0] as number;
    newAlerts.push({
      id: Number(alertId),
      budget_id: s.id,
      type: s.status,
      title,
      message,
      current_spend: s.current_spend,
      limit_usd: s.limit_usd,
      acknowledged: 0,
      created_at: new Date().toISOString(),
    });
  }

  if (newAlerts.length > 0) saveDatabase();
  return newAlerts;
}

export function listAlerts(limit = 50, offset = 0): { alerts: AlertRow[]; total: number } {
  const db = getDatabase();
  const countResult = db.exec('SELECT COUNT(*) FROM alert_history');
  const total = countResult.length > 0 ? Number(countResult[0].values[0][0]) : 0;

  const result = db.exec('SELECT * FROM alert_history ORDER BY created_at DESC LIMIT ? OFFSET ?', [
    limit,
    offset,
  ]);
  if (result.length === 0 || result[0].values.length === 0) return { alerts: [], total };

  const alerts = result[0].values.map(
    (row: unknown[]) =>
      ({
        id: Number(row[0]),
        budget_id: row[1] ? Number(row[1]) : null,
        type: String(row[2]),
        title: String(row[3]),
        message: String(row[4]),
        current_spend: Number(row[5]),
        limit_usd: Number(row[6]),
        acknowledged: Number(row[7]),
        created_at: String(row[8]),
      }) as AlertRow,
  );

  return { alerts, total };
}

export function acknowledgeAlert(id: number): boolean {
  const db = getDatabase();
  db.run('UPDATE alert_history SET acknowledged = 1 WHERE id = ?', [id]);
  saveDatabase();
  return true;
}

export function acknowledgeAllAlerts(): boolean {
  const db = getDatabase();
  db.run('UPDATE alert_history SET acknowledged = 1 WHERE acknowledged = 0');
  saveDatabase();
  return true;
}

export function getUnacknowledgedCount(): number {
  const db = getDatabase();
  const result = db.exec('SELECT COUNT(*) FROM alert_history WHERE acknowledged = 0');
  return result.length > 0 && result[0].values.length > 0 ? Number(result[0].values[0][0]) : 0;
}
