import type { Handler, HandlerContext, HandlerEvent, HandlerResponse } from '@netlify/functions';
import serverless from 'serverless-http';
import { createApiApp } from '../../server/apiApp.ts';

const app = createApiApp();
const baseHandler = serverless(app);

function normalizeApiPath(rawPath: string | undefined): string {
  const p = rawPath || '/api';
  if (p.startsWith('/.netlify/functions/api')) {
    const tail = p.slice('/.netlify/functions/api'.length);
    return `/api${tail.startsWith('/') || !tail ? tail : `/${tail}`}`;
  }
  if (!p.startsWith('/api')) {
    return `/api${p.startsWith('/') ? p : `/${p}`}`;
  }
  return p;
}

export const handler: Handler = async (
  event: HandlerEvent,
  context: HandlerContext
): Promise<HandlerResponse> => {
  const normalizedEvent: HandlerEvent = {
    ...event,
    path: normalizeApiPath(event.path),
  };

  if (event.rawUrl) {
    try {
      const parsed = new URL(event.rawUrl);
      parsed.pathname = normalizeApiPath(parsed.pathname);
      normalizedEvent.rawUrl = parsed.toString();
    } catch {
      // Leave rawUrl intact if malformed
    }
  }

  return (await baseHandler(normalizedEvent, context)) as HandlerResponse;
};
