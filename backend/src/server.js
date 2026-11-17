import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import authRoutes from './routes/auth.routes.js';
import { errorHandler, notFound } from './middlewares/erros.js';

export const app = express();
const origemFront = process.env.FRONTEND_ORIGIN ?? 'http://localhost:5173';

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || origin === origemFront) return callback(null, true);
    return callback(new Error('Origem não permitida pelo CORS.'));
  },
}));
app.use(express.json({ limit: '64kb' }));
app.use('/api/auth', authRoutes);
app.use(notFound);
app.use(errorHandler);

const porta = Number(process.env.PORT ?? 3000);
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  app.listen(porta, () => console.log(`API disponível na porta ${porta}.`));
}

