import { existsSync, statSync } from 'node:fs';
import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { homedir } from 'node:os';
import type { Adapter, Checkpoint, RawSession, RawMessage } from './types.js';
import type { CliProvider, SourceConfidence } from '@sessionless/shared';

const CLAUDE_HOME = join(homedir(), '.claude');
const PROJECTS_DIR = join(CLAUDE_HOME, 'projects');

export function createClaudeAdapter(): Adapter {
  return {
    cli: 'claude' as CliProvider,

    async detect(): Promise<boolean> {
      return existsSync(PROJECTS_DIR);
    },

    async discover(): Promise<string[]> {
      const paths: string[] = [];
      if (!existsSync(PROJECTS_DIR)) return paths;

      const projectDirs = await readdir(PROJECTS_DIR, { withFileTypes: true });
      for (const dir of projectDirs) {
        if (!dir.isDirectory()) continue;
        const projPath = join(PROJECTS_DIR, dir.name);
        const files = await readdir(projPath);
        for (const f of files) {
          if (f.endsWith('.jsonl')) {
            paths.push(join(projPath, f));
          }
        }
      }
      return paths;
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

      const events: Record<string, unknown>[] = [];
      for (const line of lines) {
        try {
          events.push(JSON.parse(line));
        } catch {
          // skip
        }
      }

      return buildClaudeSessions(events, sessionPath);
    },

    normalize(raw: RawSession): RawSession {
      return raw;
    },
  };
}

function buildClaudeSessions(
  events: Record<string, unknown>[],
  _filePath: string,
): RawSession[] {
  const sessionMap = new Map<string, {
    messages: RawMessage[];
    firstTs: string;
    lastTs: string;
    cwd: string | null;
    totalInputTokens: number;
    totalOutputTokens: number;
    totalCacheRead: number;
    totalCacheWrite: number;
    toolCallCount: number;
    totalCost: number | null;
  }>();

  for (const evt of events) {
    const type = evt.type as string;
    const sessionId = evt.sessionId as string | undefined;
    const ts = (evt.timestamp as string) ?? '';

    if (!sessionId) continue;

    if (!sessionMap.has(sessionId)) {
      sessionMap.set(sessionId, {
        messages: [],
        firstTs: ts,
        lastTs: ts,
        cwd: null,
        totalInputTokens: 0,
        totalOutputTokens: 0,
        totalCacheRead: 0,
        totalCacheWrite: 0,
        toolCallCount: 0,
        totalCost: null,
      });
    }
    const sess = sessionMap.get(sessionId)!;

    if (ts && (sess.firstTs === '' || ts < sess.firstTs)) sess.firstTs = ts;
    if (ts && ts > sess.lastTs) sess.lastTs = ts;
    if (evt.cwd) sess.cwd = evt.cwd as string;

    switch (type) {
      case 'user': {
        // Skip meta/system messages (like /clear, local-command-caveat)
        if (evt.isMeta === true) break;

        const message = evt.message as Record<string, unknown> | undefined;
        if (message && message.role === 'user') {
          const content = extractContent(message.content);
          // Skip command-only messages
          if (content && !content.includes('<command-name>')) {
            sess.messages.push({ role: 'user', content, timestamp: ts });
          }
        }
        break;
      }

      case 'assistant': {
        const message = evt.message as Record<string, unknown> | undefined;
        if (message) {
          const content = extractContent(message.content);
          if (content) {
            sess.messages.push({ role: 'assistant', content, timestamp: ts });
          }

          const usage = message.usage as Record<string, unknown> | undefined;
          if (usage) {
            sess.totalInputTokens += (usage.input_tokens as number) ?? 0;
            sess.totalOutputTokens += (usage.output_tokens as number) ?? 0;
            sess.totalCacheRead += (usage.cache_read_input_tokens as number) ?? 0;
            sess.totalCacheWrite += (usage.cache_creation_input_tokens as number) ?? 0;
          }
        }
        break;
      }

      case 'tool_use': {
        sess.toolCallCount++;
        break;
      }

      case 'result': {
        const result = evt.result as string | undefined;
        if (result) {
          sess.messages.push({ role: 'tool', content: result, timestamp: ts });
        }
        break;
      }
    }
  }

  const sessions: RawSession[] = [];
  for (const [sessionId, data] of sessionMap) {
    const totalTokens = data.totalInputTokens + data.totalOutputTokens;
    const hasTokenData = totalTokens > 0;
    const confidence: SourceConfidence = hasTokenData ? 'HIGH' : 'MEDIUM';

    const startTime = data.firstTs || new Date().toISOString();
    const endTime = data.lastTs || startTime;
    const durationMs = data.firstTs && data.lastTs
      ? new Date(data.lastTs).getTime() - new Date(data.firstTs).getTime()
      : null;

    // Calculate cost from pricing table if we have tokens
    let totalCostUsd: number | null = data.totalCost;
    if (!totalCostUsd && hasTokenData) {
      totalCostUsd = estimateCost(data.totalInputTokens, data.totalOutputTokens);
    }

    if (data.messages.length === 0 && !hasTokenData && data.toolCallCount === 0 && !totalCostUsd) {
      continue;
    }

    sessions.push({
      sessionId,
      provider: 'anthropic',
      cli: 'claude',
      projectPath: data.cwd,
      model: null, // Claude JSONL doesn't reliably include model info
      startedAt: startTime,
      endedAt: endTime,
      durationMs,
      totalCostUsd,
      sourceConfidence: confidence,
      messages: data.messages,
      usageEvents: hasTokenData ? [{
        timestamp: startTime,
        inputTokens: data.totalInputTokens,
        outputTokens: data.totalOutputTokens,
        cacheReadTokens: data.totalCacheRead,
        cacheWriteTokens: data.totalCacheWrite,
        reasoningTokens: 0,
        toolCallsCount: data.toolCallCount,
      }] : [],
    });
  }

  return sessions;
}

function estimateCost(inputTokens: number, outputTokens: number): number {
  const INPUT_RATE = 3.00 / 1_000_000;
  const OUTPUT_RATE = 15.0 / 1_000_000;
  return inputTokens * INPUT_RATE + outputTokens * OUTPUT_RATE;
}

function extractContent(content: unknown): string {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content
      .filter((c: Record<string, unknown>) => c.type === 'text')
      .map((c: Record<string, unknown>) => String(c.text ?? ''))
      .join('\n');
  }
  return '';
}
