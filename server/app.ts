import type { IncomingMessage, ServerResponse } from 'node:http';
import { handle, Router } from './http.js';
import { adminRoutes } from './routes/admin.js';
import { authRoutes } from './routes/auth.js';
import { businessRoutes } from './routes/business.js';
import { travelerRoutes } from './routes/traveler.js';

const router = new Router();
authRoutes(router);
travelerRoutes(router);
businessRoutes(router);
adminRoutes(router);

export default function app(req: IncomingMessage, res: ServerResponse) {
  return handle(router, req, res);
}
