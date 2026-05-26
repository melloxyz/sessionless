import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, FolderOpen } from 'lucide-react';
import {
  AreaChart, Area, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { useApi } from '../hooks/useApi.js';
import { formatCurrency, formatDate } from '../lib/format.js';
import { Card, CardContent } from '../components/ui/Card.js';
import { Badge } from '../components/ui/Badge.js';
import { ErrorState } from '../components/ui/ErrorState.js';

const COLORS = ['#6366f1', '#818cf8', '#a78bfa', '#22c55e', '#eab308', '#ef4444'];

export function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data, loading, error, refetch } = useApi<{
    project: Record<string, unknown>;
    sessions: Record<string, unknown>[];
    providerBreakdown: Record<string, unknown>[];
    modelBreakdown: Record<string, unknown>[];
    spendOverTime: Record<string, unknown>[];
  }>(`/api/projects/${id}`);

  if (loading) return <div className="p-6 space-y-4"><div className="h-6 w-32 animate-pulse rounded bg-bg-elevated" /></div>;
  if (error) return <div className="p-6"><ErrorState title="Project failed to load" message={error.message} code={error.code} details={error.details} onRetry={refetch} /></div>;
  if (!data?.project) return <div className="p-6 text-text-tertiary">Project not found</div>;

  const p = data.project;

  return (
    <div className="space-y-6 p-6">
      <Link to="/projects" className="inline-flex items-center gap-1 text-sm text-text-tertiary hover:text-text-primary transition-colors">
        <ArrowLeft className="h-4 w-4" /> Back to projects
      </Link>

      <div>
        <div className="flex items-center gap-2">
          <FolderOpen className="h-5 w-5 text-text-tertiary" />
          <h1 className="text-lg font-semibold text-text-primary">{String(p.path).split('\\').pop() || String(p.path)}</h1>
        </div>
        <p className="text-sm text-text-tertiary mt-1">{String(p.path)}</p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card><CardContent className="py-3"><div className="text-xs text-text-tertiary uppercase mb-1">Sessions</div><div className="text-xl font-semibold text-text-primary">{String(p.total_sessions)}</div></CardContent></Card>
        <Card><CardContent className="py-3"><div className="text-xs text-text-tertiary uppercase mb-1">Total Cost</div><div className="text-xl font-semibold text-text-primary">{formatCurrency(p.total_cost as number)}</div></CardContent></Card>
        <Card><CardContent className="py-3"><div className="text-xs text-text-tertiary uppercase mb-1">Avg Cost</div><div className="text-xl font-semibold text-text-primary">{formatCurrency((Number(p.total_cost) || 0) / (Number(p.total_sessions) || 1))}</div></CardContent></Card>
        <Card><CardContent className="py-3"><div className="text-xs text-text-tertiary uppercase mb-1">Git Remote</div><div className="text-sm font-medium text-text-primary truncate">{String(p.git_remote ?? '—')}</div></CardContent></Card>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <div className="p-5 pb-0"><h3 className="text-sm font-medium text-text-primary">Spend Over Time</h3></div>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={data.spendOverTime.map((d: any) => ({ ...d, spend: Number(d.spend) }))}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f1f1f" />
                <XAxis dataKey="day" tick={{ fontSize: 11, fill: '#555' }} />
                <YAxis tick={{ fontSize: 11, fill: '#555' }} tickFormatter={(v: number) => `$${v.toFixed(0)}`} />
                <Tooltip contentStyle={{ background: '#141414', border: '1px solid #2a2a2a', borderRadius: 8, fontSize: 12 }} />
                <Area type="monotone" dataKey="spend" stroke="#6366f1" fill="rgba(99,102,241,0.15)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <div className="p-5 pb-0"><h3 className="text-sm font-medium text-text-primary">Model Distribution</h3></div>
          <CardContent className="flex items-center gap-6">
            <ResponsiveContainer width="55%" height={180}>
              <PieChart>
                <Pie data={data.modelBreakdown.map((d: any) => ({ name: d.model || 'unknown', value: Number(d.cost) }))} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} innerRadius={40}>
                  {data.modelBreakdown.map((_: any, i: number) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip contentStyle={{ background: '#141414', border: '1px solid #2a2a2a', borderRadius: 8, fontSize: 12 }} formatter={(v: number) => [`$${v.toFixed(2)}`, 'Cost']} />
              </PieChart>
            </ResponsiveContainer>
            <div className="space-y-1.5 text-xs">
              {data.modelBreakdown.map((d: any, i: number) => (
                <div key={i} className="flex items-center gap-2">
                  <div className="h-2.5 w-2.5 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />
                  <span className="text-text-secondary">{d.model || 'unknown'}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <div className="p-5 pb-0"><h3 className="text-sm font-medium text-text-primary">Sessions</h3></div>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border-secondary text-text-tertiary">
                  <th className="px-4 py-3 text-left font-medium">Date</th>
                  <th className="px-4 py-3 text-left font-medium">Model</th>
                  <th className="px-4 py-3 text-right font-medium">Cost</th>
                  <th className="px-4 py-3 text-right font-medium">Duration</th>
                  <th className="px-4 py-3 text-right font-medium">Confidence</th>
                </tr>
              </thead>
              <tbody>
                {data.sessions.map((s: any) => (
                  <tr key={s.id} className="border-b border-border-secondary hover:bg-bg-hover transition-colors">
                    <td className="px-4 py-3 text-text-primary">
                      <Link to={`/sessions/${s.id}`} className="hover:text-accent-hover">{formatDate(String(s.started_at))}</Link>
                    </td>
                    <td className="px-4 py-3 text-text-primary">{String(s.model ?? '—')}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-text-primary">{formatCurrency(Number(s.total_cost_usd))}</td>
                    <td className="px-4 py-3 text-right text-text-secondary">{(Number(s.duration_ms) / 60000).toFixed(0)} min</td>
                    <td className="px-4 py-3 text-right"><Badge variant={s.source_confidence === 'HIGH' ? 'success' : s.source_confidence === 'MEDIUM' ? 'default' : 'warning'}>{s.source_confidence}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
