import { pool } from '../config/database.js';

const categoriasPadrao = [
  ['Salário', 'entrada'], ['Freelance', 'entrada'], ['Rendimentos', 'entrada'],
  ['Alimentação', 'saida'], ['Moradia', 'saida'], ['Saúde', 'saida'],
  ['Mobilidade', 'saida'], ['Lazer', 'saida'], ['Educação', 'saida'], ['Outros', 'saida'],
];

export async function criarUsuarioComPadroes({ nome, email, cpf, senhaHash }) {
  const cliente = await pool.connect();
  try {
    await cliente.query('BEGIN');
    const { rows: [usuario] } = await cliente.query(
      `INSERT INTO usuarios (nome, email, cpf, senha_hash)
       VALUES ($1, $2, $3, $4) RETURNING id, nome, email`,
      [nome, email, cpf, senhaHash],
    );
    for (const [nomeCategoria, tipo] of categoriasPadrao) {
      await cliente.query(
        'INSERT INTO categorias (usuario_id, nome, tipo) VALUES ($1, $2, $3)',
        [usuario.id, nomeCategoria, tipo],
      );
    }
    await cliente.query(
      `INSERT INTO fontes_destinos (usuario_id, nome, tipo)
       VALUES ($1, 'Conta corrente', 'conta')`,
      [usuario.id],
    );
    await cliente.query('COMMIT');
    return usuario;
  } catch (erro) {
    await cliente.query('ROLLBACK');
    throw erro;
  } finally {
    cliente.release();
  }
}

export async function buscarUsuarioPorEmail(email) {
  const { rows: [usuario] } = await pool.query(
    'SELECT id, nome, email, senha_hash FROM usuarios WHERE email = $1', [email],
  );
  return usuario ?? null;
}

export async function buscarUsuarioPublico(id) {
  const { rows: [usuario] } = await pool.query(
    'SELECT id, nome, email FROM usuarios WHERE id = $1', [id],
  );
  return usuario ?? null;
}
