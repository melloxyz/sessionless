import type { SelectHTMLAttributes } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '../../lib/utils.js';

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  options: { label: string; value: string }[];
}

export function Select({ className, options, ...props }: SelectProps) {
  return (
    <div className="relative inline-flex w-full min-w-0 sm:w-auto sm:min-w-[10rem]">
      <select
        className={cn(
          'h-9 w-full appearance-none rounded-md border border-border bg-surface py-0 pl-3 pr-9 font-mono text-sm text-foreground outline-none transition-colors duration-150 hover:border-border-strong hover:bg-surface-hover focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent/20 disabled:cursor-not-allowed disabled:opacity-50',
          className,
        )}
        {...props}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-subtle-foreground" />
    </div>
  );
}
