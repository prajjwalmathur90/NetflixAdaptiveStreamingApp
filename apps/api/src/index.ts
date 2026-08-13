import express from 'express';
import cors from 'cors';
import { config } from './config';

const app = express();

app.use(
  cors({
    origin: config.corsOrigin,
  }),
);

app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    mediaRoot: config.mediaRoot,
    implementation: 'starter',
  });
});

app.listen(config.port, () => {
  console.log(`API server running on http://localhost:${config.port}`);
  console.log(`Health check: http://localhost:${config.port}/health`);
});
