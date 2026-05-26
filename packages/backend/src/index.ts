import 'dotenv/config';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import { initDatabase, runMigrations, seedModels } from './db/index.js';
import { createCodexAdapter, createClaudeAdapter, createOpencodeAdapter, registry } from './adapters/index.js';
import { runIngestion, getLastStatus } from './ingestion/engine.js';
import { registerOverviewRoutes } from './routes/overview.js';
import { registerAnalyticsRoutes } from './routes/analytics.js';
import { registerSessionRoutes } from './routes/sessions.js';
import { registerProjectRoutes } from './routes/projects.js';
import { registerModelRoutes } from './routes/models.js';

const PORT = Number(process.env.AIMETER_PORT) || 3030;

async function main() {
  await initDatabase();
  runMigrations();
  seedModels();

  registry.register(createCodexAdapter());
  registry.register(createClaudeAdapter());
  registry.register(createOpencodeAdapter());

  const app = Fastify({ logger: true });
  await app.register(cors, { origin: true });

  registerOverviewRoutes(app);
  registerAnalyticsRoutes(app);
  registerSessionRoutes(app);
  registerProjectRoutes(app);
  registerModelRoutes(app);

  app.get('/api/ingest/status', async () => {
    const status = getLastStatus();
    if (!status) return { message: 'No ingestion run yet' };
    return status.errors.length > 0
      ? { ...status, error: { code: 'INGESTION_WARNINGS', message: 'Ingestion completed with warnings' } }
      : status;
  });

  app.post('/api/ingest', async () => {
    const status = await runIngestion();
    return status;
  });

  try {
    await runIngestion();
  } catch (err) {
    app.log.error(err, 'Initial ingestion failed');
  }

  try {
    await app.listen({ port: PORT, host: '127.0.0.1' });
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

main();
