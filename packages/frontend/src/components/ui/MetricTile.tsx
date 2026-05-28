import type { LucideIcon } from 'lucide-react';
import { Card, CardContent } from './Card.js';
import { Skeleton } from './Skeleton.js';
import { cn } from '../../lib/utils.js';

export type MetricTone = 'success' | 'warning' | 'danger' | 'info';

interface MetricTileProps {
  label: string;
  value: string;
  meta?: string;
  tone?: MetricTone;
  icon?: LucideIcon;
  loading?: boolean;
  sparkline?: boolean;
  className?: string;
}

const toneMap: Record<MetricTone, string> = {
  success: 'border-success/20 bg-success-soft text-success',
  warning: 'border-warning/20 bg-warning-soft text-warning',
  danger: 'border-danger/20 bg-danger-soft text-danger',
  info: 'border-info/20 bg-info-soft text-info',
};

export function MetricTile({
  label,
  value,
  meta,
  tone = 'success',
  icon: Icon,
  loading,
  sparkline,
  className,
}: MetricTileProps) {
  return (
    <Card interactive className={cn('overflow-hidden', className)}>
      <CardContent className="relative flex min-h-[132px] flex-col justify-between p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 space-y-3">
            <p className="truncate font-mono text-[10px] font-medium uppercase tracking-[0.16em] text-subtle-foreground">
              {label}
            </p>
            {loading ? (
              <Skeleton className="h-9 w-28" />
            ) : (
              <div className="truncate font-mono text-[1.85rem] font-semibold leading-none tracking-[-0.06em] text-foreground">
                {value}
              </div>
            )}
          </div>
          {Icon && (
            <div
              className={cn(
                'grid h-9 w-9 shrink-0 place-items-center rounded-md border',
                toneMap[tone],
              )}
            >
              <Icon className="h-4 w-4" />
            </div>
          )}
        </div>

        {meta && (
          <div
            className={cn(
              'relative z-10 mt-5 w-fit rounded border px-2 py-1 font-mono text-[10px] font-medium uppercase leading-none tracking-[0.08em]',
              toneMap[tone],
            )}
          >
            {meta}
          </div>
        )}
        {sparkline && (
          <svg
            className="pointer-events-none absolute bottom-0 right-0 h-20 w-32 translate-x-3 translate-y-3 opacity-[0.14]"
            viewBox="0 0 128 80"
            fill="none"
            aria-hidden="true"
          >
            <path
              d="M4 60L19 50L34 56L49 34L64 40L80 23L96 31L124 10"
              stroke="currentColor"
              className="text-accent"
              strokeWidth="3"
              strokeLinecap="round"
            />
            <path
              d="M4 60L19 50L34 56L49 34L64 40L80 23L96 31L124 10V80H4V60Z"
              className="fill-accent"
              opacity="0.18"
            />
          </svg>
        )}
      </CardContent>
    </Card>
  );
}
