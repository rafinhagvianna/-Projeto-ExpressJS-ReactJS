import { Router } from 'express';
import bcrypt from 'bcrypt';
import rateLimit from 'express-rate-limit';
import { cpfValido } from '../models/utilitarios.js';
import { buscarUsuarioPorEmail, buscarUsuarioPublico, criarUsuarioComPadroes } from '../models/usuarioModel.js';
import { criarToken } from '../config/jwt.js';
import { autenticar } from '../middlewares/autenticar.js';
import { emailValido, objetoBody, senhaValida } from '../middlewares/validacao.js';
import { asyncHandler } from '../middlewares/erros.js';

const router = Router();
const HASH_FALSO = bcrypt.hashSync('senha-falsa-para-equalizar-tempo-123', 10);
const limitarLogin = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { erro: 'Muitas tentativas. Tente novamente em alguns minutos.' },
});

router.post('/cadastro', objetoBody, asyncHandler(async (req, res) => {
  const campos = {};
  const nome = typeof req.body.nome === 'string' ? req.body.nome.trim() : '';
  const emailOriginal = typeof req.body.email === 'string' ? req.body.email.trim() : '';
  const email = emailOriginal.toLowerCase();
  const cpf = typeof req.body.cpf === 'string' ? req.body.cpf.replace(/\D/g, '') : '';
  const senha = typeof req.body.senha === 'string' ? req.body.senha : '';
  const confirmarSenha = typeof req.body.confirmarSenha === 'string' ? req.body.confirmarSenha : '';

  if (!nome) campos.nome = 'Informe seu nome.';
  if (!email) campos.email = 'Informe seu e-mail.';
  else if (!emailValido(email)) campos.email = 'Informe um e-mail válido.';
  if (!cpf) campos.cpf = 'Informe seu CPF.';
  else if (!cpfValido(cpf)) campos.cpf = 'Informe um CPF válido.';
  if (!senha) campos.senha = 'Informe uma senha.';
  else if (!senhaValida(senha)) campos.senha = 'Use ao menos 8 caracteres, com letras e números.';
  if (!confirmarSenha) campos.confirmarSenha = 'Confirme sua senha.';
  else if (senha !== confirmarSenha) campos.confirmarSenha = 'As senhas não coincidem.';

  if (Object.keys(campos).length) {
    return res.status(400).json({ erro: 'Revise os campos informados.', campos });
  }

  try {
    const senhaHash = await bcrypt.hash(senha, 10);
    const usuario = await criarUsuarioComPadroes({ nome, email, cpf, senhaHash });
    return res.status(201).json({ usuario });
  } catch (erro) {
    if (erro.code === '23505') {
      const campo = erro.constraint?.includes('cpf') ? 'cpf' : 'email';
      const nomeCampo = campo === 'cpf' ? 'CPF' : 'e-mail';
      return res.status(409).json({
        erro: 'Usuário já cadastrado.',
        campos: { [campo]: `Já existe um usuário com este ${nomeCampo}.` },
      });
    }
    throw erro;
  }
}));

router.post('/login', limitarLogin, objetoBody, asyncHandler(async (req, res) => {
  const email = typeof req.body.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  const senha = typeof req.body.senha === 'string' ? req.body.senha : '';
  const usuario = email ? await buscarUsuarioPorEmail(email) : null;
  const senhaCorreta = await bcrypt.compare(senha, usuario?.senha_hash ?? HASH_FALSO);

  if (!usuario || !senhaCorreta) {
    return res.status(401).json({ erro: 'E-mail ou senha inválidos.' });
  }
  const { senha_hash: _senhaHash, ...usuarioPublico } = usuario;
  return res.json({ token: criarToken(usuario.id), usuario: usuarioPublico });
}));

router.get('/me', autenticar, asyncHandler(async (req, res) => {
  const usuario = await buscarUsuarioPublico(req.usuarioId);
  if (!usuario) return res.status(404).json({ erro: 'Usuário não encontrado.' });
  return res.json({ usuario });
}));

export default router;
