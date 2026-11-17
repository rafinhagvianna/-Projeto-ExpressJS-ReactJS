import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import { asyncHandler } from '../middlewares/erros.js';
import { autenticar } from '../middlewares/autenticar.js';
import {
  atualizarLancamento, buscarLancamento, criarLancamentosTransacao,
  listarLancamentos, removerLancamento, validarCategoriaFonte,
} from '../models/lancamentoModel.js';
import { dividirParcelas, valorEmCentavos } from '../models/utilitarios.js';

const router = Router();
router.use(autenticar);

function dataValida(data) {
  if (typeof data !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(data)) return false;
  const [ano, mes, dia] = data.split('-').map(Number);
  const dataUtc = new Date(Date.UTC(ano, mes - 1, dia));
  return dataUtc.getUTCFullYear() === ano && dataUtc.getUTCMonth() === mes - 1 && dataUtc.getUTCDate() === dia;
}

function idPositivo(valor) {
  const n = Number(valor);
  return Number.isSafeInteger(n) && n > 0 ? n : null;
}

function validarDados(body) {
  const campos = {};
  const tipo = body.tipo;
  const descricao = typeof body.descricao === 'string' ? body.descricao.trim() : '';
  const data = body.data;
  const categoriaId = idPositivo(body.categoria_id ?? body.categoriaId);
  const fonteDestinoId = idPositivo(body.fonte_destino_id ?? body.fonteDestinoId);
  let centavos = null;
  try {
    centavos = valorEmCentavos(body.valor);
  } catch {
    campos.valor = 'Informe um valor positivo com até duas casas decimais.';
  }

  if (!['entrada', 'saida'].includes(tipo)) campos.tipo = 'Tipo deve ser entrada ou saida.';
  if (!descricao || descricao.length > 120) campos.descricao = 'Informe uma descrição com até 120 caracteres.';
  if (!dataValida(data)) campos.data = 'Informe uma data válida no formato AAAA-MM-DD.';
  if (!categoriaId) campos.categoria_id = 'Selecione uma categoria válida.';
  if (!fonteDestinoId) campos.fonte_destino_id = 'Selecione uma fonte ou destino válido.';

  const totalParcelas = body.total_parcelas === undefined && body.totalParcelas === undefined
    ? 1 : Number(body.total_parcelas ?? body.totalParcelas);
  if (!Number.isInteger(totalParcelas) || totalParcelas < 1 || totalParcelas > 48) {
    campos.total_parcelas = 'O parcelamento deve ter de 1 a 48 parcelas.';
  } else if (centavos !== null && totalParcelas > centavos) {
    campos.total_parcelas = 'O valor é pequeno demais para essa quantidade de parcelas.';
  }

  return {
    campos,
    centavos,
    totalParcelas,
    dados: { tipo, descricao, data, categoria_id: categoriaId, fonte_destino_id: fonteDestinoId },
  };
}

function validarCompatibilidade(tipo, relacoes, totalParcelas) {
  const campos = {};
  if (relacoes.categoria_tipo !== tipo) campos.categoria_id = 'A categoria precisa ter o mesmo tipo do lançamento.';
  if (tipo === 'entrada' && relacoes.fonte_destino_tipo === 'cartao_credito') {
    campos.fonte_destino_id = 'Entradas não podem ser registradas em cartão de crédito.';
  }
  if (tipo === 'saida' && relacoes.fonte_destino_tipo === 'renda') {
    campos.fonte_destino_id = 'Saídas precisam usar uma conta ou cartão de crédito.';
  }
  if (totalParcelas > 1 && relacoes.fonte_destino_tipo !== 'cartao_credito') {
    campos.total_parcelas = 'Parcelamento só é permitido em cartão de crédito.';
  }
  return campos;
}

function parametrosDeLista(query) {
  const hoje = new Date();
  const ano = hoje.getFullYear();
  const mes = hoje.getMonth();
  const primeiroDia = new Date(Date.UTC(ano, mes, 1)).toISOString().slice(0, 10);
  const ultimoDia = new Date(Date.UTC(ano, mes + 1, 0)).toISOString().slice(0, 10);
  const inicio = query.inicio || primeiroDia;
  const fim = query.fim || ultimoDia;
  const pagina = query.pagina === undefined ? 1 : Number(query.pagina);
  const limite = query.limite === undefined ? 20 : Number(query.limite);
  const tipo = query.tipo || null;
  const categoriaId = query.categoriaId ? idPositivo(query.categoriaId) : null;
  const fonteDestinoId = query.fonteDestinoId ? idPositivo(query.fonteDestinoId) : null;
  const campos = {};
  if (!dataValida(inicio)) campos.inicio = 'Data inicial inválida.';
  if (!dataValida(fim)) campos.fim = 'Data final inválida.';
  if (dataValida(inicio) && dataValida(fim) && inicio > fim) campos.fim = 'Data final deve ser igual ou posterior à inicial.';
  if (!Number.isInteger(pagina) || pagina < 1) campos.pagina = 'Página deve ser um inteiro positivo.';
  if (!Number.isInteger(limite) || limite < 1 || limite > 100) campos.limite = 'Limite deve estar entre 1 e 100.';
  if (tipo && !['entrada', 'saida'].includes(tipo)) campos.tipo = 'Tipo deve ser entrada ou saida.';
  if (query.categoriaId && !categoriaId) campos.categoriaId = 'Categoria inválida.';
  if (query.fonteDestinoId && !fonteDestinoId) campos.fonteDestinoId = 'Fonte ou destino inválido.';
  return { campos, filtros: { inicio, fim, pagina, limite, tipo, categoriaId, fonteDestinoId } };
}

router.get('/', asyncHandler(async (req, res) => {
  const { campos, filtros } = parametrosDeLista(req.query);
  if (Object.keys(campos).length) return res.status(400).json({ erro: 'Revise os filtros informados.', campos });
  return res.json(await listarLancamentos(req.usuarioId, filtros));
}));

router.get('/:id', asyncHandler(async (req, res) => {
  const id = idPositivo(req.params.id);
  if (!id) return res.status(404).json({ erro: 'Lançamento não encontrado.' });
  const lancamento = await buscarLancamento(req.usuarioId, id);
  if (!lancamento) return res.status(404).json({ erro: 'Lançamento não encontrado.' });
  return res.json({ lancamento });
}));

router.post('/', asyncHandler(async (req, res) => {
  if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) return res.status(400).json({ erro: 'Informe os dados do lançamento.' });
  const { campos, centavos, totalParcelas, dados } = validarDados(req.body);
  if (Object.keys(campos).length) return res.status(400).json({ erro: 'Revise os campos informados.', campos });
  const relacoes = await validarCategoriaFonte(req.usuarioId, dados.categoria_id, dados.fonte_destino_id);
  if (!relacoes) return res.status(404).json({ erro: 'Categoria ou fonte/destino não encontrada.' });
  const incompatibilidade = validarCompatibilidade(dados.tipo, relacoes, totalParcelas);
  if (Object.keys(incompatibilidade).length) return res.status(400).json({ erro: 'Categoria, fonte ou parcelamento incompatível.', campos: incompatibilidade });

  const parcelas = totalParcelas > 1 ? dividirParcelas(req.body.valor, totalParcelas) : [centavos];
  const grupo = totalParcelas > 1 ? randomUUID() : null;
  try {
    const lancamentos = await criarLancamentosTransacao(req.usuarioId, dados, parcelas, grupo);
    return res.status(201).json({ lancamentos });
  } catch (erro) {
    if (erro.code === '23503') return res.status(404).json({ erro: 'Categoria ou fonte/destino não encontrada.' });
    throw erro;
  }
}));

router.put('/:id', asyncHandler(async (req, res) => {
  const id = idPositivo(req.params.id);
  if (!id) return res.status(404).json({ erro: 'Lançamento não encontrado.' });
  const existente = await buscarLancamento(req.usuarioId, id);
  if (!existente) return res.status(404).json({ erro: 'Lançamento não encontrado.' });
  const { campos, centavos, totalParcelas, dados } = validarDados(req.body ?? {});
  if (Object.keys(campos).length) return res.status(400).json({ erro: 'Revise os campos informados.', campos });
  if (totalParcelas !== existente.total_parcelas) {
    return res.status(400).json({ erro: 'A quantidade de parcelas de um lançamento existente não pode ser alterada.', campos: { total_parcelas: 'Mantenha a quantidade original de parcelas.' } });
  }
  const relacoes = await validarCategoriaFonte(req.usuarioId, dados.categoria_id, dados.fonte_destino_id);
  if (!relacoes) return res.status(404).json({ erro: 'Categoria ou fonte/destino não encontrada.' });
  const incompatibilidade = validarCompatibilidade(dados.tipo, relacoes, totalParcelas);
  if (Object.keys(incompatibilidade).length) return res.status(400).json({ erro: 'Categoria, fonte ou parcelamento incompatível.', campos: incompatibilidade });
  try {
    const lancamento = await atualizarLancamento(req.usuarioId, id, dados, centavos);
    if (!lancamento) return res.status(404).json({ erro: 'Lançamento não encontrado.' });
    return res.json({ lancamento });
  } catch (erro) {
    if (erro.code === '23503') return res.status(404).json({ erro: 'Categoria ou fonte/destino não encontrada.' });
    throw erro;
  }
}));

router.delete('/:id', asyncHandler(async (req, res) => {
  const id = idPositivo(req.params.id);
  if (!id) return res.status(404).json({ erro: 'Lançamento não encontrado.' });
  const apagadas = await removerLancamento(req.usuarioId, id, req.query.todasParcelas === 'true');
  if (!apagadas) return res.status(404).json({ erro: 'Lançamento não encontrado.' });
  return res.status(204).end();
}));

export default router;
