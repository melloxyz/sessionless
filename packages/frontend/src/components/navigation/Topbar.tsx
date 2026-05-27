import { CalendarDays, RefreshCw } from 'lucide-react';
import { useDateRange } from '../filters/DateRangeProvider.js';
import { useI18n } from '../i18n/LanguageProvider.js';
import { Button } from '../ui/Button.js';
import { Select } from '../ui/Select.js';

interface TopbarProps {
  title: string;
  subtitle?: string;
  onRefresh?: () => void;
  showDateRange?: boolean;
}

export function Topbar({ title, subtitle, onRefresh, showDateRange }: TopbarProps) {
  const { t } = useI18n();
  const { range, setRange } = useDateRange();

  return (
    <header className="sticky top-0 z-20 flex min-h-20 items-center justify-between gap-4 border-b border-border bg-background/88 px-6 backdrop-blur-xl">
      <div className="min-w-0">
        <h1 className="truncate text-xl font-semibold tracking-[-0.03em] text-foreground">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
      </div>

      <div className="hidden items-center gap-2 md:flex">
        {showDateRange && (
          <div className="relative flex items-center">
            <CalendarDays className="pointer-events-none absolute left-3 z-10 h-4 w-4 text-subtle-foreground" />
            <Select
              value={range}
              onChange={(event) => setRange(event.target.value as typeof range)}
              className="min-w-[150px] pl-9"
              options={[
                { label: t('common.last7'), value: '7d' },
                { label: t('common.last30'), value: '30d' },
                { label: t('common.last90'), value: '90d' },
                { label: t('common.allTime'), value: 'all' },
              ]}
            />
          </div>
        )}
        <Button variant="outline" size="icon" aria-label="Refresh" onClick={onRefresh}>
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>
    </header>
  );
}
