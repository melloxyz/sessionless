import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import type { Adapter, Checkpoint, RawMessage, RawSession, RawUsageEvent } from './types.js';
import type { CliProvider, SourceConfidence } from '@sessionless/shared';

const QWEN_ROOTS = [
  join(homedir(), '.qwen'),
  join(homedir(), '.config', 'qwen'),
  join(homedir(), '.local', 'share', 'qwen'),
  join(process.env.APPDATA ?? '', 'qwen'),
  join(process.env.LOCALAPPDATA ?? '', 'qwen'),
].filter(Boolean);

const VALID_EXTENSIONS = new Set(['.json', '.jsonl', '.log', '.md', '.markdown', '.txt', '.sqlite', '.db']);

export function createQwenAdapter(): Adapter {
  return {
    cli: 'qwen' as CliProvider,

    async detect(): Promise<boolean> {
      return QWEN_ROOTS.some((root) => existsSync(root));
    },

    async discover(): Promise<string[]> {
      const paths = new Set<string>();
      for (const root of QWEN_ROOTS) {
        if (!existsSync(root)) continue;
        scan(root, 3, paths);
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

    async parse(sessionPath: string, _checkpoint: Checkpoint | null): Promise<RawSession[]> {
      if (!existsSync(sessionPath)) return [];

      const stat = statSync(sessionPath);
      if (stat.isDirectory()) {
        return parseDirectory(sessionPath);
      }

      const ext = extensionOf(sessionPath);
      if (!VALID_EXTENSIONS.has(ext)) return [];

      const content = readFileSync(sessionPath, 'utf-8');
      const parsed = parseTextContent(sessionPath, content);
      return parsed ? [parsed] : [];
    },

    normalize(raw: RawSession): RawSession {
      return raw;
    },
  };
}

function scan(root: string, depth: number, out: Set<string>): void {
  if (depth < 0 || !existsSync(root)) return;

  const stat = statSync(root);
  if (stat.isFile()) {
    if (VALID_EXTENSIONS.has(extensionOf(root))) out.add(root);
    return;
  }

  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const full = join(root, entry.name);
    if (entry.isFile() && VALID_EXTENSIONS.has(extensionOf(entry.name))) {
      out.add(full);
      continue;
    }
    if (entry.isDirectory() && depth > 0) {
      scan(full, depth - 1, out);
    }
  }
}

function parseDirectory(path: string): RawSession[] {
  const children = readdirSync(path, { withFileTypes: true });
  const files = children.filter((entry) => entry.isFile() && VALID_EXTENSIONS.has(extensionOf(entry.name))).map((entry) => join(path, entry.name));
  return files.flatMap((file) => {
    const content = readFileSync(file, 'utf-8');
    const parsed = parseTextContent(file, content);
    return parsed ? [parsed] : [];
  });
}

function parseTextContent(sessionPath: string, content: string): RawSession | null {
  const lines = content.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (lines.length === 0) return null;

  const messages: RawMessage[] = [];
  const usageEvents: RawUsageEvent[] = [];
  const modelUsage = new Map<string, { provider: string; model: string; messageCount: number; inputTokens: number; outputTokens: number; reasoningTokens: number; cacheReadTokens: number; cacheWriteTokens: number; toolCallsCount: number; totalCostUsd: number; }>();

  let sessionId = `qwen-${hashString(sessionPath)}`;
  let provider = 'alibaba';
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
  let seenStructured = false;

  for (const line of lines) {
    const decoded = tryParseLine(line);
    if (!decoded) continue;

    const data = decoded;
    sessionId = pickString(data.sessionId) ?? pickString(data.id) ?? sessionId;
    provider = pickString(data.provider) ?? pickString(data.providerId) ?? provider;
    model = pickString(data.model) ?? pickString(data.modelId) ?? model;
    projectPath = pickString(data.projectPath) ?? pickString(data.cwd) ?? pickString(data.directory) ?? projectPath;
    startedAt = pickString(data.startedAt) ?? pickString(data.timestamp) ?? startedAt;
    endedAt = pickString(data.endedAt) ?? pickString(data.timestamp) ?? endedAt;

    const role = normalizeRole(pickString(data.role) ?? pickString(data.type) ?? pickString(data.kind));
    const contentText = extractContent(data.content ?? data.message ?? data.text ?? data.parts);
    if (role && contentText) {
      messages.push({ role, content: contentText, timestamp: pickString(data.timestamp) ?? new Date().toISOString() });
    }

    const usage = extractUsage(data.usage ?? data.tokenUsage ?? data.tokens ?? data.metrics);
    if (usage) {
      totalInput += usage.input;
      totalOutput += usage.output;
      totalReasoning += usage.reasoning;
      totalCacheRead += usage.cacheRead;
      totalCacheWrite += usage.cacheWrite;
      toolCalls += usage.toolCalls;
      seenStructured = true;
    }

    const cost = Number(data.cost ?? data.totalCost ?? data.estimatedCost ?? 0) || 0;
    totalCost += cost;

    if (provider || model || usage || cost) seenStructured = true;

    if (provider && model) {
      const key = `${provider}/${model}`;
      const current = modelUsage.get(key) ?? {
        provider,
        model,
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
  }

  const hasTokens = totalInput > 0 || totalOutput > 0 || totalReasoning > 0 || totalCacheRead > 0 || totalCacheWrite > 0;
  const confidence: SourceConfidence = hasTokens || totalCost > 0 ? 'HIGH' : seenStructured ? 'MEDIUM' : 'LOW';
  const costEstimate = totalCost > 0 ? totalCost : estimateCost(totalInput, totalOutput, model);

  if (!messages.length && !hasTokens && costEstimate === 0) return null;

  return {
    sessionId,
    provider,
    cli: 'qwen' as CliProvider,
    projectPath,
    sourcePath: sessionPath,
    model,
    startedAt: startedAt || new Date().toISOString(),
    endedAt: endedAt || startedAt || new Date().toISOString(),
    durationMs: null,
    totalCostUsd: costEstimate,
    sourceConfidence: confidence,
    messages,
    usageEvents: hasTokens ? [{
      timestamp: startedAt || new Date().toISOString(),
      inputTokens: totalInput,
      outputTokens: totalOutput,
      cacheReadTokens: totalCacheRead,
      cacheWriteTokens: totalCacheWrite,
      reasoningTokens: totalReasoning,
      toolCallsCount: toolCalls,
    }] : [],
    modelUsage: [...modelUsage.values()],
  };
}

function tryParseLine(line: string): Record<string, unknown> | null {
  if (line.startsWith('{') || line.startsWith('[')) {
    try {
      const parsed = JSON.parse(line);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed as Record<string, unknown>;
      return null;
    } catch {
      return null;
    }
  }

  const jsonMatch = line.match(/\{.*\}/);
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[0]);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed as Record<string, unknown>;
    } catch {
      return null;
    }
  }

  return null;
}

function normalizeRole(value: string | null): RawMessage['role'] | null {
  if (!value) return null;
  const lower = value.toLowerCase();
  if (lower.includes('user')) return 'user';
  if (lower.includes('assistant') || lower.includes('agent') || lower.includes('model')) return 'assistant';
  if (lower.includes('system')) return 'system';
  if (lower.includes('tool')) return 'tool';
  return null;
}

function extractContent(value: unknown): string {
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) {
    return value.map((item) => extractContent(item)).filter(Boolean).join('\n');
  }
  if (value && typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    if (typeof obj.text === 'string') return obj.text;
    if (typeof obj.content === 'string') return obj.content;
    if (Array.isArray(obj.parts)) return obj.parts.map((part) => extractContent(part)).filter(Boolean).join('\n');
  }
  return '';
}

function extractUsage(value: unknown): { input: number; output: number; reasoning: number; cacheRead: number; cacheWrite: number; toolCalls: number; } | null {
  if (!value || typeof value !== 'object') return null;
  const obj = value as Record<string, unknown>;
  const input = Number(obj.input_tokens ?? obj.inputTokens ?? obj.prompt_tokens ?? obj.promptTokens ?? 0) || 0;
  const output = Number(obj.output_tokens ?? obj.outputTokens ?? obj.completion_tokens ?? obj.completionTokens ?? 0) || 0;
  const reasoning = Number(obj.reasoning_tokens ?? obj.reasoningTokens ?? 0) || 0;
  const cacheRead = Number(obj.cached_tokens ?? obj.cache_read_tokens ?? obj.cacheReadTokens ?? 0) || 0;
  const cacheWrite = Number(obj.cache_write_tokens ?? obj.cacheWriteTokens ?? 0) || 0;
  const toolCalls = Number(obj.tool_calls_count ?? obj.toolCallsCount ?? obj.tool_calls ?? 0) || 0;
  if (input === 0 && output === 0 && reasoning === 0 && cacheRead === 0 && cacheWrite === 0 && toolCalls === 0) return null;
  return { input, output, reasoning, cacheRead, cacheWrite, toolCalls };
}

function estimateCost(inputTokens: number, outputTokens: number, model: string | null): number {
  const normalized = (model ?? 'qwen-plus').toLowerCase();
  const pricing = QWEN_PRICING[normalized] ?? QWEN_PRICING['qwen-plus'];
  return (inputTokens / 1_000_000) * pricing.input + (outputTokens / 1_000_000) * pricing.output;
}

function pickString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function extensionOf(value: string): string {
  const idx = value.lastIndexOf('.');
  return idx >= 0 ? value.slice(idx).toLowerCase() : '';
}

function hashString(value: string): string {
  let hash = 0;
  for (let i = 0; i < value.length; i++) hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
  return hash.toString(16);
}

const QWEN_PRICING: Record<string, { input: number; output: number }> = {
  'qwen-plus': { input: 0.8, output: 3.2 },
  'qwen-max': { input: 1.6, output: 6.4 },
  'qwen-turbo': { input: 0.2, output: 0.8 },
};
