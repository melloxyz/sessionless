import type { FastifyInstance } from 'fastify';
import { getDatabase } from '../db/connection.js';
import { syncOpenRouterPricing } from '../openrouter.js';
import { backfillEstimatedCosts } from '../ingestion/engine.js';

export function registerModelRoutes(app: FastifyInstance): void {
  app.get('/api/models', async (req) => {
    const q = req.query as Record<string, string>;
    const search = q.search?.trim().toLowerCase() || null;
    const provider = q.provider?.trim().toLowerCase() || null;
    const usedOnly = q.usedOnly === 'true';
    const sort = q.sort || 'recommended';
    const db = getDatabase();
    const params: (string | number)[] = [];
    let where = 'WHERE 1=1';

    if (search) {
      where += ` AND (LOWER(m.provider) LIKE ? OR LOWER(m.model_name) LIKE ?)`;
      params.push(`%${search}%`, `%${search}%`);
    }
    if (provider) {
      where += ` AND LOWER(m.provider) = ?`;
      params.push(provider);
    }
    if (usedOnly) where += ` AND COALESCE(u.session_count, 0) > 0`;

    const orderBy = sort === 'price-input' ? 'm.input_cost_per_million ASC, m.output_cost_per_million ASC' :
      sort === 'price-output' ? 'm.output_cost_per_million ASC, m.input_cost_per_million ASC' :
      sort === 'name' ? 'm.provider ASC, m.model_name ASC' :
      `CASE WHEN COALESCE(u.session_count, 0) > 0 THEN 0 WHEN ${popularCase('m.model_name')} THEN 1 ELSE 2 END,
       COALESCE(u.session_count, 0) DESC,
       ${popularRank('m.model_name')} ASC,
       COALESCE(u.total_cost, 0) DESC,
       m.provider ASC,
       m.model_name ASC`;

    const results = db.exec(`
      WITH usage AS (
        SELECT LOWER(COALESCE(provider, 'unknown')) AS provider,
               LOWER(COALESCE(model, 'unknown')) AS model_name,
               COUNT(*) AS session_count,
               COALESCE(SUM(total_cost_usd), 0) AS total_cost,
               MAX(started_at) AS last_used_at
        FROM sessions
        WHERE model IS NOT NULL
          AND NOT EXISTS (SELECT 1 FROM hidden_projects hp WHERE hp.path = COALESCE(project_path, 'unknown'))
        GROUP BY LOWER(COALESCE(provider, 'unknown')), LOWER(COALESCE(model, 'unknown'))
        UNION ALL
        SELECT LOWER(COALESCE(smu.provider, 'unknown')) AS provider,
               LOWER(COALESCE(smu.model, 'unknown')) AS model_name,
               COUNT(DISTINCT smu.session_fk) AS session_count,
               COALESCE(SUM(smu.total_cost_usd), 0) AS total_cost,
               MAX(s.started_at) AS last_used_at
        FROM session_model_usage smu
        JOIN sessions s ON s.id = smu.session_fk
        WHERE NOT EXISTS (SELECT 1 FROM hidden_projects hp WHERE hp.path = COALESCE(s.project_path, 'unknown'))
        GROUP BY LOWER(COALESCE(smu.provider, 'unknown')), LOWER(COALESCE(smu.model, 'unknown'))
      ), usage_rollup AS (
        SELECT provider, model_name,
               SUM(session_count) AS session_count,
               SUM(total_cost) AS total_cost,
               MAX(last_used_at) AS last_used_at
        FROM usage
        GROUP BY provider, model_name
      )
      SELECT m.*,
             COALESCE(u.session_count, 0) AS usage_session_count,
             COALESCE(u.total_cost, 0) AS usage_total_cost,
             u.last_used_at,
             CASE WHEN COALESCE(u.session_count, 0) > 0 THEN 1 ELSE 0 END AS is_used,
             CASE WHEN ${popularCase('m.model_name')} THEN 1 ELSE 0 END AS is_popular
      FROM models m
      LEFT JOIN usage_rollup u
        ON LOWER(m.provider) = u.provider
       AND (LOWER(m.model_name) = u.model_name OR u.model_name LIKE '%' || LOWER(m.model_name) || '%' OR LOWER(m.model_name) LIKE '%' || u.model_name || '%')
      ${where}
      ORDER BY ${orderBy}
      LIMIT 500
    `, params);

    const data: Record<string, unknown>[] = [];
    if (results.length > 0 && results[0].values && results[0].columns) {
      const cols = results[0].columns;
      for (const row of results[0].values) {
        const obj: Record<string, unknown> = {};
        for (let i = 0; i < cols.length; i++) {
          obj[cols[i]] = row[i];
        }
        data.push(obj);
      }
    }

    return { data };
  });

  app.get('/api/models/providers', async () => {
    const db = getDatabase();
    const results = db.exec(`SELECT DISTINCT provider FROM models ORDER BY provider`);
    return { providers: (results[0]?.values ?? []).map((row) => row[0]) };
  });

  app.get('/api/models/sync-openrouter', async (req, reply) => {
    try {
      const result = await syncOpenRouterPricing();
      backfillEstimatedCosts();
      return result;
    } catch (error) {
      reply.code(502);
      return { error: { code: 'OPENROUTER_SYNC_FAILED', message: 'Failed to sync OpenRouter pricing', details: String(error) } };
    }
  });

  app.post('/api/models/sync-openrouter', async (req, reply) => {
    try {
      const result = await syncOpenRouterPricing();
      backfillEstimatedCosts();
      return result;
    } catch (error) {
      reply.code(502);
      return { error: { code: 'OPENROUTER_SYNC_FAILED', message: 'Failed to sync OpenRouter pricing', details: String(error) } };
    }
  });
}

function popularCase(column: string): string {
  return `(LOWER(${column}) LIKE '%gpt-4%' OR LOWER(${column}) LIKE '%gpt-5%' OR LOWER(${column}) LIKE '%claude%' OR LOWER(${column}) LIKE '%gemini%' OR LOWER(${column}) LIKE '%llama%' OR LOWER(${column}) LIKE '%qwen%' OR LOWER(${column}) LIKE '%deepseek%')`;
}

function popularRank(column: string): string {
  return `CASE
    WHEN LOWER(${column}) LIKE '%gpt-5%' THEN 1
    WHEN LOWER(${column}) LIKE '%claude%' THEN 2
    WHEN LOWER(${column}) LIKE '%gemini%' THEN 3
    WHEN LOWER(${column}) LIKE '%gpt-4%' THEN 4
    WHEN LOWER(${column}) LIKE '%deepseek%' THEN 5
    WHEN LOWER(${column}) LIKE '%qwen%' THEN 6
    WHEN LOWER(${column}) LIKE '%llama%' THEN 7
    ELSE 99
  END`;
}
