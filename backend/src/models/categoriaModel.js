import { pool } from '../config/database.js';

export async function listarCategorias(usuarioId) {
  const { rows } = await pool.query(
    'SELECT id, nome, tipo FROM categorias WHERE usuario_id = $1 ORDER BY tipo, nome',
    [usuarioId],
  );
  return rows;
}

export async function criarCategoria(usuarioId, { nome, tipo }) {
  const { rows: [categoria] } = await pool.query(
    `INSERT INTO categorias (usuario_id, nome, tipo) VALUES ($1, $2, $3)
     RETURNING id, nome, tipo`,
    [usuarioId, nome, tipo],
  );
  return categoria;
}

export async function atualizarCategoria(usuarioId, id, { nome, tipo }) {
  const atual = await pool.query(
    'SELECT tipo FROM categorias WHERE id = $1 AND usuario_id = $2', [id, usuarioId],
  );
  if (!atual.rowCount) return null;
  if (atual.rows[0].tipo !== tipo) {
    const lancamentos = await pool.query('SELECT 1 FROM lancamentos WHERE categoria_id = $1 LIMIT 1', [id]);
    if (lancamentos.rowCount) return 'em_uso';
  }
  const { rows: [categoria] } = await pool.query(
    `UPDATE categorias SET nome = $1, tipo = $2
     WHERE id = $3 AND usuario_id = $4 RETURNING id, nome, tipo`,
    [nome, tipo, id, usuarioId],
  );
  return categoria ?? null;
}

export async function removerCategoria(usuarioId, id) {
  try {
    const { rowCount } = await pool.query(
      'DELETE FROM categorias WHERE id = $1 AND usuario_id = $2', [id, usuarioId],
    );
    if (rowCount) return 'removida';
  } catch (erro) {
    if (erro.code === '23503') return 'em_uso';
    throw erro;
  }

  const { rowCount } = await pool.query(
    'SELECT 1 FROM categorias WHERE id = $1 AND usuario_id = $2', [id, usuarioId],
  );
  return rowCount ? 'em_uso' : null;
}
