import type { IncomingMessage, ServerResponse } from 'http';
import { createApiApp } from '../server/apiApp.ts';

const app = createApiApp();

export default function handler(req: IncomingMessage, res: ServerResponse) {
  const currentUrl = req.url || '/';
  if (!currentUrl.startsWith('/api')) {
    req.url = `/api${currentUrl.startsWith('/') ? currentUrl : `/${currentUrl}`}`;
  }
  return app(req as Parameters<typeof app>[0], res as Parameters<typeof app>[1]);
}
