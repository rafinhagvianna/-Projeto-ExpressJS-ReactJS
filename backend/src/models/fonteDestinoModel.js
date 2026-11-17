import { pool } from '../config/database.js';

const campos = `id, nome, tipo, dia_fechamento, dia_vencimento, limite, reserva`;

export async function listarFontesDestinos(usuarioId) {
  const { rows } = await pool.query(
    `SELECT ${campos} FROM fontes_destinos WHERE usuario_id = $1 ORDER BY nome`,
    [usuarioId],
  );
  return rows;
}

export async function criarFonteDestino(usuarioId, dados) {
  const { rows: [fonte] } = await pool.query(
    `INSERT INTO fontes_destinos
      (usuario_id, nome, tipo, dia_fechamento, dia_vencimento, limite, reserva)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING ${campos}`,
    [usuarioId, dados.nome, dados.tipo, dados.dia_fechamento, dados.dia_vencimento, dados.limite, dados.reserva],
  );
  return fonte;
}

export async function atualizarFonteDestino(usuarioId, id, dados) {
  const atual = await pool.query(
    'SELECT tipo FROM fontes_destinos WHERE id = $1 AND usuario_id = $2', [id, usuarioId],
  );
  if (!atual.rowCount) return null;
  if (atual.rows[0].tipo !== dados.tipo) {
    const lancamentos = await pool.query('SELECT 1 FROM lancamentos WHERE fonte_destino_id = $1 LIMIT 1', [id]);
    if (lancamentos.rowCount) return 'em_uso';
  }
  const { rows: [fonte] } = await pool.query(
    `UPDATE fontes_destinos SET nome = $1, tipo = $2, dia_fechamento = $3,
       dia_vencimento = $4, limite = $5, reserva = $6
     WHERE id = $7 AND usuario_id = $8 RETURNING ${campos}`,
    [dados.nome, dados.tipo, dados.dia_fechamento, dados.dia_vencimento, dados.limite, dados.reserva, id, usuarioId],
  );
  return fonte ?? null;
}

export async function removerFonteDestino(usuarioId, id) {
  try {
    const { rowCount } = await pool.query(
      'DELETE FROM fontes_destinos WHERE id = $1 AND usuario_id = $2', [id, usuarioId],
    );
    if (rowCount) return 'removida';
  } catch (erro) {
    if (erro.code === '23503') return 'em_uso';
    throw erro;
  }

  const { rowCount } = await pool.query(
    'SELECT 1 FROM fontes_destinos WHERE id = $1 AND usuario_id = $2', [id, usuarioId],
  );
  return rowCount ? 'em_uso' : null;
}
