import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import type { Adapter, Checkpoint, RawSession } from './types.js';
import type { CliProvider } from '@sessionless/shared';
import { createGeminiAdapter } from './gemini.js';

const ANTIGRAVITY_ROOTS = [
  join(homedir(), '.gemini', 'antigravity'),
  join(homedir(), '.gemini', 'antigravity', 'knowledge'),
  join(homedir(), '.gemini', 'antigravity', 'mcp_config.json'),
];

export function createAntigravityAdapter(): Adapter {
  const gemini = createGeminiAdapter();

  return {
    cli: 'antigravity' as CliProvider,

    async detect(): Promise<boolean> {
      return ANTIGRAVITY_ROOTS.some((root) => existsSync(root));
    },

    async discover(): Promise<string[]> {
      return gemini.discover();
    },

    async computeCheckpoint(sessionPath: string): Promise<Checkpoint | null> {
      return gemini.computeCheckpoint(sessionPath);
    },

    async parse(sessionPath: string, checkpoint: Checkpoint | null): Promise<RawSession[]> {
      return gemini.parse(sessionPath, checkpoint);
    },

    normalize(raw: RawSession): RawSession {
      return { ...raw, cli: 'antigravity' as CliProvider };
    },
  };
}
