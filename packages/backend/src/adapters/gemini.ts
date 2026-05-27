import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import type { Adapter, Checkpoint, RawMessage, RawSession, RawUsageEvent } from './types.js';
import type { CliProvider, SourceConfidence } from '@sessionless/shared';

const GEMINI_HOME = join(homedir(), '.gemini');

export function createGeminiAdapter(): Adapter {
  return {
    cli: 'gemini' as CliProvider,

    async detect(): Promise<boolean> {
      return existsSync(GEMINI_HOME);
    },

    async discover(): Promise<string[]> {
      const chatsDir = join(GEMINI_HOME, 'tmp');
      const sessions: string[] = [];
      if (!existsSync(chatsDir)) return sessions;

      for (const projectDir of readdirSync(chatsDir, { withFileTypes: true })) {
        if (!projectDir.isDirectory()) continue;
        const chatsPath = join(chatsDir, projectDir.name, 'chats');
        if (!existsSync(chatsPath)) continue;

        for (const entry of readdirSync(chatsPath, { withFileTypes: true })) {
          const full = join(chatsPath, entry.name);
          if (entry.isDirectory()) {
            for (const nested of readdirSync(full, { withFileTypes: true })) {
              const nestedFull = join(full, nested.name);
              if (nested.isFile() && isSessionFile(nested.name)) sessions.push(nestedFull);
            }
          } else if (entry.isFile() && isSessionFile(entry.name)) {
            sessions.push(full);
          }
        }
      }

      return sessions;
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

    async parse(sessionPath: string, _checkpoint: Checkpoint | null): Promise<RawSession[]> {
      if (!existsSync(sessionPath)) return [];
      const raw = readFileSync(sessionPath, 'utf-8');
      const lines = raw.split('\n').map((line) => line.trim()).filter(Boolean);
      if (lines.length === 0) return [];

      const messages: RawMessage[] = [];
      const usageEvents: RawUsageEvent[] = [];
      const modelUsage = new Map<string, { provider: string; model: string; messageCount: number; inputTokens: number; outputTokens: number; reasoningTokens: number; cacheReadTokens: number; cacheWriteTokens: number; toolCallsCount: number; totalCostUsd: number; }>();
      let sessionId = 'unknown';
      let provider = 'google';
      let model: string | null = null;
      let projectPath: string | null = null;
      let startedAt = '';
      let endedAt = '';
      let totalInput = 0;
      let totalOutput = 0;
      let totalReasoning = 0;
      let totalCacheRead = 0;
      let totalCacheWrite = 0;
      let toolCalls = 0;
      let totalCost = 0;

      for (const line of lines) {
        let data: Record<string, unknown> | null = null;
        try {
          data = JSON.parse(line);
        } catch {
          continue;
        }
        if (!data) continue;

        sessionId = pickString(data.sessionId) ?? pickString(data.id) ?? sessionId;
        provider = pickString(data.provider) ?? pickString(data.providerId) ?? provider;
        model = pickString(data.model) ?? pickString(data.modelId) ?? model;
        projectPath = pickString(data.projectPath) ?? pickString(data.cwd) ?? projectPath;
        startedAt = pickString(data.startedAt) ?? pickString(data.timestamp) ?? startedAt;
        endedAt = pickString(data.endedAt) ?? pickString(data.timestamp) ?? endedAt;

        const role = normalizeRole(pickString(data.role) ?? pickString(data.type));
        const content = extractContent(data.content ?? data.text ?? data.message);
        if (role && content) {
          messages.push({ role, content, timestamp: pickString(data.timestamp) ?? new Date().toISOString() });
        }

        const usage = extractUsage(data.usage ?? data.tokenUsage ?? data.tokens);
        if (usage) {
          totalInput += usage.input;
          totalOutput += usage.output;
          totalReasoning += usage.reasoning;
          totalCacheRead += usage.cacheRead;
          totalCacheWrite += usage.cacheWrite;
          toolCalls += usage.toolCalls;
        }

        const cost = Number(data.cost ?? data.totalCost ?? 0) || 0;
        totalCost += cost;

        const providerId = provider || 'google';
        const modelId = model || 'unknown';
        const key = `${providerId}/${modelId}`;
        const current = modelUsage.get(key) ?? {
          provider: providerId,
          model: modelId,
          messageCount: 0,
          inputTokens: 0,
          outputTokens: 0,
          reasoningTokens: 0,
          cacheReadTokens: 0,
          cacheWriteTokens: 0,
          toolCallsCount: 0,
          totalCostUsd: 0,
        };
        current.messageCount += role ? 1 : 0;
        current.inputTokens += usage?.input ?? 0;
        current.outputTokens += usage?.output ?? 0;
        current.reasoningTokens += usage?.reasoning ?? 0;
        current.cacheReadTokens += usage?.cacheRead ?? 0;
        current.cacheWriteTokens += usage?.cacheWrite ?? 0;
        current.toolCallsCount += usage?.toolCalls ?? 0;
        current.totalCostUsd += cost;
        modelUsage.set(key, current);
      }

      const hasTokens = totalInput > 0 || totalOutput > 0 || totalReasoning > 0 || totalCacheRead > 0 || totalCacheWrite > 0;
      const confidence: SourceConfidence = hasTokens || totalCost > 0 ? 'HIGH' : 'MEDIUM';
      const totalTokens = totalInput + totalOutput;
      const costEstimate = totalCost > 0 ? totalCost : estimateGeminiCost(totalInput, totalOutput, model);

      if (!messages.length && !hasTokens && costEstimate === 0) return [];

      const orderedModelUsage = [...modelUsage.values()];

      return [{
        sessionId,
        provider,
        cli: 'gemini',
        projectPath,
        model,
        startedAt: startedAt || new Date().toISOString(),
        endedAt: endedAt || startedAt || new Date().toISOString(),
        durationMs: null,
        totalCostUsd: costEstimate,
        sourceConfidence: confidence,
        messages,
        usageEvents: totalTokens > 0 ? [{
          timestamp: startedAt || new Date().toISOString(),
          inputTokens: totalInput,
          outputTokens: totalOutput,
          cacheReadTokens: totalCacheRead,
          cacheWriteTokens: totalCacheWrite,
          reasoningTokens: totalReasoning,
          toolCallsCount: toolCalls,
        }] : [],
        modelUsage: orderedModelUsage,
      }];
    },

    normalize(raw: RawSession): RawSession {
      return raw;
    },
  };
}

function isSessionFile(name: string): boolean {
  return name.endsWith('.jsonl') || name.endsWith('.json');
}

function pickString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function normalizeRole(value: string | null): RawMessage['role'] | null {
  if (!value) return null;
  const lower = value.toLowerCase();
  if (lower.includes('user')) return 'user';
  if (lower.includes('assistant') || lower.includes('model') || lower.includes('agent')) return 'assistant';
  if (lower.includes('system')) return 'system';
  if (lower.includes('tool')) return 'tool';
  return null;
}

function extractContent(value: unknown): string {
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) {
    return value
      .map((item) => {
        if (typeof item === 'string') return item;
        if (item && typeof item === 'object' && 'text' in item) return String((item as Record<string, unknown>).text ?? '');
        return '';
      })
      .filter(Boolean)
      .join('\n');
  }
  if (value && typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    return typeof obj.text === 'string' ? obj.text : '';
  }
  return '';
}

function extractUsage(value: unknown): { input: number; output: number; reasoning: number; cacheRead: number; cacheWrite: number; toolCalls: number; } | null {
  if (!value || typeof value !== 'object') return null;
  const obj = value as Record<string, unknown>;
  const input = Number(obj.input_tokens ?? obj.inputTokens ?? obj.prompt_tokens ?? 0) || 0;
  const output = Number(obj.output_tokens ?? obj.outputTokens ?? obj.completion_tokens ?? 0) || 0;
  const reasoning = Number(obj.reasoning_tokens ?? obj.reasoningTokens ?? 0) || 0;
  const cacheRead = Number(obj.cached_tokens ?? obj.cache_read_tokens ?? obj.cacheReadTokens ?? 0) || 0;
  const cacheWrite = Number(obj.cache_write_tokens ?? obj.cacheWriteTokens ?? 0) || 0;
  const toolCalls = Number(obj.tool_calls_count ?? obj.toolCallsCount ?? obj.tool_calls ?? 0) || 0;
  if (input === 0 && output === 0 && reasoning === 0 && cacheRead === 0 && cacheWrite === 0 && toolCalls === 0) return null;
  return { input, output, reasoning, cacheRead, cacheWrite, toolCalls };
}

function estimateGeminiCost(inputTokens: number, outputTokens: number, model: string | null): number {
  const normalized = model?.toLowerCase() ?? 'gemini-2.5-pro';
  const pricing = GEMINI_PRICING[normalized] ?? GEMINI_PRICING['gemini-2.5-pro'];
  return (inputTokens / 1_000_000) * pricing.input + (outputTokens / 1_000_000) * pricing.output;
}

const GEMINI_PRICING: Record<string, { input: number; output: number }> = {
  'gemini-2.5-pro': { input: 1.25, output: 10.0 },
  'gemini-2.5-flash': { input: 0.15, output: 0.60 },
  'gemini-2.0-flash': { input: 0.10, output: 0.40 },
};
