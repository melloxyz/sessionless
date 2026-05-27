import { getDatabase } from '../db/connection.js';

function validSessionSql(alias?: string): string {
  const prefix = alias ? `${alias}.` : '';
  return `NOT (
    ${prefix}session_id = 'unknown'
    AND (${prefix}project_path IS NULL OR ${prefix}project_path = 'unknown')
    AND (${prefix}model IS NULL OR ${prefix}model = 'unknown')
    AND COALESCE(${prefix}message_count, 0) = 0
    AND COALESCE(${prefix}tool_call_count, 0) = 0
    AND COALESCE(${prefix}total_cost_usd, 0) = 0
  )
  AND NOT EXISTS (SELECT 1 FROM hidden_projects hp WHERE hp.path = COALESCE(${prefix}project_path, 'unknown'))`;
}

export interface AnalyticsInsight {
  id: string;
  kind: 'growth' | 'project' | 'model' | 'session' | 'cache';
  severity: 'high' | 'medium' | 'low';
  title: string;
  description: string;
  value: string;
}

export interface AnalyticsAnomaly {
  id: string;
  kind: 'spend' | 'token' | 'session';
  severity: 'high' | 'medium' | 'low';
  title: string;
  description: string;
  value: string;
}

export interface AnalyticsReport {
  generatedAt: string;
  summary: {
    totalSpend: number;
    current7DaySpend: number;
    previous7DaySpend: number;
    growthPercent: number | null;
    baselineDailySpend: number;
  };
  insights: AnalyticsInsight[];
  anomalies: AnalyticsAnomaly[];
  trend: { date: string; spend: number }[];
  productivity: ProductivityReport;
  modelUsageBreakdown: ModelUsageSummary[];
}

export interface AnalyticsFilters {
  dateFrom?: string | null;
  dateTo?: string | null;
  cli?: string | null;
  provider?: string | null;
  model?: string | null;
  project?: string | null;
}

export interface ModelUsageSummary {
  provider: string;
  model: string;
  messageCount: number;
  inputTokens: number;
  outputTokens: number;
  reasoningTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  toolCallsCount: number;
  totalCostUsd: number;
}

export interface ProductivitySession {
  sessionId: string;
  cli: string;
  provider: string;
  model: string | null;
  projectPath: string | null;
  cost: number;
  durationMs: number | null;
  messages: number;
  toolCalls: number;
  tokens: number;
  toolCallsPerMinute: number | null;
  tokensPerToolCall: number | null;
  costPerToolCall: number | null;
  messagesPerToolCall: number | null;
}

export interface ProductivityReport {
  totalToolCalls: number;
  avgToolCallsPerSession: number;
  avgToolCallsPerMinute: number | null;
  avgTokensPerToolCall: number | null;
  avgCostPerToolCall: number | null;
  avgMessagesPerToolCall: number | null;
  costToolCallCorrelation: number | null;
  topToolCallSessions: ProductivitySession[];
  filesModifiedSupported: boolean;
  notes: string[];
}

interface SessionRow {
  id: number;
  session_id: string;
  cli: string;
  provider: string;
  model: string | null;
  project_path: string | null;
  started_at: string;
  duration_ms: number | null;
  total_cost_usd: number | null;
  message_count: number;
  tool_call_count: number;
}

interface UsageAggregate {
  session_id: number;
  cli: string;
  provider: string;
  model: string | null;
  project_path: string | null;
  input_tokens: number;
  output_tokens: number;
  cache_read_tokens: number;
  cache_write_tokens: number;
  reasoning_tokens: number;
  tool_calls_count: number;
}

interface ProjectSummary {
  project: string;
  spend: number;
  sessions: number;
}

interface ModelSummary {
  provider: string;
  model: string;
  spend: number;
  sessions: number;
  avgCost: number;
  avgMessages: number;
  avgDuration: number;
  totalMessages: number;
}

interface SessionAggregate {
  session: SessionRow;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  reasoningTokens: number;
  toolCallsCount: number;
  totalTokens: number;
  cacheHitRate: number | null;
  cacheMissRate: number | null;
}

export function buildAnalyticsReport(filters: AnalyticsFilters = {}): AnalyticsReport {
  const db = getDatabase();
  const generatedAt = new Date().toISOString();

  const sessions = querySessions(db, filters);
  const usageAggregates = queryUsageAggregates(db, filters);
  const projectSummaries = queryProjectSummaries(db, filters);
  const modelSummaries = queryModelSummaries(db, filters);
  const modelUsageBreakdown = queryModelUsageBreakdown(db, filters);
  const dailyTrend = queryDailyTrend(db, filters);

  const sessionById = new Map<number, SessionRow>(sessions.map((session) => [session.id, session]));
  const aggregatedSessions = usageAggregates
    .map((row) => {
      const session = sessionById.get(row.session_id);
      if (!session) return null;

      const totalTokens = row.input_tokens + row.output_tokens + row.cache_read_tokens + row.cache_write_tokens + row.reasoning_tokens;
      const totalInput = row.input_tokens + row.cache_read_tokens + row.cache_write_tokens;
      const cacheHitRate = totalInput > 0 ? row.cache_read_tokens / totalInput : null;
      const cacheMissRate = cacheHitRate == null ? null : 1 - cacheHitRate;

      return {
        session,
        inputTokens: row.input_tokens,
        outputTokens: row.output_tokens,
        cacheReadTokens: row.cache_read_tokens,
        cacheWriteTokens: row.cache_write_tokens,
        reasoningTokens: row.reasoning_tokens,
        toolCallsCount: row.tool_calls_count,
        totalTokens,
        cacheHitRate,
        cacheMissRate,
      } satisfies SessionAggregate;
    })
    .filter((item): item is SessionAggregate => item !== null);

  const totalSpend = sessions.reduce((sum, session) => sum + (session.total_cost_usd ?? 0), 0);
  const totalMessages = sessions.reduce((sum, session) => sum + session.message_count, 0);
  const totalTools = sessions.reduce((sum, session) => sum + session.tool_call_count, 0);
  const totalDuration = sessions.reduce((sum, session) => sum + (session.duration_ms ?? 0), 0);
  const totalTokens = aggregatedSessions.reduce((sum, item) => sum + item.totalTokens, 0);
  const avgCost = average(sessions.map((session) => session.total_cost_usd ?? 0));
  const avgMessages = average(sessions.map((session) => session.message_count));
  const avgDuration = average(sessions.map((session) => session.duration_ms ?? 0));
  const avgTokens = average(aggregatedSessions.map((item) => item.totalTokens));
  const avgCacheMiss = average(aggregatedSessions.filter((item) => item.cacheMissRate != null).map((item) => item.cacheMissRate ?? 0));

  const { current7Spend, previous7Spend, growthPercent, baselineDailySpend } = computeSpendTrend(dailyTrend);

  const insights: AnalyticsInsight[] = [];
  const anomalies: AnalyticsAnomaly[] = [];

  if (growthPercent != null && growthPercent >= 25) {
    insights.push({
      id: 'spend-growth',
      kind: 'growth',
      severity: growthPercent >= 50 ? 'high' : 'medium',
      title: 'Usage is growing faster than last week',
      description: `The last 7 days spent ${formatPercent(growthPercent)} more than the previous 7 days.`,
          value: `${formatCurrency(current7Spend)} vs ${formatCurrency(previous7Spend)}`,
    });
  }

  const topProject = projectSummaries[0];
  if (topProject && totalSpend > 0 && topProject.spend / totalSpend >= 0.35) {
    insights.push({
      id: `project-${slug(topProject.project)}`,
      kind: 'project',
      severity: topProject.spend / totalSpend >= 0.5 ? 'high' : 'medium',
      title: 'One project dominates spend',
      description: `${topProject.project} is the highest-cost project and takes ${formatPercent((topProject.spend / totalSpend) * 100)} of total spend.`,
      value: `${formatCurrency(topProject.spend)} · ${topProject.sessions} sessions`,
    });
  }

  const topModel = modelSummaries.find((model) => {
    if (model.sessions < 2) return false;
    const spendShare = totalSpend > 0 ? model.spend / totalSpend : 0;
    return spendShare >= 0.15 && model.avgCost >= Math.max(avgCost * 1.5, 1);
  });
  if (topModel && avgMessages > 0 && topModel.avgMessages <= avgMessages * 0.75) {
    insights.push({
      id: `model-${slug(`${topModel.provider}-${topModel.model}`)}`,
      kind: 'model',
      severity: 'medium',
      title: 'Expensive model used for lighter sessions',
      description: `${topModel.provider}/${topModel.model} averages ${formatTokens(topModel.avgMessages)} messages per session while staying well above the overall average cost.`,
      value: `${formatCurrency(topModel.avgCost)} avg/session`,
    });
  }

  const expensiveSession = [...sessions]
    .sort((a, b) => (b.total_cost_usd ?? 0) - (a.total_cost_usd ?? 0) || (b.duration_ms ?? 0) - (a.duration_ms ?? 0))[0];
  if (expensiveSession && (expensiveSession.total_cost_usd ?? 0) >= Math.max(avgCost * 2, 10)) {
    insights.push({
      id: `session-${expensiveSession.id}`,
      kind: 'session',
      severity: 'medium',
      title: 'Long expensive session detected',
      description: `Session ${expensiveSession.session_id.slice(0, 10)} is among the priciest entries and may deserve a closer look.`,
      value: `${formatCurrency(expensiveSession.total_cost_usd)} · ${formatDuration(expensiveSession.duration_ms)}`,
    });
  }

  const cacheWasteCandidate = aggregatedSessions
    .filter((item) => item.totalTokens >= 1000 && item.cacheMissRate != null)
    .sort((a, b) => (b.cacheMissRate ?? 0) - (a.cacheMissRate ?? 0))[0];
  if (cacheWasteCandidate && (cacheWasteCandidate.cacheMissRate ?? 0) >= 0.6) {
    insights.push({
      id: `cache-${cacheWasteCandidate.session.id}`,
      kind: 'cache',
      severity: (cacheWasteCandidate.cacheMissRate ?? 0) >= 0.75 ? 'high' : 'medium',
      title: 'High context waste on a session',
      description: `${cacheWasteCandidate.session.cli} on ${compactPath(cacheWasteCandidate.session.project_path)} is missing cache hits for most of its input tokens.`,
      value: `${formatPercent((cacheWasteCandidate.cacheMissRate ?? 0) * 100)} miss rate`,
    });
  }

  if (dailyTrend.length >= 2) {
    const currentDay = dailyTrend[dailyTrend.length - 1];
    if (baselineDailySpend > 0 && currentDay.spend >= baselineDailySpend * 2) {
      anomalies.push({
        id: `spike-${currentDay.date}`,
        kind: 'spend',
        severity: currentDay.spend >= baselineDailySpend * 3 ? 'high' : 'medium',
        title: 'Daily spend spike',
        description: `The latest day spent ${formatPercent((currentDay.spend / baselineDailySpend) * 100 - 100)} more than the 7-day baseline.`,
      value: `${formatCurrency(currentDay.spend)} vs ${formatCurrency(baselineDailySpend)}/day`,
      });
    }
  }

  const tokenMean = average(aggregatedSessions.map((item) => item.totalTokens));
  const tokenStd = standardDeviation(aggregatedSessions.map((item) => item.totalTokens));
  const costMean = average(sessions.map((session) => session.total_cost_usd ?? 0));
  const costStd = standardDeviation(sessions.map((session) => session.total_cost_usd ?? 0));

  const tokenOutlier = [...aggregatedSessions]
    .sort((a, b) => b.totalTokens - a.totalTokens)
    .find((item) => item.totalTokens >= Math.max(tokenMean + tokenStd * 2, tokenMean * 2, 1000));
  if (tokenOutlier) {
    anomalies.push({
      id: `tokens-${tokenOutlier.session.id}`,
      kind: 'token',
      severity: 'medium',
      title: 'Token usage outlier',
      description: `Session ${tokenOutlier.session.session_id.slice(0, 10)} used far more tokens than the typical session.`,
      value: formatTokens(tokenOutlier.totalTokens),
    });
  }

  const costOutlier = [...sessions]
    .sort((a, b) => (b.total_cost_usd ?? 0) - (a.total_cost_usd ?? 0))
    .find((session) => (session.total_cost_usd ?? 0) >= Math.max(costMean + costStd * 2, costMean * 2, 10));
  if (costOutlier) {
    anomalies.push({
      id: `cost-${costOutlier.id}`,
      kind: 'session',
      severity: 'medium',
      title: 'High-cost session outlier',
      description: `Session ${costOutlier.session_id.slice(0, 10)} is much more expensive than the average session.`,
      value: formatCurrency(costOutlier.total_cost_usd),
    });
  }

  if (avgCacheMiss >= 0.5) {
    anomalies.push({
      id: 'cache-basin',
      kind: 'session',
      severity: avgCacheMiss >= 0.7 ? 'high' : 'medium',
      title: 'High cache miss rate overall',
      description: `Across analyzed sessions, cache misses remain elevated.`,
      value: `${formatPercent(avgCacheMiss * 100)} average miss rate`,
    });
  }

  const sessionsById = new Map(aggregatedSessions.map((item) => [item.session.id, item]));
  const productivityRows: ProductivitySession[] = sessions.map((session) => {
    const usage = sessionsById.get(session.id);
    const toolCalls = session.tool_call_count ?? 0;
    const cost = session.total_cost_usd ?? 0;
    const messages = session.message_count ?? 0;
    const tokens = usage?.totalTokens ?? 0;
    const minutes = (session.duration_ms ?? 0) / 60000;

    return {
      sessionId: session.session_id,
      cli: session.cli,
      provider: session.provider,
      model: session.model,
      projectPath: session.project_path,
      cost,
      durationMs: session.duration_ms,
      messages,
      toolCalls,
      tokens,
      toolCallsPerMinute: minutes > 0 ? toolCalls / minutes : null,
      tokensPerToolCall: toolCalls > 0 ? tokens / toolCalls : null,
      costPerToolCall: toolCalls > 0 ? cost / toolCalls : null,
      messagesPerToolCall: toolCalls > 0 ? messages / toolCalls : null,
    };
  });

  const productivityToolCallsPerMinute = totalDuration > 0 ? totalTools / (totalDuration / 60000) : null;
  const productivityTokensPerToolCall = totalTools > 0 ? totalTokens / totalTools : null;
  const productivityCostPerToolCall = totalTools > 0 ? totalSpend / totalTools : null;
  const productivityMessagesPerToolCall = totalTools > 0 ? totalMessages / totalTools : null;
  const costToolCallCorrelation = pearsonCorrelation(
    productivityRows.map((item) => item.toolCalls),
    productivityRows.map((item) => item.cost),
  );

  const topToolCallSessions = [...productivityRows]
    .sort((a, b) => b.toolCalls - a.toolCalls || b.cost - a.cost)
    .slice(0, 5);

  return {
    generatedAt,
    summary: {
      totalSpend,
      current7DaySpend: current7Spend,
      previous7DaySpend: previous7Spend,
      growthPercent,
      baselineDailySpend,
    },
    insights: insights.slice(0, 5),
    anomalies: anomalies.slice(0, 5),
    trend: dailyTrend,
    productivity: {
      totalToolCalls: totalTools,
      avgToolCallsPerSession: sessions.length > 0 ? totalTools / sessions.length : 0,
      avgToolCallsPerMinute: productivityToolCallsPerMinute,
      avgTokensPerToolCall: productivityTokensPerToolCall,
      avgCostPerToolCall: productivityCostPerToolCall,
      avgMessagesPerToolCall: productivityMessagesPerToolCall,
      costToolCallCorrelation,
      topToolCallSessions,
      filesModifiedSupported: false,
      notes: [
        'Files modified per session is not available yet because no adapter exposes a reliable source.',
        'Tool-call and token-based efficiency is now calculated across Codex, Claude and OpenCode sessions.',
      ],
    },
    modelUsageBreakdown,
  };
}

function querySessions(db: ReturnType<typeof getDatabase>, filters: AnalyticsFilters): SessionRow[] {
  const range = buildWhere(filters);
  const validSession = validSessionSql();
  const result = db.exec(
    `SELECT id, session_id, cli, provider, model, project_path, started_at, duration_ms, total_cost_usd, message_count, tool_call_count
      FROM sessions
      WHERE ${validSession}${range.sql}
      ORDER BY started_at ASC`,
    range.params,
  );

  return mapRows<SessionRow>(result);
}

function queryUsageAggregates(db: ReturnType<typeof getDatabase>, filters: AnalyticsFilters): UsageAggregate[] {
  const range = buildWhere(filters, 's');
  const validSession = validSessionSql('s');
  const result = db.exec(
    `SELECT
       s.id AS session_id,
       s.cli,
       s.provider,
       s.model,
       s.project_path,
       COALESCE(SUM(ue.input_tokens), 0) AS input_tokens,
       COALESCE(SUM(ue.output_tokens), 0) AS output_tokens,
       COALESCE(SUM(ue.cache_read_tokens), 0) AS cache_read_tokens,
       COALESCE(SUM(ue.cache_write_tokens), 0) AS cache_write_tokens,
       COALESCE(SUM(ue.reasoning_tokens), 0) AS reasoning_tokens,
       COALESCE(SUM(ue.tool_calls_count), 0) AS tool_calls_count
     FROM usage_events ue
     JOIN sessions s ON s.id = ue.session_fk
      WHERE ${validSession}${range.sql}
      GROUP BY s.id
      ORDER BY s.started_at ASC`,
    range.params,
  );

  return mapRows<UsageAggregate>(result);
}

function queryProjectSummaries(db: ReturnType<typeof getDatabase>, filters: AnalyticsFilters): ProjectSummary[] {
  const range = buildWhere(filters);
  const validSession = validSessionSql();
  const result = db.exec(
    `SELECT COALESCE(project_path, 'unknown') AS project, COALESCE(SUM(total_cost_usd), 0) AS spend, COUNT(*) AS sessions
     FROM sessions
     WHERE ${validSession}${range.sql}
     GROUP BY COALESCE(project_path, 'unknown')
     ORDER BY spend DESC`,
    range.params,
  );

  return mapRows<ProjectSummary>(result);
}

function queryModelSummaries(db: ReturnType<typeof getDatabase>, filters: AnalyticsFilters): ModelSummary[] {
  const range = buildWhere(filters);
  const validSession = validSessionSql();
  const result = db.exec(
    `SELECT
       COALESCE(provider, 'unknown') AS provider,
       COALESCE(model, 'unknown') AS model,
       COALESCE(SUM(total_cost_usd), 0) AS spend,
       COUNT(*) AS sessions,
       COALESCE(AVG(total_cost_usd), 0) AS avgCost,
       COALESCE(AVG(message_count), 0) AS avgMessages,
       COALESCE(AVG(duration_ms), 0) AS avgDuration,
       COALESCE(SUM(message_count), 0) AS totalMessages
     FROM sessions
     WHERE ${validSession}${range.sql}
     GROUP BY COALESCE(provider, 'unknown'), COALESCE(model, 'unknown')
     ORDER BY spend DESC`,
    range.params,
  );

  return mapRows<ModelSummary>(result);
}

function queryModelUsageBreakdown(db: ReturnType<typeof getDatabase>, filters: AnalyticsFilters): ModelUsageSummary[] {
  const range = buildWhere(filters, 's');
  const validSession = validSessionSql('s');
  const result = db.exec(
    `SELECT smu.provider, smu.model,
            COALESCE(SUM(smu.message_count), 0) AS messageCount,
            COALESCE(SUM(smu.input_tokens), 0) AS inputTokens,
            COALESCE(SUM(smu.output_tokens), 0) AS outputTokens,
            COALESCE(SUM(smu.reasoning_tokens), 0) AS reasoningTokens,
            COALESCE(SUM(smu.cache_read_tokens), 0) AS cacheReadTokens,
            COALESCE(SUM(smu.cache_write_tokens), 0) AS cacheWriteTokens,
            COALESCE(SUM(smu.tool_calls_count), 0) AS toolCallsCount,
            COALESCE(SUM(smu.total_cost_usd), 0) AS totalCostUsd
     FROM session_model_usage smu
     JOIN sessions s ON s.id = smu.session_fk
     WHERE ${validSession}${range.sql}
     GROUP BY smu.provider, smu.model
     ORDER BY totalCostUsd DESC, messageCount DESC`,
    range.params,
  );

  return mapRows<ModelUsageSummary>(result);
}

function queryDailyTrend(db: ReturnType<typeof getDatabase>, filters: AnalyticsFilters): { date: string; spend: number }[] {
  const range = buildWhere(filters);
  const validSession = validSessionSql();
  const anchorResult = db.exec(`SELECT date(MAX(started_at)) AS anchor FROM sessions WHERE ${validSession}${range.sql}`, range.params);
  const anchor = anchorResult[0]?.values?.[0]?.[0] as string | undefined;
  if (!anchor) return [];

  const anchorDate = toUtcDay(anchor);
  const startDate = filters.dateFrom ? toUtcDay(filters.dateFrom) : addUtcDays(anchorDate, -13);
  const filterWhere = buildWhere({ ...filters, dateFrom: null, dateTo: null });
  const params: string[] = [filters.dateFrom ?? toIsoDate(startDate), ...filterWhere.params];
  let dateToSql = '';
  if (filters.dateTo) { dateToSql = ' AND started_at <= ?'; params.push(filters.dateTo); }
  const spendResult = db.exec(
    `SELECT date(started_at) AS day, COALESCE(SUM(total_cost_usd), 0) AS spend
     FROM sessions
     WHERE ${validSession} AND started_at >= ?${filterWhere.sql}${dateToSql}
     GROUP BY day`,
    params,
  );

  const spendByDay = new Map<string, number>();
  for (const row of mapRows(spendResult) as { day: string; spend: number }[]) {
    spendByDay.set(row.day, Number(row.spend) || 0);
  }

  const points: { date: string; spend: number }[] = [];
  const days = Math.max(1, Math.ceil((anchorDate.getTime() - startDate.getTime()) / 86400000) + 1);
  for (let i = 0; i < days; i++) {
    const day = addUtcDays(startDate, i);
    const key = toIsoDate(day);
    points.push({ date: key, spend: spendByDay.get(key) ?? 0 });
  }

  return points;
}

function buildWhere(filters: AnalyticsFilters, alias?: string): { sql: string; params: string[] } {
  const prefix = alias ? `${alias}.` : '';
  let sql = '';
  const params: string[] = [];
  if (filters.dateFrom) { sql += ` AND ${prefix}started_at >= ?`; params.push(filters.dateFrom); }
  if (filters.dateTo) { sql += ` AND ${prefix}started_at <= ?`; params.push(filters.dateTo); }
  if (filters.cli) { sql += ` AND ${prefix}cli = ?`; params.push(filters.cli); }
  if (filters.provider) { sql += ` AND LOWER(${prefix}provider) = LOWER(?)`; params.push(filters.provider); }
  if (filters.model) { sql += ` AND LOWER(COALESCE(${prefix}model, 'unknown')) = LOWER(?)`; params.push(filters.model); }
  if (filters.project) { sql += ` AND COALESCE(${prefix}project_path, 'unknown') = ?`; params.push(filters.project); }
  return { sql, params };
}

function computeSpendTrend(points: { date: string; spend: number }[]): {
  current7Spend: number;
  previous7Spend: number;
  growthPercent: number | null;
  baselineDailySpend: number;
} {
  if (points.length < 7) {
    return { current7Spend: 0, previous7Spend: 0, growthPercent: null, baselineDailySpend: 0 };
  }

  const current = points.slice(-7).reduce((sum, point) => sum + point.spend, 0);
  const previous = points.slice(-14, -7).reduce((sum, point) => sum + point.spend, 0);
  const baselineDailySpend = previous / 7;
  const growthPercent = previous > 0 ? ((current - previous) / previous) * 100 : null;

  return { current7Spend: current, previous7Spend: previous, growthPercent, baselineDailySpend };
}

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function pearsonCorrelation(xValues: number[], yValues: number[]): number | null {
  if (xValues.length !== yValues.length || xValues.length < 2) return null;

  const xMean = average(xValues);
  const yMean = average(yValues);
  let numerator = 0;
  let xDenominator = 0;
  let yDenominator = 0;

  for (let i = 0; i < xValues.length; i++) {
    const x = xValues[i] - xMean;
    const y = yValues[i] - yMean;
    numerator += x * y;
    xDenominator += x * x;
    yDenominator += y * y;
  }

  const denominator = Math.sqrt(xDenominator * yDenominator);
  if (denominator === 0) return null;
  return numerator / denominator;
}

function standardDeviation(values: number[]): number {
  if (values.length === 0) return 0;
  const mean = average(values);
  const variance = average(values.map((value) => (value - mean) ** 2));
  return Math.sqrt(variance);
}

function mapRows<T>(results: ReturnType<ReturnType<typeof getDatabase>['exec']>): T[] {
  const rows: T[] = [];
  if (results.length === 0 || !results[0].values || !results[0].columns) return rows;

  const columns = results[0].columns;
  for (const row of results[0].values) {
    const obj: Record<string, unknown> = {};
    for (let i = 0; i < columns.length; i++) {
      obj[columns[i]] = row[i];
    }
    rows.push(obj as T);
  }

  return rows;
}

function toUtcDay(value: string): Date {
  const date = new Date(value.includes('T') ? value : `${value}T00:00:00.000Z`);
  date.setUTCHours(0, 0, 0, 0);
  return date;
}

function addUtcDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function formatCurrency(value: number | null | undefined): string {
  if (value == null) return '$0.00';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
}

function formatTokens(value: number | null | undefined): string {
  if (value == null) return '0';
  return new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(value);
}

function formatDuration(value: number | null): string {
  if (value == null) return '—';
  const seconds = Math.floor(value / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
  return `${seconds}s`;
}

function formatPercent(value: number): string {
  return `${value.toFixed(0)}%`;
}

function compactPath(value: string | null): string {
  if (!value) return 'unknown';
  const parts = value.split(/[/\\]/).filter(Boolean);
  return parts.slice(-2).join('/');
}

function slug(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}
