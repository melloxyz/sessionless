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

const VISIBLE_SESSION_SQL = `${VALID_SESSION_SQL}
  AND NOT EXISTS (SELECT 1 FROM hidden_projects hp WHERE hp.path = COALESCE(project_path, 'unknown'))`;
const VISIBLE_SESSION_SQL_S = `NOT (
  s.session_id = 'unknown'
  AND (s.project_path IS NULL OR s.project_path = 'unknown')
  AND (s.model IS NULL OR s.model = 'unknown')
  AND COALESCE(s.message_count, 0) = 0
  AND COALESCE(s.tool_call_count, 0) = 0
  AND COALESCE(s.total_cost_usd, 0) = 0
)
  AND NOT EXISTS (SELECT 1 FROM hidden_projects hp WHERE hp.path = COALESCE(s.project_path, 'unknown'))`;

export function registerAnalyticsRoutes(app: FastifyInstance): void {
  app.get('/api/analytics/report', async (req, reply) => {
    try {
      const q = req.query as Record<string, string>;
      return buildAnalyticsReport(parseAnalyticsFilters(q));
    } catch (error) {
      reply.code(500);
      return { error: { code: 'ANALYTICS_REPORT_FAILED', message: 'Failed to build analytics report', details: String(error) } };
    }
  });

  app.get('/api/analytics/spend-over-time', async (req, reply) => {
    try {
      const q = req.query as Record<string, string>;
      const granularity = q.granularity || 'day';
      const cli = q.cli || null;
      const provider = q.provider || null;
      const model = q.model || null;
      const project = q.project || null;
      const dateFrom = q.dateFrom || null;
      const dateTo = q.dateTo || null;

      const db = getDatabase();
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
        WHERE ${VISIBLE_SESSION_SQL} AND total_cost_usd IS NOT NULL
      `;
      const params: (string | number | null)[] = [];

      if (cli) { sql += ` AND cli = ?`; params.push(cli); }
      if (provider) { sql += ` AND LOWER(provider) = LOWER(?)`; params.push(provider); }
      if (model) { sql += ` AND LOWER(COALESCE(model, 'unknown')) = LOWER(?)`; params.push(model); }
      if (project) { sql += ` AND COALESCE(project_path, 'unknown') = ?`; params.push(project); }
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
    } catch (error) {
      reply.code(500);
      return { error: { code: 'SPEND_TIMELINE_FAILED', message: 'Failed to load spend timeline', details: String(error) } };
    }
  });

  app.get('/api/analytics/tokens-over-time', async (req, reply) => {
    try {
    const q = req.query as Record<string, string>;
    const cli = q.cli || null;
    const provider = q.provider || null;
    const model = q.model || null;
    const project = q.project || null;
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
      WHERE ${VISIBLE_SESSION_SQL_S}
    `;
    const params: (string | number | null)[] = [];

    if (cli) { sql += ` AND s.cli = ?`; params.push(cli); }
    if (provider) { sql += ` AND LOWER(s.provider) = LOWER(?)`; params.push(provider); }
    if (model) { sql += ` AND LOWER(COALESCE(s.model, 'unknown')) = LOWER(?)`; params.push(model); }
    if (project) { sql += ` AND COALESCE(s.project_path, 'unknown') = ?`; params.push(project); }
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
    } catch (error) {
      reply.code(500);
      return { error: { code: 'TOKENS_TIMELINE_FAILED', message: 'Failed to load token timeline', details: String(error) } };
    }
  });

  app.get('/api/analytics/breakdown', async (req, reply) => {
    try {
    const q = req.query as Record<string, string>;
    const dimension = q.dimension || 'cli';
    const metric = q.metric || 'cost';
    const cli = q.cli || null;
    const provider = q.provider || null;
    const model = q.model || null;
    const project = q.project || null;
    const dateFrom = q.dateFrom || null;
    const dateTo = q.dateTo || null;

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

    let sql = `SELECT ${dim} AS label, ${metricCol} AS value FROM sessions WHERE ${VISIBLE_SESSION_SQL}`;
    const params: string[] = [];
    if (cli) { sql += ` AND cli = ?`; params.push(cli); }
    if (provider) { sql += ` AND LOWER(provider) = LOWER(?)`; params.push(provider); }
    if (model) { sql += ` AND LOWER(COALESCE(model, 'unknown')) = LOWER(?)`; params.push(model); }
    if (project) { sql += ` AND COALESCE(project_path, 'unknown') = ?`; params.push(project); }
    if (dateFrom) { sql += ` AND started_at >= ?`; params.push(dateFrom); }
    if (dateTo) { sql += ` AND started_at <= ?`; params.push(dateTo); }
    sql += ` GROUP BY ${dim} ORDER BY value DESC`;

    const results = db.exec(sql, params);
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
    } catch (error) {
      reply.code(500);
      return { error: { code: 'BREAKDOWN_FAILED', message: 'Failed to load analytics breakdown', details: String(error) } };
    }
  });

  app.get('/api/analytics/filter-options', async (req, reply) => {
    try {
      const q = req.query as Record<string, string>;
      const dateFrom = q.dateFrom || null;
      const dateTo = q.dateTo || null;
      let where = `WHERE ${VISIBLE_SESSION_SQL}`;
      const params: string[] = [];
      if (dateFrom) { where += ` AND started_at >= ?`; params.push(dateFrom); }
      if (dateTo) { where += ` AND started_at <= ?`; params.push(dateTo); }

      const db = getDatabase();
      const read = (sql: string) => (db.exec(sql, params)[0]?.values ?? []).map((row) => ({ label: String(row[0] ?? 'unknown'), value: String(row[0] ?? 'unknown'), count: Number(row[1]) || 0 }));
      return {
        clis: read(`SELECT cli, COUNT(*) FROM sessions ${where} GROUP BY cli ORDER BY COUNT(*) DESC, cli ASC`),
        providers: read(`SELECT COALESCE(provider, 'unknown'), COUNT(*) FROM sessions ${where} GROUP BY COALESCE(provider, 'unknown') ORDER BY COUNT(*) DESC`),
        models: read(`SELECT COALESCE(model, 'unknown'), COUNT(*) FROM sessions ${where} GROUP BY COALESCE(model, 'unknown') ORDER BY COUNT(*) DESC LIMIT 100`),
        projects: read(`SELECT COALESCE(project_path, 'unknown'), COUNT(*) FROM sessions ${where} GROUP BY COALESCE(project_path, 'unknown') ORDER BY COUNT(*) DESC LIMIT 100`),
      };
    } catch (error) {
      reply.code(500);
      return { error: { code: 'ANALYTICS_FILTER_OPTIONS_FAILED', message: 'Failed to load analytics filter options', details: String(error) } };
    }
  });
}

function parseAnalyticsFilters(q: Record<string, string>) {
  return {
    dateFrom: q.dateFrom || null,
    dateTo: q.dateTo || null,
    cli: q.cli || null,
    provider: q.provider || null,
    model: q.model || null,
    project: q.project || null,
  };
}
