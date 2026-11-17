import { verificarToken } from '../config/jwt.js';

export function autenticar(req, res, next) {
  const [esquema, token, extra] = (req.headers.authorization ?? '').split(' ');
  if (esquema !== 'Bearer' || !token || extra) {
    return res.status(401).json({ erro: 'Token não informado.' });
  }

  try {
    const payload = verificarToken(token);
    const id = Number(payload.sub);
    if (!Number.isInteger(id) || id < 1) throw new Error('Sub inválido.');
    req.usuarioId = id;
    return next();
  } catch {
    return res.status(401).json({ erro: 'Token inválido ou expirado.' });
  }
}
