import { Router } from 'express';
import { asyncHandler } from '../middlewares/erros.js';
import { autenticar } from '../middlewares/autenticar.js';
import { relatorioCategorias, relatorioFontesDestinos, relatorioFaturas } from '../models/relatorioModel.js';

const router = Router();
router.use(autenticar);

function dataValida(valor) {
  if (typeof valor !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(valor)) return false;
  const [ano, mes, dia] = valor.split('-').map(Number);
  const data = new Date(Date.UTC(ano, mes - 1, dia));
  return data.getUTCFullYear() === ano && data.getUTCMonth() === mes - 1 && data.getUTCDate() === dia;
}

function somarDias(dataIso, dias) {
  const [ano, mes, dia] = dataIso.split('-').map(Number);
  return new Date(Date.UTC(ano, mes - 1, dia + dias)).toISOString().slice(0, 10);
}

function periodoDaRequisicao(query) {
  const agora = new Date();
  const ano = agora.getFullYear();
  const mes = agora.getMonth();
  const inicioPadrao = new Date(Date.UTC(ano, mes, 1)).toISOString().slice(0, 10);
  const fimPadrao = new Date(Date.UTC(ano, mes + 1, 0)).toISOString().slice(0, 10);
  const inicio = query.inicio || inicioPadrao;
  const fim = query.fim || fimPadrao;
  const campos = {};
  if (!dataValida(inicio)) campos.inicio = 'Informe uma data inicial válida (AAAA-MM-DD).';
  if (!dataValida(fim)) campos.fim = 'Informe uma data final válida (AAAA-MM-DD).';
  if (dataValida(inicio) && dataValida(fim) && inicio > fim) campos.fim = 'A data final deve ser igual ou posterior à inicial.';
  if (Object.keys(campos).length) return { campos };
  const dias = Math.round((Date.parse(`${fim}T00:00:00Z`) - Date.parse(`${inicio}T00:00:00Z`)) / 86400000) + 1;
  return {
    periodo: {
      inicio, fim,
      anteriorFim: somarDias(inicio, -1),
      anteriorInicio: somarDias(inicio, -dias),
    },
  };
}

router.get('/categorias', asyncHandler(async (req, res) => {
  const { periodo, campos } = periodoDaRequisicao(req.query);
  if (campos) return res.status(400).json({ erro: 'Revise o período informado.', campos });
  return res.json(await relatorioCategorias(req.usuarioId, periodo));
}));

router.get('/fontes-destinos', asyncHandler(async (req, res) => {
  const { periodo, campos } = periodoDaRequisicao(req.query);
  if (campos) return res.status(400).json({ erro: 'Revise o período informado.', campos });
  return res.json(await relatorioFontesDestinos(req.usuarioId, periodo));
}));

router.get('/faturas', asyncHandler(async (req, res) => {
  const informado = req.query.meses === undefined ? 3 : Number(req.query.meses);
  if (!Number.isInteger(informado) || informado < 1 || informado > 12) {
    return res.status(400).json({ erro: 'O número de faturas deve ser um inteiro entre 1 e 12.', campos: { meses: 'Use um inteiro de 1 a 12.' } });
  }
  return res.json(await relatorioFaturas(req.usuarioId, Math.max(3, informado)));
}));

export default router;
