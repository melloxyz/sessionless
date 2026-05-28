import type { SVGProps } from 'react';
import { Badge } from '../ui/Badge.js';
import { useTheme } from '../theme/ThemeProvider.js';
import { cn } from '../../lib/utils.js';

type LogoRoute = string | { light: string; dark: string };
type CustomLogo = 'opencode';

interface BrandMeta {
  label: string;
  initials: string;
  color: string;
  logo?: LogoRoute;
  customLogo?: CustomLogo;
}

const OPENAI = {
  light: 'https://svgl.app/library/openai.svg',
  dark: 'https://svgl.app/library/openai_dark.svg',
};
const ANTHROPIC = {
  light: 'https://svgl.app/library/anthropic_black.svg',
  dark: 'https://svgl.app/library/anthropic_white.svg',
};
const GOOGLE = 'https://svgl.app/library/google.svg';

const CLI_BRANDS: Record<string, BrandMeta> = {
  codex: { label: 'Codex CLI', initials: 'CX', color: '#8b5cf6', logo: OPENAI },
  claude: {
    label: 'Claude Code',
    initials: 'CL',
    color: '#d97706',
    logo: 'https://svgl.app/library/claude-ai-icon.svg',
  },
  opencode: { label: 'OpenCode', initials: 'OC', color: '#131010', customLogo: 'opencode' },
  gemini: { label: 'Gemini CLI', initials: 'GE', color: '#4285f4', logo: GOOGLE },
  kimi: {
    label: 'Kimi CLI',
    initials: 'KI',
    color: '#06b6d4',
    logo: 'https://svgl.app/library/kimi-icon.svg',
  },
  aider: { label: 'Aider', initials: 'AI', color: '#14b8a6' },
  qwen: {
    label: 'Qwen CLI',
    initials: 'QW',
    color: '#615ced',
    logo: {
      light: 'https://svgl.app/library/qwen_light.svg',
      dark: 'https://svgl.app/library/qwen_dark.svg',
    },
  },
  antigravity: {
    label: 'Antigravity',
    initials: 'AG',
    color: '#f59e0b',
    logo: 'https://svgl.app/library/antigravity.svg',
  },
};

const PROVIDER_BRANDS: Record<string, BrandMeta> = {
  openai: { label: 'OpenAI', initials: 'OA', color: '#111827', logo: OPENAI },
  anthropic: { label: 'Anthropic', initials: 'AN', color: '#d97706', logo: ANTHROPIC },
  google: { label: 'Google', initials: 'GO', color: '#4285f4', logo: GOOGLE },
  deepseek: {
    label: 'DeepSeek',
    initials: 'DS',
    color: '#2563eb',
    logo: 'https://svgl.app/library/deepseek.svg',
  },
  minimax: { label: 'MiniMax', initials: 'MM', color: '#7c3aed' },
  nvidia: {
    label: 'NVIDIA',
    initials: 'NV',
    color: '#76b900',
    logo: {
      light: 'https://svgl.app/library/nvidia-icon-light.svg',
      dark: 'https://svgl.app/library/nvidia-icon-dark.svg',
    },
  },
  opencode: { label: 'OpenCode', initials: 'OC', color: '#131010', customLogo: 'opencode' },
  'github-copilot': {
    label: 'GitHub Copilot',
    initials: 'CP',
    color: '#6366f1',
    logo: {
      light: 'https://svgl.app/library/copilot.svg',
      dark: 'https://svgl.app/library/copilot_dark.svg',
    },
  },
};

export function getBrandMeta(
  value: string | null | undefined,
  kind: 'cli' | 'provider' = 'cli',
): BrandMeta {
  const key = (value ?? 'unknown').toLowerCase();
  const map = kind === 'cli' ? CLI_BRANDS : PROVIDER_BRANDS;
  return (
    map[key] ?? {
      label: value || 'Unknown',
      initials: (value || 'UN').slice(0, 2).toUpperCase(),
      color: '#64748b',
    }
  );
}

export function BrandMark({
  value,
  kind = 'cli',
  size = 'md',
  className,
}: {
  value: string | null | undefined;
  kind?: 'cli' | 'provider';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}) {
  const { theme } = useTheme();
  const meta = getBrandMeta(value, kind);
  const logo = typeof meta.logo === 'string' ? meta.logo : meta.logo?.[theme];
  const CustomLogo = meta.customLogo === 'opencode' ? OpenCodeLogo : null;
  const sizeClass =
    size === 'sm'
      ? 'h-7 w-7 rounded-md text-[10px]'
      : size === 'lg'
        ? 'h-12 w-12 rounded-lg text-sm'
        : 'h-9 w-9 rounded-md text-xs';

  return (
    <div
      className={cn(
        'grid shrink-0 place-items-center border border-border bg-surface-elevated font-semibold text-white',
        sizeClass,
        className,
      )}
      style={{
        color: logo || CustomLogo ? undefined : '#fff',
        backgroundColor: logo || CustomLogo ? undefined : meta.color,
      }}
      title={meta.label}
    >
      {CustomLogo ? (
        <CustomLogo className="h-full w-full" />
      ) : logo ? (
        <img
          src={logo}
          alt={`${meta.label} logo`}
          className="h-4/5 w-4/5 object-contain"
          loading="lazy"
        />
      ) : (
        meta.initials
      )}
    </div>
  );
}

function OpenCodeLogo(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 512 512" fill="none" aria-hidden="true" {...props}>
      <rect width="512" height="512" fill="#131010" />
      <path d="M320 224V352H192V224H320Z" fill="#5A5858" />
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M384 416H128V96H384V416ZM320 160H192V352H320V160Z"
        fill="white"
      />
    </svg>
  );
}

export function BrandBadge({
  value,
  kind = 'cli',
}: {
  value: string | null | undefined;
  kind?: 'cli' | 'provider';
}) {
  const meta = getBrandMeta(value, kind);

  return (
    <Badge variant="neutral" className="gap-1.5 py-1 pr-2.5">
      <BrandMark
        value={value}
        kind={kind}
        size="sm"
        className="h-4 w-4 rounded-[4px] border-0 text-[7px] shadow-none"
      />
      {meta.label}
    </Badge>
  );
}
