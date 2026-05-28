import type { HTMLAttributes } from 'react';
import { cn } from '../../lib/utils.js';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  interactive?: boolean;
}

export function Card({ className, interactive, ...props }: CardProps) {
  return (
    <div
      className={cn(
        'rounded-lg border border-border bg-surface text-foreground',
        interactive &&
          'transition-colors duration-150 hover:border-border-strong hover:bg-surface-elevated focus-within:border-border-strong focus-within:bg-surface-elevated',
        className,
      )}
      {...props}
    />
  );
}

export function CardHeader({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('flex items-center justify-between gap-4 p-4 pb-0', className)} {...props} />
  );
}

export function CardContent({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('p-4', className)} {...props} />;
}

export function CardTitle({ className, ...props }: HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3
      className={cn(
        'font-mono text-sm font-semibold tracking-[-0.01em] text-foreground',
        className,
      )}
      {...props}
    />
  );
}

export function CardDescription({ className, ...props }: HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn('text-xs leading-5 text-subtle-foreground', className)} {...props} />;
}
