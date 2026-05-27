import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

export type DateRangeValue = '7d' | '30d' | '90d' | 'all';

const STORAGE_KEY = 'sessionless-date-range';

const DateRangeContext = createContext<{
  range: DateRangeValue;
  setRange: (range: DateRangeValue) => void;
  queryString: string;
  queryParams: Record<string, string>;
} | null>(null);

function getInitialRange(): DateRangeValue {
  if (typeof window === 'undefined') return '30d';
  const stored = window.localStorage.getItem(STORAGE_KEY);
  return stored === '7d' || stored === '30d' || stored === '90d' || stored === 'all' ? stored : '30d';
}

export function getDateRangeParams(range: DateRangeValue): Record<string, string> {
  if (range === 'all') return {};
  const days = range === '7d' ? 7 : range === '90d' ? 90 : 30;
  const date = new Date();
  date.setDate(date.getDate() - days);
  return { dateFrom: date.toISOString() };
}

export function DateRangeProvider({ children }: { children: ReactNode }) {
  const [range, setRange] = useState<DateRangeValue>(getInitialRange);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, range);
  }, [range]);

  const value = useMemo(() => {
    const queryParams = getDateRangeParams(range);
    return {
      range,
      setRange,
      queryParams,
      queryString: new URLSearchParams(queryParams).toString(),
    };
  }, [range]);

  return <DateRangeContext.Provider value={value}>{children}</DateRangeContext.Provider>;
}

export function useDateRange() {
  const value = useContext(DateRangeContext);
  if (!value) throw new Error('useDateRange must be used inside DateRangeProvider');
  return value;
}
