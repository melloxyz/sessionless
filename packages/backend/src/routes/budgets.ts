import type { FastifyInstance } from 'fastify';
import {
  listBudgetLimits,
  createBudgetLimit,
  updateBudgetLimit,
  deleteBudgetLimit,
  getBudgetStatus,
  listAlerts,
  acknowledgeAlert,
  acknowledgeAllAlerts,
  checkBudgets,
} from '../analytics/budgets.js';

export function registerBudgetRoutes(app: FastifyInstance) {
  app.get('/api/budgets', async () => listBudgetLimits());

  app.post('/api/budgets', async (req, reply) => {
    const body = req.body as {
      scope_type?: string;
      scope_value?: string | null;
      limit_usd?: number;
      period?: string;
    };

    if (!body || typeof body.scope_type !== 'string' || typeof body.limit_usd !== 'number') {
      return reply.status(400).send({
        error: { code: 'INVALID_BUDGET', message: 'scope_type and limit_usd are required' },
      });
    }

    if (!['global', 'project', 'cli', 'model', 'provider'].includes(body.scope_type)) {
      return reply.status(400).send({
        error: {
          code: 'INVALID_SCOPE',
          message: 'scope_type must be one of: global, project, cli, model, provider',
        },
      });
    }

    const limit = createBudgetLimit({
      scope_type: body.scope_type,
      scope_value: body.scope_value ?? null,
      limit_usd: body.limit_usd,
      period: body.period,
    });

    return reply.status(201).send(limit);
  });

  app.put('/api/budgets/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = req.body as {
      scope_type?: string;
      scope_value?: string | null;
      limit_usd?: number;
      period?: string;
      enabled?: boolean;
    };

    const updated = updateBudgetLimit(Number(id), body);
    if (!updated) {
      return reply.status(400).send({
        error: { code: 'NO_CHANGES', message: 'No fields to update' },
      });
    }

    return { success: true };
  });

  app.delete('/api/budgets/:id', async (req) => {
    const { id } = req.params as { id: string };
    deleteBudgetLimit(Number(id));
    return { success: true };
  });

  app.get('/api/budgets/status', async () => getBudgetStatus());

  app.post('/api/budgets/check', async () => {
    const alerts = checkBudgets();
    return { alertsCreated: alerts.length, alerts };
  });

  app.get('/api/alerts', async (req) => {
    const query = req.query as { limit?: string; offset?: string };
    const limit = Number(query.limit) || 50;
    const offset = Number(query.offset) || 0;
    return listAlerts(limit, offset);
  });

  app.post('/api/alerts/:id/acknowledge', async (req) => {
    const { id } = req.params as { id: string };
    acknowledgeAlert(Number(id));
    return { success: true };
  });

  app.post('/api/alerts/acknowledge-all', async () => {
    acknowledgeAllAlerts();
    return { success: true };
  });
}
