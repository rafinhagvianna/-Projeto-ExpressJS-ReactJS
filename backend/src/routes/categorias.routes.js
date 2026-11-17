import { Router } from 'express';
import { asyncHandler } from '../middlewares/erros.js';
import { autenticar } from '../middlewares/autenticar.js';
import {
  atualizarCategoria, criarCategoria, listarCategorias, removerCategoria,
} from '../models/categoriaModel.js';

const router = Router();
router.use(autenticar);

function validar(dados) {
  const campos = {};
  const nome = typeof dados.nome === 'string' ? dados.nome.trim() : '';
  const tipo = dados.tipo;
  if (!nome || nome.length > 60) campos.nome = 'Informe um nome com até 60 caracteres.';
  if (!['entrada', 'saida'].includes(tipo)) campos.tipo = 'Tipo deve ser entrada ou saida.';
  return { campos, dados: { nome, tipo } };
}

function tratarDuplicidade(erro, res) {
  if (erro.code !== '23505') return false;
  res.status(409).json({ erro: 'Já existe uma categoria com este nome e tipo.', campos: { nome: 'Escolha outro nome para este tipo.' } });
  return true;
}

router.get('/', asyncHandler(async (req, res) => {
  res.json({ categorias: await listarCategorias(req.usuarioId) });
}));

router.post('/', asyncHandler(async (req, res) => {
  if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) {
    return res.status(400).json({ erro: 'Informe os dados da categoria.' });
  }
  const { campos, dados } = validar(req.body);
  if (Object.keys(campos).length) return res.status(400).json({ erro: 'Revise os campos informados.', campos });
  try {
    return res.status(201).json({ categoria: await criarCategoria(req.usuarioId, dados) });
  } catch (erro) {
    if (tratarDuplicidade(erro, res)) return;
    throw erro;
  }
}));

router.put('/:id', asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) return res.status(404).json({ erro: 'Categoria não encontrada.' });
  const { campos, dados } = validar(req.body ?? {});
  if (Object.keys(campos).length) return res.status(400).json({ erro: 'Revise os campos informados.', campos });
  try {
    const categoria = await atualizarCategoria(req.usuarioId, id, dados);
    if (!categoria) return res.status(404).json({ erro: 'Categoria não encontrada.' });
    if (categoria === 'em_uso') return res.status(409).json({ erro: 'Não é possível trocar o tipo de uma categoria usada em lançamentos.', campos: { tipo: 'Mova os lançamentos antes de trocar o tipo.' } });
    return res.json({ categoria });
  } catch (erro) {
    if (tratarDuplicidade(erro, res)) return;
    throw erro;
  }
}));

router.delete('/:id', asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) return res.status(404).json({ erro: 'Categoria não encontrada.' });
  const resultado = await removerCategoria(req.usuarioId, id);
  if (!resultado) return res.status(404).json({ erro: 'Categoria não encontrada.' });
  if (resultado === 'em_uso') return res.status(409).json({ erro: 'Não é possível excluir categoria com lançamentos associados.' });
  return res.status(204).end();
}));

export default router;
