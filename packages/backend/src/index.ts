import 'dotenv/config';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import { initDatabase, runMigrations, seedModels } from './db/index.js';
import { createCodexAdapter, createClaudeAdapter, createOpencodeAdapter, createGeminiAdapter, createKimiAdapter, createAiderAdapter, createQwenAdapter, createAntigravityAdapter, registry } from './adapters/index.js';
import { runIngestion, getLastStatus } from './ingestion/engine.js';
import { getAutoIngestionStatus, setAutoIngestionEnabled, startAutoIngestion } from './ingestion/watcher.js';
import { registerOverviewRoutes } from './routes/overview.js';
import { registerAnalyticsRoutes } from './routes/analytics.js';
import { registerSessionRoutes } from './routes/sessions.js';
import { registerProjectRoutes } from './routes/projects.js';
import { registerModelRoutes } from './routes/models.js';
import { syncOpenRouterPricing } from './openrouter.js';

const PORT = Number(process.env.SESSIONLESS_PORT || process.env.AIMETER_PORT) || 3030;

async function main() {
  try {
    await initDatabase();
    runMigrations();
    seedModels();

    registry.register(createCodexAdapter());
    registry.register(createClaudeAdapter());
    registry.register(createOpencodeAdapter());
    registry.register(createGeminiAdapter());
    registry.register(createKimiAdapter());
    registry.register(createAiderAdapter());
    registry.register(createQwenAdapter());
    registry.register(createAntigravityAdapter());

    const app = Fastify({ logger: true });
    await app.register(cors, { origin: true });

    app.get('/api/health', async () => ({ status: 'ok', timestamp: new Date().toISOString() }));

    registerOverviewRoutes(app);
    registerAnalyticsRoutes(app);
    registerSessionRoutes(app);
    registerProjectRoutes(app);
    registerModelRoutes(app);

    app.get('/api/ingest/status', async () => {
      const status = getLastStatus();
      if (!status) return { message: 'No ingestion run yet', autoIngestion: getAutoIngestionStatus() };
      return status.errors.length > 0
        ? { ...status, autoIngestion: getAutoIngestionStatus(), error: { code: 'INGESTION_WARNINGS', message: 'Ingestion completed with warnings' } }
        : { ...status, autoIngestion: getAutoIngestionStatus() };
    });

    app.get('/api/ingest/auto', async () => getAutoIngestionStatus());

    app.post('/api/ingest/auto', async (req, reply) => {
      const body = req.body as { enabled?: unknown };
      if (typeof body?.enabled !== 'boolean') {
        return reply.status(400).send({ error: { code: 'INVALID_AUTO_INGESTION_SETTING', message: 'enabled must be a boolean' } });
      }
      return setAutoIngestionEnabled(body.enabled);
    });

    app.get('/api/integrations/status', async () => {
      const adapters = registry.getAll();
      const resolved = await Promise.all(adapters.map(async (adapter) => ({
        cli: adapter.cli,
        status: await adapter.detect() ? 'available' : 'missing',
      })));
      return {
        integrations: resolved,
      };
    });

    app.post('/api/ingest', async () => {
      const status = await runIngestion();
      return status;
    });

    await app.listen({ port: PORT, host: '127.0.0.1' });
    await startAutoIngestion(app.log);
    void (async () => {
      try {
        await syncOpenRouterPricing();
      } catch (err) {
        app.log.warn(err, 'OpenRouter pricing sync failed');
      }
      try {
        await runIngestion();
      } catch (err) {
        app.log.error(err, 'Initial ingestion failed');
      }
    })();
  } catch (err) {
    console.error('Sessionless backend startup failed:', err);
    process.exit(1);
  }
}

void main();
