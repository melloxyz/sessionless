import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import type { Adapter, Checkpoint, RawSession, RawMessage, RawUsageEvent, RawModelUsage } from './types.js';
import type { CliProvider, SourceConfidence } from '@aimeter/shared';

const OPENCODE_DB = join(homedir(), '.local', 'share', 'opencode', 'opencode.db');

let sqlJsStatic: import('sql.js').SqlJsStatic | null = null;
async function getSqlJs(): Promise<import('sql.js').SqlJsStatic> {
  if (!sqlJsStatic) {
    const mod = await import('sql.js');
    sqlJsStatic = await mod.default();
  }
  return sqlJsStatic;
}

interface SessionRow {
  id: string;
  directory: string | null;
  model: string | null;
  cost: number | null;
  tokens_input: number | null;
  tokens_output: number | null;
  tokens_reasoning: number | null;
  tokens_cache_read: number | null;
  tokens_cache_write: number | null;
  time_created: number;
  time_updated: number;
}

export function createOpencodeAdapter(): Adapter {
  return {
    cli: 'opencode' as CliProvider,

    async detect(): Promise<boolean> {
      return existsSync(OPENCODE_DB);
    },

    async discover(): Promise<string[]> {
      const sql = await getSqlJs();
      const db = new sql.Database(readFileSync(OPENCODE_DB));
      const ids: string[] = [];
      try {
        const results = db.exec(
          `SELECT id FROM session WHERE time_archived IS NULL ORDER BY time_created DESC`,
        );
        if (results.length > 0 && results[0].values) {
          for (const row of results[0].values) ids.push(row[0] as string);
        }
      } finally { db.close(); }
      return ids;
    },

    async computeCheckpoint(sessionId: string): Promise<Checkpoint | null> {
      const sql = await getSqlJs();
      const db = new sql.Database(readFileSync(OPENCODE_DB));
      try {
        const results = db.exec(`SELECT time_updated FROM session WHERE id = ?`, [sessionId]);
        if (results.length > 0 && results[0].values.length > 0) {
          return { lastFileMtime: 0, lastFileSize: 0, lastSessionId: sessionId };
        }
        return null;
      } finally { db.close(); }
    },

    async parse(sessionId: string, _cp: Checkpoint | null): Promise<RawSession[]> {
      const sql = await getSqlJs();
      const db = new sql.Database(readFileSync(OPENCODE_DB));

      try {
        const sessionResults = db.exec(
          `SELECT id, directory, model, cost, tokens_input, tokens_output,
                  tokens_reasoning, tokens_cache_read, tokens_cache_write,
                  time_created, time_updated
           FROM session WHERE id = ?`,
          [sessionId],
        );
        if (sessionResults.length === 0 || !sessionResults[0].values || sessionResults[0].values.length === 0) {
          return [];
        }

        const cols = sessionResults[0].columns;
        const row = sessionResults[0].values[0];
        const s: Record<string, unknown> = {};
        for (let i = 0; i < cols.length; i++) s[cols[i]] = row[i];

        // Get messages for this session (direct relation via session_id)
        const msgResults = db.exec(
          `SELECT id, data, time_created FROM message WHERE session_id = ? ORDER BY time_created`,
          [sessionId],
        );
        const messages: RawMessage[] = [];
        const modelUsage = new Map<string, RawModelUsage>();
        let totalInputTokens = 0;
        let totalOutputTokens = 0;
        let totalReasoningTokens = 0;
        let totalCacheReadTokens = 0;
        let totalCacheWriteTokens = 0;
        let toolCallCount = 0;

        if (msgResults.length > 0 && msgResults[0].values) {
          for (const msgRow of msgResults[0].values) {
            const msgId = msgRow[0] as string;
            const dataJson = msgRow[1] as string;
            const timeCreated = Number(msgRow[2]);

            let role = 'unknown';
            let perMsgCost = 0;
            let perMsgInput = 0;
            let perMsgOutput = 0;

            try {
              const data = JSON.parse(dataJson);
              role = data.role ?? 'unknown';
              const providerID = typeof data.providerID === 'string' ? data.providerID : null;
              const modelID = typeof data.modelID === 'string' ? data.modelID : null;
              if (data.tokens) {
                perMsgInput = data.tokens.input ?? 0;
                perMsgOutput = data.tokens.output ?? 0;
                totalInputTokens += perMsgInput;
                totalOutputTokens += perMsgOutput;
                totalReasoningTokens += data.tokens.reasoning ?? 0;
                totalCacheReadTokens += data.tokens.cache?.read ?? 0;
                totalCacheWriteTokens += data.tokens.cache?.write ?? 0;
              }

              if (providerID && modelID) {
                const key = `${providerID}/${modelID}`;
                const current = modelUsage.get(key) ?? {
                  provider: providerID,
                  model: modelID,
                  messageCount: 0,
                  inputTokens: 0,
                  outputTokens: 0,
                  reasoningTokens: 0,
                  cacheReadTokens: 0,
                  cacheWriteTokens: 0,
                  toolCallsCount: 0,
                  totalCostUsd: 0,
                };
                current.messageCount += 1;
                current.inputTokens += Number(data.tokens?.input ?? 0) || 0;
                current.outputTokens += Number(data.tokens?.output ?? 0) || 0;
                current.reasoningTokens += Number(data.tokens?.reasoning ?? 0) || 0;
                current.cacheReadTokens += Number(data.tokens?.cache?.read ?? 0) || 0;
                current.cacheWriteTokens += Number(data.tokens?.cache?.write ?? 0) || 0;
                current.totalCostUsd += Number(data.cost ?? 0) || 0;
                if (data.finish === 'tool-calls') current.toolCallsCount += 1;
                modelUsage.set(key, current);
              }
            } catch { /* bad JSON */ }

            // Get parts (content) for this message
            const partResults = db.exec(
              `SELECT data FROM part WHERE message_id = ? ORDER BY rowid`,
              [msgId],
            );

            let contentParts: string[] = [];
            let hasToolUse = false;
            if (partResults.length > 0 && partResults[0].values) {
              for (const partRow of partResults[0].values) {
                try {
                  const partData = JSON.parse(partRow[0] as string);
                  if (partData.type === 'text' && partData.text) {
                    contentParts.push(partData.text);
                  } else if (partData.type === 'tool_use' || partData.type === 'tool_call') {
                    hasToolUse = true;
                    contentParts.push(`[${partData.type}] ${partData.text ?? JSON.stringify(partData)}`);
                  }
                } catch { /* bad JSON */ }
              }
            }

            if (hasToolUse) toolCallCount++;

            const content = contentParts.join('\n') || `[${role}]`;
            if (role === 'user' || role === 'assistant' || role === 'system' || role === 'tool') {
              messages.push({
                role,
                content,
                timestamp: new Date(timeCreated).toISOString(),
              });
            }
          }
        }

        // Parse model data from session model field (may contain provider/model format)
        let model = (s.model as string) ?? null;
        let provider = 'opencode';

        if (model) {
          try {
            const modelObj = JSON.parse(model);
            if (modelObj.providerID) provider = modelObj.providerID;
            if (modelObj.id || modelObj.modelID) model = modelObj.id ?? modelObj.modelID;
          } catch {
            if (model.includes('/')) {
              [provider, model] = model.split('/');
            }
          }
        }

        // Also try to get model from the first assistant message
        if (!model && msgResults.length > 0 && msgResults[0].values) {
          for (const msgRow of msgResults[0].values) {
            try {
              const data = JSON.parse(msgRow[1] as string);
              if ((data.role === 'assistant' || data.agent) && data.modelID) {
                model = data.modelID;
              }
              if (data.providerID) provider = data.providerID;
              if (model) break;
            } catch { /* skip */ }
          }
        }

        const hasCost = (s.cost as number) != null && (s.cost as number) > 0;
        const hasTokens = totalInputTokens > 0 || totalOutputTokens > 0 ||
          ((s.tokens_input as number) ?? 0) > 0 || ((s.tokens_output as number) ?? 0) > 0;
        const confidence: SourceConfidence = hasCost ? 'HIGH' : hasTokens ? 'MEDIUM' : 'LOW';

        const startTime = (s.time_created as number)
          ? new Date(s.time_created as number).toISOString() : new Date().toISOString();
        const endTime = (s.time_updated as number)
          ? new Date(s.time_updated as number).toISOString() : startTime;
        const durationMs = ((s.time_updated as number) && (s.time_created as number))
          ? (s.time_updated as number) - (s.time_created as number) : null;

        // Aggregate usage events
        const usageEvents: RawUsageEvent[] = [];
        const finalInput = totalInputTokens > 0 ? totalInputTokens : ((s.tokens_input as number) ?? 0);
        const finalOutput = totalOutputTokens > 0 ? totalOutputTokens : ((s.tokens_output as number) ?? 0);
        if (finalInput > 0 || finalOutput > 0) {
          usageEvents.push({
            timestamp: startTime,
            inputTokens: Number(finalInput),
            outputTokens: Number(finalOutput),
            cacheReadTokens: totalCacheReadTokens > 0 ? totalCacheReadTokens : ((s.tokens_cache_read as number) ?? 0),
            cacheWriteTokens: totalCacheWriteTokens > 0 ? totalCacheWriteTokens : ((s.tokens_cache_write as number) ?? 0),
            reasoningTokens: totalReasoningTokens > 0 ? totalReasoningTokens : ((s.tokens_reasoning as number) ?? 0),
            toolCallsCount: toolCallCount,
          });
        }

        return [{
          sessionId: s.id as string,
          provider,
          cli: 'opencode',
          projectPath: (s.directory as string) ?? null,
          model,
          startedAt: startTime,
          endedAt: endTime,
          durationMs,
          totalCostUsd: (s.cost as number) ?? null,
          sourceConfidence: confidence,
          messages,
          usageEvents,
          modelUsage: [...modelUsage.values()],
        }];
      } finally { db.close(); }
    },

    normalize(raw: RawSession): RawSession {
      return raw;
    },
  };
}
