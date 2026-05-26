import type { CliProvider, SourceConfidence } from '@aimeter/shared';

export interface RawSession {
  sessionId: string;
  provider: string;
  cli: CliProvider;
  projectPath: string | null;
  model: string | null;
  startedAt: string;
  endedAt: string | null;
  durationMs: number | null;
  totalCostUsd: number | null;
  sourceConfidence: SourceConfidence;
  messages: RawMessage[];
  usageEvents: RawUsageEvent[];
  modelUsage?: RawModelUsage[];
}

export interface RawModelUsage {
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

export interface RawMessage {
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  timestamp: string;
}

export interface RawUsageEvent {
  timestamp: string;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  reasoningTokens: number;
  toolCallsCount: number;
}

export interface Checkpoint {
  lastFileMtime: number;
  lastFileSize: number;
  lastSessionId: string | null;
}

export interface Adapter {
  readonly cli: CliProvider;

  detect(): Promise<boolean>;

  discover(): Promise<string[]>;

  computeCheckpoint(sessionPath: string): Promise<Checkpoint | null>;

  parse(
    sessionPath: string,
    checkpoint: Checkpoint | null,
  ): Promise<RawSession[]>;

  normalize(raw: RawSession): RawSession;
}
