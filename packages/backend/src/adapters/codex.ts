import { existsSync, statSync, readFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { homedir } from 'node:os';
import type { Adapter, Checkpoint, RawSession, RawMessage, RawUsageEvent } from './types.js';
import type { CliProvider, SourceConfidence } from '@sessionless/shared';

const CODEX_HOME = join(homedir(), '.codex');
const STATE_DB = join(CODEX_HOME, 'state_5.sqlite');

let sqlJsStatic: import('sql.js').SqlJsStatic | null = null;
async function getSqlJs(): Promise<import('sql.js').SqlJsStatic> {
  if (!sqlJsStatic) {
    const mod = await import('sql.js');
    sqlJsStatic = await mod.default();
  }
  return sqlJsStatic;
}

interface ThreadRow {
  id: string;
  rollout_path: string;
  created_at: number;
  updated_at: number;
  created_at_ms: number | null;
  updated_at_ms: number | null;
  model_provider: string;
  model: string | null;
  cwd: string;
  title: string;
  tokens_used: number;
  has_user_event: number;
  archived: number;
  git_origin_url: string | null;
  git_branch: string | null;
  source: string;
}

export function createCodexAdapter(): Adapter {
  return {
    cli: 'codex' as CliProvider,

    async detect(): Promise<boolean> {
      return existsSync(STATE_DB);
    },

    async discover(): Promise<string[]> {
      const sql = await getSqlJs();
      const buffer = readFileSync(STATE_DB);
      const db = new sql.Database(buffer);

      const paths = new Set<string>();
      try {
        const results = db.exec(
          'SELECT rollout_path FROM threads WHERE archived = 0',
        );
        if (results.length > 0 && results[0].values) {
          for (const row of results[0].values) {
            paths.add(row[0] as string);
          }
        }
      } finally {
        db.close();
      }
      return [...paths];
    },

    async computeCheckpoint(sessionPath: string): Promise<Checkpoint | null> {
      if (!existsSync(sessionPath)) return null;
      const stat = statSync(sessionPath);
      return {
        lastFileMtime: stat.mtimeMs,
        lastFileSize: stat.size,
        lastSessionId: null,
      };
    },

    async parse(
      sessionPath: string,
      _checkpoint: Checkpoint | null,
    ): Promise<RawSession[]> {
      if (!existsSync(sessionPath)) return [];

      const raw = await readFile(sessionPath, 'utf-8');
      const lines = raw.trim().split('\n').filter(Boolean);
      if (lines.length === 0) return [];

      const thread = await getThreadData(sessionPath);
      if (!thread) return [];

      const events: Record<string, unknown>[] = [];
      for (const line of lines) {
        try {
          events.push(JSON.parse(line));
        } catch {
          // skip malformed
        }
      }

      return buildSession(events, thread);
    },

    normalize(raw: RawSession): RawSession {
      return raw;
    },
  };
}

function buildSession(
  events: Record<string, unknown>[],
  thread: ThreadRow,
): RawSession[] {
  const messages: RawMessage[] = [];
  const usageEvents: RawUsageEvent[] = [];
  let toolCallCount = 0;
  let firstTs = '';
  let lastTs = '';

  for (const evt of events) {
    const type = evt.type as string;
    const payload = (evt.payload ?? {}) as Record<string, unknown>;
    const ts = (evt.timestamp as string) ?? '';

    if (ts) {
      if (!firstTs || ts < firstTs) firstTs = ts;
      if (!lastTs || ts > lastTs) lastTs = ts;
    }

    if (type === 'response_item') {
      const pt = payload.type as string;
      if (pt === 'message') {
        const role = (payload.role as string) ?? 'assistant';
        const content = extractContent(payload.content);
        if (content) {
          messages.push({ role: role as RawMessage['role'], content, timestamp: ts });
        }
      } else if (pt === 'function_call' || pt === 'custom_tool_call') {
        toolCallCount++;
      }
      if (payload.usage) {
        const usage = payload.usage as Record<string, unknown>;
        usageEvents.push({
          timestamp: ts,
          inputTokens: (usage.input_tokens as number) ?? 0,
          outputTokens: (usage.output_tokens as number) ?? 0,
          cacheReadTokens: (usage.cache_read_input_tokens as number) ?? 0,
          cacheWriteTokens: (usage.cache_creation_input_tokens as number) ?? 0,
          reasoningTokens: (usage.reasoning_tokens as number) ?? 0,
          toolCallsCount: 0,
        });
      }
    } else if (type === 'event_msg') {
      const pt = payload.type as string;
      const text = (payload.text as string) ?? '';
      if (pt === 'user_message' && text) {
        messages.push({ role: 'user', content: text, timestamp: ts });
      } else if (pt === 'agent_message' && text) {
        messages.push({ role: 'assistant', content: text, timestamp: ts });
      }
    }
  }

  const totalTokens = thread.tokens_used ?? 0;
  if (totalTokens > 0 && usageEvents.length === 0) {
    usageEvents.push({
      timestamp: firstTs || new Date().toISOString(),
      inputTokens: Math.floor(totalTokens * 0.7),
      outputTokens: Math.floor(totalTokens * 0.3),
      cacheReadTokens: 0,
      cacheWriteTokens: 0,
      reasoningTokens: 0,
      toolCallsCount: toolCallCount,
    });
  }

  const startTime = thread.created_at_ms
    ? new Date(thread.created_at_ms).toISOString()
    : firstTs || new Date().toISOString();
  const endTime = thread.updated_at_ms
    ? new Date(thread.updated_at_ms).toISOString()
    : lastTs || startTime;
  const durationMs = thread.created_at_ms && thread.updated_at_ms
    ? thread.updated_at_ms - thread.created_at_ms
    : null;

  const confidence: SourceConfidence = totalTokens > 0 ? 'MEDIUM' : 'LOW';
  const totalCostUsd = totalTokens > 0 ? estimateCodexCost(totalTokens, thread.model) : null;

  return [{
    sessionId: thread.id,
    provider: thread.model_provider ?? 'openai',
    cli: 'codex',
    projectPath: thread.cwd ? thread.cwd.replace(/^\\\\\?\\/, '') : null,
    model: thread.model,
    startedAt: startTime,
    endedAt: endTime,
    durationMs,
    totalCostUsd,
    sourceConfidence: confidence,
    messages,
    usageEvents,
  }];
}

function extractContent(content: unknown): string {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content
      .filter((c: Record<string, unknown>) => c.type === 'output_text' || c.type === 'input_text')
      .map((c: Record<string, unknown>) => String(c.text ?? ''))
      .join('\n');
  }
  return '';
}

async function getThreadData(sessionPath: string): Promise<ThreadRow | null> {
  const sql = await getSqlJs();
  let db: import('sql.js').Database | null = null;
  try {
    if (!existsSync(STATE_DB)) return null;
    const buffer = readFileSync(STATE_DB);
    db = new sql.Database(buffer);

    const results = db.exec(
      `SELECT id, rollout_path, created_at, updated_at, created_at_ms, updated_at_ms, model_provider, model, cwd, title, tokens_used, has_user_event, archived, git_origin_url, git_branch, source FROM threads WHERE rollout_path = ? LIMIT 1`,
      [sessionPath],
    );
    if (results.length === 0 || !results[0].values || results[0].values.length === 0) return null;

    const r = results[0].values[0];
    return {
      id: r[0] as string,
      rollout_path: r[1] as string,
      created_at: r[2] as number,
      updated_at: r[3] as number,
      created_at_ms: (r[4] ?? null) as number | null,
      updated_at_ms: (r[5] ?? null) as number | null,
      model_provider: r[6] as string,
      model: (r[7] ?? null) as string | null,
      cwd: r[8] as string,
      title: r[9] as string,
      tokens_used: r[10] as number,
      has_user_event: r[11] as number,
      archived: r[12] as number,
      git_origin_url: (r[13] ?? null) as string | null,
      git_branch: (r[14] ?? null) as string | null,
      source: r[15] as string,
    };
  } finally {
    db?.close();
  }
}

const COST_RATES: Record<string, { input: number; output: number }> = {
  'gpt-5.4': { input: 1.75, output: 14.0 },
  'gpt-5.4-mini': { input: 0.15, output: 0.60 },
  'gpt-5.5': { input: 2.50, output: 20.0 },
  'gpt-5.3-codex': { input: 3.00, output: 15.0 },
};

function estimateCodexCost(totalTokens: number, model: string | null): number {
  const rates = model ? COST_RATES[model] : undefined;
  const inputRate = (rates?.input ?? 1.75) / 1_000_000;
  const outputRate = (rates?.output ?? 14.0) / 1_000_000;
  return Math.floor(totalTokens * 0.7) * inputRate + Math.floor(totalTokens * 0.3) * outputRate;
}
