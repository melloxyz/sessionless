import type { LucideIcon } from 'lucide-react';
import { AlertTriangle } from 'lucide-react';
import { Card, CardContent } from './Card.js';
import { Badge } from './Badge.js';

export function ErrorState({
  title,
  message,
  code,
  details,
  icon: Icon = AlertTriangle,
  onRetry,
}: {
  title: string;
  message: string;
  code?: string;
  details?: string;
  icon?: LucideIcon;
  onRetry?: () => void;
}) {
  return (
    <Card>
      <CardContent className="space-y-3 p-5">
        <div className="flex items-start gap-3">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-danger-soft text-danger">
            <Icon className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="font-semibold text-foreground">{title}</h3>
              {code && <Badge variant="danger">{code}</Badge>}
            </div>
            <p className="mt-1 text-sm text-subtle-foreground">{message}</p>
            {details && <pre className="mt-3 overflow-auto rounded-2xl border border-border bg-surface-muted p-3 text-xs text-muted-foreground">{details}</pre>}
          </div>
        </div>
        {onRetry && (
          <button type="button" onClick={onRetry} className="inline-flex rounded-xl border border-border px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-surface-elevated">
            Retry
          </button>
        )}
      </CardContent>
    </Card>
  );
}
