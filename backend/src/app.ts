import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { env } from './config/env.js';
import { errorHandler } from './middleware/auth.js';
import { authRouter } from './modules/auth/auth.routes.js';

export const app = express();
app.set('trust proxy', 1);
app.disable('x-powered-by');
app.use(helmet());
app.use(cors({ origin: env.FRONTEND_URL, credentials: true }));
// Etapa 3: o webhook do Mercado Pago precisará do corpo bruto para validar a assinatura (montar ANTES do express.json).
app.use(express.json({ limit: '100kb' }));
app.use(cookieParser());

app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));
app.use('/api/auth', authRouter);
app.use(errorHandler);
