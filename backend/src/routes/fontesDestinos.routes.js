import { Router } from 'express';
import { asyncHandler } from '../middlewares/erros.js';
import { autenticar } from '../middlewares/autenticar.js';
import {
  atualizarFonteDestino, criarFonteDestino, listarFontesDestinos, removerFonteDestino,
} from '../models/fonteDestinoModel.js';

const router = Router();
router.use(autenticar);

function validar(dados) {
  const campos = {};
  const nome = typeof dados.nome === 'string' ? dados.nome.trim() : '';
  const tipo = dados.tipo;
  const cartao = tipo === 'cartao_credito';
  if (!nome || nome.length > 60) campos.nome = 'Informe um nome com até 60 caracteres.';
  if (!['renda', 'conta', 'cartao_credito'].includes(tipo)) campos.tipo = 'Escolha renda, conta ou cartão de crédito.';

  let dia_fechamento = null;
  let dia_vencimento = null;
  let limite = null;
  if (cartao) {
    dia_fechamento = Number(dados.dia_fechamento);
    dia_vencimento = Number(dados.dia_vencimento);
    limite = dados.limite;
    if (!Number.isInteger(dia_fechamento) || dia_fechamento < 1 || dia_fechamento > 31) campos.dia_fechamento = 'Informe um dia de fechamento entre 1 e 31.';
    if (!Number.isInteger(dia_vencimento) || dia_vencimento < 1 || dia_vencimento > 31) campos.dia_vencimento = 'Informe um dia de vencimento entre 1 e 31.';
    if (limite === '' || limite === null || limite === undefined || !Number.isFinite(Number(limite)) || Number(limite) <= 0) campos.limite = 'Informe um limite positivo para o cartão.';
    else limite = Number(limite).toFixed(2);
  }
  const reserva = dados.reserva === true;
  if (reserva && tipo !== 'conta') campos.reserva = 'A reserva de emergência deve ser uma conta.';
  return { campos, dados: { nome, tipo, dia_fechamento, dia_vencimento, limite, reserva } };
}

function tratarErro(erro, res) {
  if (erro.code === '23505') {
    res.status(409).json({ erro: 'Já existe uma fonte ou destino com este nome.', campos: { nome: 'Escolha outro nome.' } });
    return true;
  }
  if (erro.code === '23514') {
    res.status(400).json({ erro: 'Os dados da fonte ou destino não atendem às regras do cadastro.' });
    return true;
  }
  return false;
}

router.get('/', asyncHandler(async (req, res) => {
  res.json({ fontesDestinos: await listarFontesDestinos(req.usuarioId) });
}));

router.post('/', asyncHandler(async (req, res) => {
  if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) return res.status(400).json({ erro: 'Informe os dados da fonte ou destino.' });
  const { campos, dados } = validar(req.body);
  if (Object.keys(campos).length) return res.status(400).json({ erro: 'Revise os campos informados.', campos });
  try {
    return res.status(201).json({ fonteDestino: await criarFonteDestino(req.usuarioId, dados) });
  } catch (erro) {
    if (tratarErro(erro, res)) return;
    throw erro;
  }
}));

router.put('/:id', asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) return res.status(404).json({ erro: 'Fonte ou destino não encontrado.' });
  const { campos, dados } = validar(req.body ?? {});
  if (Object.keys(campos).length) return res.status(400).json({ erro: 'Revise os campos informados.', campos });
  try {
    const fonteDestino = await atualizarFonteDestino(req.usuarioId, id, dados);
    if (!fonteDestino) return res.status(404).json({ erro: 'Fonte ou destino não encontrado.' });
    if (fonteDestino === 'em_uso') return res.status(409).json({ erro: 'Não é possível trocar o tipo de uma fonte ou destino usado em lançamentos.', campos: { tipo: 'Mova os lançamentos antes de trocar o tipo.' } });
    return res.json({ fonteDestino });
  } catch (erro) {
    if (tratarErro(erro, res)) return;
    throw erro;
  }
}));

router.delete('/:id', asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) return res.status(404).json({ erro: 'Fonte ou destino não encontrado.' });
  const resultado = await removerFonteDestino(req.usuarioId, id);
  if (!resultado) return res.status(404).json({ erro: 'Fonte ou destino não encontrado.' });
  if (resultado === 'em_uso') return res.status(409).json({ erro: 'Não é possível excluir fonte ou destino com lançamentos associados.' });
  return res.status(204).end();
}));

export default router;
