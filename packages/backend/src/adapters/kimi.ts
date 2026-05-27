import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import type { Adapter, Checkpoint, RawSession } from './types.js';
import type { CliProvider } from '@sessionless/shared';

const KIMI_HOME = join(homedir(), '.kimi');
const KIMI_LOG = join(KIMI_HOME, 'logs', 'kimi.log');

export function createKimiAdapter(): Adapter {
  return {
    cli: 'kimi' as CliProvider,

    async detect(): Promise<boolean> {
      return existsSync(KIMI_HOME);
    },

    async discover(): Promise<string[]> {
      return existsSync(KIMI_LOG) ? [KIMI_LOG] : [];
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

      const log = readFileSync(sessionPath, 'utf-8');
      const lines = log.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
      if (lines.length === 0) return [];

      const sessionLine = lines.find((line) => line.includes('new_session') && line.includes('working directory'));
      if (!sessionLine) return [];

      const workingDirMatch = sessionLine.match(/working directory:\s*(.+)$/i);
      const workingDir = workingDirMatch?.[1]?.trim() ?? null;

      const authFailed = lines.some((line) => line.includes('Authentication required'));
      const startedAt = extractTimestamp(sessionLine) ?? new Date().toISOString();
      const sessionId = `kimi-log-${hashSessionPath(sessionPath)}`;

      return [{
        sessionId,
        provider: 'moonshot',
        cli: 'kimi' as CliProvider,
        projectPath: workingDir,
        sourcePath: sessionPath,
        model: null,
        startedAt,
        endedAt: startedAt,
        durationMs: 0,
        totalCostUsd: null,
        sourceConfidence: authFailed ? 'LOW' : 'MEDIUM',
        messages: [],
        usageEvents: [],
      }];
    },

    normalize(raw: RawSession): RawSession {
      return raw;
    },
  };
}

function extractTimestamp(line: string): string | null {
  const match = line.match(/^(\d{4}-\d{2}-\d{2} [\d:.]+)/);
  if (!match) return null;
  const iso = match[1].replace(' ', 'T') + 'Z';
  return new Date(iso).toISOString();
}

function hashSessionPath(path: string): string {
  let hash = 0;
  for (let i = 0; i < path.length; i++) {
    hash = (hash * 31 + path.charCodeAt(i)) >>> 0;
  }
  return hash.toString(16);
}
