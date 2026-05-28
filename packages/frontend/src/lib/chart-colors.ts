export const CHART_COLORS = [
  '#0a84ff',
  '#64d2ff',
  '#30d158',
  '#ff9f0a',
  '#ff453a',
  '#9a9898',
  '#2dd4bf',
];

export const CLI_COLORS: Record<string, string> = {
  codex: '#0a84ff',
  opencode: '#5a5858',
  claude: '#ff9f0a',
  gemini: '#64d2ff',
  kimi: '#2dd4bf',
  aider: '#30d158',
  qwen: '#3b82f6',
  antigravity: '#ffb340',
};

export function chartColor(index: number) {
  return CHART_COLORS[index % CHART_COLORS.length];
}
