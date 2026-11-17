import { Router } from 'express';
import { asyncHandler } from '../middlewares/erros.js';
import { autenticar } from '../middlewares/autenticar.js';
import { obterSaudeFinanceira } from '../models/saudeFinanceiraModel.js';

const router = Router();
router.use(autenticar);
router.get('/', asyncHandler(async (req, res) => res.json(await obterSaudeFinanceira(req.usuarioId))));

export default router;
