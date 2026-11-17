export function asyncHandler(handler) {
  return (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
}

export function notFound(_req, res) {
  return res.status(404).json({ erro: 'Rota não encontrada.' });
}

export function errorHandler(erro, _req, res, _next) {
  if (res.headersSent) return;

  if (erro.type === 'entity.parse.failed' || erro.type === 'entity.too.large') {
    return res.status(400).json({ erro: erro.type === 'entity.too.large'
      ? 'Corpo da requisição muito grande.'
      : 'JSON malformado.' });
  }
  if (erro.status === 400) return res.status(400).json({ erro: erro.message || 'Requisição inválida.' });
  if (erro.message === 'Origem não permitida pelo CORS.') {
    return res.status(400).json({ erro: 'Origem não permitida.' });
  }

  console.error('Erro inesperado na API.');
  return res.status(500).json({ erro: 'Erro interno do servidor.' });
}
