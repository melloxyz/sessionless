import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import type { Adapter, Checkpoint, RawMessage, RawSession } from './types.js';
import type { CliProvider, SourceConfidence } from '@sessionless/shared';

const DEFAULT_HISTORY_FILE = '.aider.chat.history.md';

export function createAiderAdapter(): Adapter {
  return {
    cli: 'aider' as CliProvider,

    async detect(): Promise<boolean> {
      return Boolean(findHistoryFile());
    },

    async discover(): Promise<string[]> {
      const historyFile = findHistoryFile();
      return historyFile ? [historyFile] : [];
    },

    async computeCheckpoint(sessionPath: string): Promise<Checkpoint | null> {
      if (!existsSync(sessionPath)) return null;
      const stat = await import('node:fs').then((fs) => fs.statSync(sessionPath));
      return {
        lastFileMtime: stat.mtimeMs,
        lastFileSize: stat.size,
        lastSessionId: null,
      };
    },

    async parse(sessionPath: string, _checkpoint: Checkpoint | null): Promise<RawSession[]> {
      if (!existsSync(sessionPath)) return [];

      const content = readFileSync(sessionPath, 'utf-8');
      const parsed = parseMarkdownHistory(content);
      if (parsed.messages.length === 0 && parsed.prompts.length === 0 && parsed.responses.length === 0) return [];

      const projectPath = dirname(sessionPath);
      const startedAt = parsed.startedAt ?? new Date().toISOString();
      const endedAt = parsed.endedAt ?? startedAt;
      const sessionId = `aider-${hashString(sessionPath)}`;
      const confidence: SourceConfidence = parsed.hasStructuredMetadata ? 'MEDIUM' : 'LOW';

      return [{
        sessionId,
        provider: parsed.provider ?? 'openai',
        cli: 'aider' as CliProvider,
        projectPath,
        sourcePath: sessionPath,
        model: parsed.model,
        startedAt,
        endedAt,
        durationMs: null,
        totalCostUsd: parsed.totalCostUsd,
        sourceConfidence: confidence,
        messages: parsed.messages,
        usageEvents: parsed.usageEvents,
        modelUsage: parsed.modelUsage,
      }];
    },

    normalize(raw: RawSession): RawSession {
      return raw;
    },
  };
}

function findHistoryFile(): string | null {
  const envFile = process.env.AIDER_CHAT_HISTORY_FILE;
  if (envFile && existsSync(envFile)) return resolve(envFile);

  const cwd = process.cwd();
  const local = join(cwd, DEFAULT_HISTORY_FILE);
  if (existsSync(local)) return local;

  const candidates = scanForHistoryFiles(cwd, 3);
  return candidates[0] ?? null;
}

function scanForHistoryFiles(root: string, depth: number): string[] {
  if (depth < 0 || !existsSync(root)) return [];
  const found: string[] = [];
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const full = join(root, entry.name);
    if (entry.isFile() && entry.name === DEFAULT_HISTORY_FILE) {
      found.push(full);
      continue;
    }
    if (entry.isDirectory() && depth > 0) {
      found.push(...scanForHistoryFiles(full, depth - 1));
    }
  }
  return found;
}

function parseMarkdownHistory(content: string): {
  messages: RawMessage[];
  prompts: string[];
  responses: string[];
  model: string | null;
  provider: string | null;
  startedAt: string | null;
  endedAt: string | null;
  totalCostUsd: number | null;
  usageEvents: RawSession['usageEvents'];
  modelUsage: RawSession['modelUsage'];
  hasStructuredMetadata: boolean;
} {
  const messages: RawMessage[] = [];
  const prompts: string[] = [];
  const responses: string[] = [];
  const lines = content.split(/\r?\n/);
  const blocks = splitBlocks(lines);

  let model: string | null = null;
  let provider: string | null = null;
  let startedAt: string | null = null;
  let endedAt: string | null = null;
  let totalCostUsd: number | null = null;
  let hasStructuredMetadata = false;

  for (const block of blocks) {
    const lower = block.toLowerCase();
    if (lower.includes('model:')) {
      model = model ?? extractValue(block, /model:\s*([^\n]+)/i);
      hasStructuredMetadata = true;
    }
    if (lower.includes('provider:')) {
      provider = provider ?? extractValue(block, /provider:\s*([^\n]+)/i);
      hasStructuredMetadata = true;
    }
    if (lower.includes('cost:') || lower.includes('total cost')) {
      const rawCost = extractValue(block, /(?:total cost|cost):\s*([^\n]+)/i);
      if (rawCost) {
        const parsed = Number(rawCost.replace(/[^0-9.]/g, ''));
        if (!Number.isNaN(parsed)) totalCostUsd = parsed;
      }
      hasStructuredMetadata = true;
    }
    if (lower.includes('started') || lower.includes('timestamp')) {
      startedAt = startedAt ?? extractValue(block, /(?:started|timestamp):\s*([^\n]+)/i);
      endedAt = endedAt ?? extractValue(block, /(?:ended|timestamp):\s*([^\n]+)/i);
    }
  }

  for (const block of blocks) {
    const trimmed = block.trim();
    if (!trimmed) continue;

    const role = detectRole(trimmed);
    if (!role) continue;

    const text = extractMarkdownText(trimmed);
    if (!text) continue;

    messages.push({
      role,
      content: text,
      timestamp: startedAt ?? new Date().toISOString(),
    });

    if (role === 'user') prompts.push(text);
    if (role === 'assistant') responses.push(text);
  }

  return {
    messages,
    prompts,
    responses,
    model,
    provider,
    startedAt,
    endedAt,
    totalCostUsd,
    usageEvents: [],
    modelUsage: model && provider ? [{
      provider,
      model,
      messageCount: messages.length,
      inputTokens: 0,
      outputTokens: 0,
      reasoningTokens: 0,
      cacheReadTokens: 0,
      cacheWriteTokens: 0,
      toolCallsCount: 0,
      totalCostUsd: totalCostUsd ?? 0,
    }] : [],
    hasStructuredMetadata,
  };
}

function splitBlocks(lines: string[]): string[] {
  const blocks: string[] = [];
  let current: string[] = [];

  for (const line of lines) {
    if (!line.trim() && current.length > 0) {
      blocks.push(current.join('\n'));
      current = [];
    } else {
      current.push(line);
    }
  }

  if (current.length > 0) blocks.push(current.join('\n'));
  return blocks;
}

function detectRole(block: string): RawMessage['role'] | null {
  if (/^#+\s*user/i.test(block) || /\buser\b/i.test(block.split('\n')[0] ?? '')) return 'user';
  if (/^#+\s*(assistant|response|ai)/i.test(block) || /\bassistant\b/i.test(block.split('\n')[0] ?? '')) return 'assistant';
  if (/^#+\s*system/i.test(block)) return 'system';
  return null;
}

function extractMarkdownText(block: string): string {
  const lines = block.split(/\r?\n/).map((line) => line.replace(/^\s*[-*]\s*/, '').trim());
  return lines
    .filter((line) => line && !/^#+\s*(user|assistant|system|response|assistant reply)/i.test(line))
    .join('\n')
    .trim();
}

function extractValue(text: string, pattern: RegExp): string | null {
  const match = text.match(pattern);
  return match?.[1]?.trim() ?? null;
}

function hashString(value: string): string {
  let hash = 0;
  for (let i = 0; i < value.length; i++) hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
  return hash.toString(16);
}
