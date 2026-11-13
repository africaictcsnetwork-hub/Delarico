import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import express, { type Request, type Response } from 'express';
import { createApiApp, syncCatalogToFirestore } from './server/apiApp.ts';

async function startServer() {
  const app = createApiApp();
  const rawPort = process.env.PORT || '3000';
  const port: number | string = /^\d+$/.test(rawPort) ? Number(rawPort) : rawPort;
  const isProduction = process.env.NODE_ENV === 'production';

  // Serve public assets (brand logos & Kenyan hardware product photos)
  app.use(
    '/assets',
    express.static(path.join(process.cwd(), 'public', 'assets'), {
      maxAge: '7d',
      etag: true,
    })
  );

  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    const indexHtmlPath = path.join(distPath, 'index.html');

    app.use(
      express.static(distPath, {
        index: false,
        maxAge: '7d',
        etag: true,
        setHeaders(res, filePath) {
          if (filePath.endsWith('.html')) {
            res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
          }
        },
      })
    );

    app.use((req: Request, res: Response, next) => {
      if (req.method !== 'GET' && req.method !== 'HEAD') {
        next();
        return;
      }
      if (!fs.existsSync(indexHtmlPath)) {
        res.status(503).send('Storefront build missing. Run "npm run build" before starting in production.');
        return;
      }
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.sendFile(indexHtmlPath);
    });
  }

  const onListening = () => {
    const label = typeof port === 'number' ? `http://0.0.0.0:${port}` : String(port);
    console.log(`[DELARICO] Server running (${isProduction ? 'production' : 'development'}) on ${label}`);
    void syncCatalogToFirestore(false);
  };

  const server =
    typeof port === 'number'
      ? app.listen(port, '0.0.0.0', onListening)
      : app.listen(port, onListening);

  const shutdown = (signal: string) => {
    console.log(`[DELARICO] Received ${signal}, shutting down cleanly...`);
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 5000).unref();
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

void startServer();
