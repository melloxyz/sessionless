import type { FastifyInstance } from 'fastify';
import { getDatabase } from '../db/connection.js';
import { buildAnalyticsReport } from '../analytics/engine.js';

const VALID_SESSION_SQL = `NOT (
  session_id = 'unknown'
  AND (project_path IS NULL OR project_path = 'unknown')
  AND (model IS NULL OR model = 'unknown')
  AND COALESCE(message_count, 0) = 0
  AND COALESCE(tool_call_count, 0) = 0
  AND COALESCE(total_cost_usd, 0) = 0
)`;

export function registerAnalyticsRoutes(app: FastifyInstance): void {
  app.get('/api/analytics/report', async () => {
    return buildAnalyticsReport();
  });

  app.get('/api/analytics/spend-over-time', async (req) => {
    const q = req.query as Record<string, string>;
    const granularity = q.granularity || 'day';
    const cli = q.cli || null;
    const dateFrom = q.dateFrom || null;
    const dateTo = q.dateTo || null;

    const db = getDatabase();
    const fmt = granularity === 'month' ? '%Y-%m' : granularity === 'week' ? '%Y-%W' : '%Y-%m-%d';
    const labelFmt = granularity === 'month' ? "strftime('%Y-%m', started_at)" :
                     granularity === 'week' ? "strftime('%Y-%W', started_at)" :
                     "date(started_at)";

    let sql = `
      SELECT
        ${labelFmt} AS period,
        COALESCE(SUM(total_cost_usd), 0) AS total_spend,
        COALESCE(SUM((SELECT SUM(input_tokens + output_tokens) FROM usage_events WHERE session_fk = sessions.id)), 0) AS total_tokens,
        COUNT(*) AS session_count
      FROM sessions
      WHERE ${VALID_SESSION_SQL} AND total_cost_usd IS NOT NULL
    `;
    const params: (string | number | null)[] = [];

    if (cli) { sql += ` AND cli = ?`; params.push(cli); }
    if (dateFrom) { sql += ` AND started_at >= ?`; params.push(dateFrom); }
    if (dateTo) { sql += ` AND started_at <= ?`; params.push(dateTo); }

    sql += ` GROUP BY period ORDER BY period`;

    const results = db.exec(sql, params);
    const points: { date: string; spend: number; tokens: number; sessions: number }[] = [];

    if (results.length > 0 && results[0].values) {
      for (const r of results[0].values) {
        points.push({
          date: r[0] as string,
          spend: Number(r[1]) || 0,
          tokens: Number(r[2]) || 0,
          sessions: Number(r[3]) || 0,
        });
      }
    }

    return { points };
  });

  app.get('/api/analytics/tokens-over-time', async (req) => {
    const q = req.query as Record<string, string>;
    const cli = q.cli || null;
    const dateFrom = q.dateFrom || null;
    const dateTo = q.dateTo || null;

    const db = getDatabase();

    let sql = `
      SELECT
        date(ue.timestamp) AS day,
        SUM(ue.input_tokens) AS input_tokens,
        SUM(ue.output_tokens) AS output_tokens,
        SUM(ue.cache_read_tokens) AS cache_read_tokens,
        SUM(ue.cache_write_tokens) AS cache_write_tokens
      FROM usage_events ue
      JOIN sessions s ON s.id = ue.session_fk
      WHERE ${VALID_SESSION_SQL}
    `;
    const params: (string | number | null)[] = [];

    if (cli) { sql += ` AND s.cli = ?`; params.push(cli); }
    if (dateFrom) { sql += ` AND ue.timestamp >= ?`; params.push(dateFrom); }
    if (dateTo) { sql += ` AND ue.timestamp <= ?`; params.push(dateTo); }

    sql += ` GROUP BY day ORDER BY day`;

    const results = db.exec(sql, params);
    const points: { date: string; inputTokens: number; outputTokens: number; cacheReadTokens: number; cacheWriteTokens: number }[] = [];

    if (results.length > 0 && results[0].values) {
      for (const r of results[0].values) {
        points.push({
          date: r[0] as string,
          inputTokens: Number(r[1]) || 0,
          outputTokens: Number(r[2]) || 0,
          cacheReadTokens: Number(r[3]) || 0,
          cacheWriteTokens: Number(r[4]) || 0,
        });
      }
    }

    return { points };
  });

  app.get('/api/analytics/breakdown', async (req) => {
    const q = req.query as Record<string, string>;
    const dimension = q.dimension || 'cli';
    const metric = q.metric || 'cost';

    const db = getDatabase();
    const dimMap: Record<string, string> = {
      cli: 'cli',
      provider: 'provider',
      model: 'COALESCE(model, "unknown")',
      project: 'COALESCE(project_path, "unknown")',
    };
    const dim = dimMap[dimension] || 'cli';

    const metricCol = metric === 'sessions' ? 'COUNT(*)' :
                      metric === 'tokens' ? 'COALESCE(SUM((SELECT SUM(input_tokens+output_tokens) FROM usage_events WHERE session_fk=sessions.id)), 0)' :
                      'COALESCE(SUM(total_cost_usd), 0)';

    const sql = `SELECT ${dim} AS label, ${metricCol} AS value FROM sessions WHERE ${VALID_SESSION_SQL} GROUP BY ${dim} ORDER BY value DESC`;

    const results = db.exec(sql);
    const breakdown: { label: string; value: number; percentage: number }[] = [];
    let total = 0;

    if (results.length > 0 && results[0].values) {
      for (const r of results[0].values) {
        breakdown.push({
          label: (r[0] as string) || 'unknown',
          value: Number(r[1]) || 0,
          percentage: 0,
        });
        total += Number(r[1]) || 0;
      }
      for (const item of breakdown) {
        item.percentage = total > 0 ? Math.round((item.value / total) * 10000) / 100 : 0;
      }
    }

    return { breakdown };
  });
}
