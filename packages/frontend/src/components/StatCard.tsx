import type { LucideIcon } from 'lucide-react';
import { MetricTile } from './ui/MetricTile.js';

interface StatCardProps {
  label: string;
  value: string;
  change?: string;
  changeTone?: 'success' | 'warning' | 'danger' | 'info';
  icon?: LucideIcon;
  loading?: boolean;
  sparkline?: boolean;
  compact?: boolean;
  iconVariant?: 'tone' | 'neutral';
}

export function StatCard({
  label,
  value,
  change,
  changeTone = 'success',
  icon: Icon,
  loading,
  sparkline,
  compact,
  iconVariant,
}: StatCardProps) {
  return (
    <MetricTile
      label={label}
      value={value}
      meta={change}
      tone={changeTone}
      icon={Icon}
      loading={loading}
      sparkline={sparkline}
      compact={compact}
      iconVariant={iconVariant}
    />
  );
}
