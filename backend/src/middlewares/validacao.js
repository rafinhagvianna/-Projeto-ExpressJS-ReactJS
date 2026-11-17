export const emailValido = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
export const senhaValida = (senha) => senha.length >= 8 && /[A-Za-z]/.test(senha) && /\d/.test(senha);

export function objetoBody(req, _res, next) {
  if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) {
    return next(Object.assign(new Error('Corpo inválido.'), { status: 400 }));
  }
  return next();
}
