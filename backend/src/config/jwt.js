import jwt from 'jsonwebtoken';

const secret = process.env.JWT_SECRET;
if (!secret && process.env.NODE_ENV === 'production') {
  throw new Error('JWT_SECRET precisa estar configurado em produção.');
}

export function criarToken(usuarioId) {
  return jwt.sign({}, secret || 'chave-local-de-desenvolvimento', {
    subject: String(usuarioId),
    expiresIn: process.env.JWT_EXPIRES_IN || '1h',
  });
}

export function verificarToken(token) {
  return jwt.verify(token, secret || 'chave-local-de-desenvolvimento');
}
