import { pool } from '../config/database.js';
import { centavosParaDecimal } from './utilitarios.js';

const selecao = `l.id, l.tipo, l.descricao, l.valor, to_char(l.data, 'YYYY-MM-DD') AS data,
  l.categoria_id, c.nome AS categoria_nome, l.fonte_destino_id,
  f.nome AS fonte_destino_nome, f.tipo AS fonte_destino_tipo,
  l.parcela_atual, l.total_parcelas, l.grupo_parcelamento`;

export async function listarLancamentos(usuarioId, filtros) {
  const valores = [usuarioId];
  const condicoes = ['l.usuario_id = $1'];
  const adicionar = (condicao, valor) => {
    valores.push(valor);
    condicoes.push(condicao.replace('?', `$${valores.length}`));
  };
  if (filtros.inicio) adicionar('l.data >= ?::date', filtros.inicio);
  if (filtros.fim) adicionar('l.data <= ?::date', filtros.fim);
  if (filtros.tipo) adicionar('l.tipo = ?', filtros.tipo);
  if (filtros.categoriaId) adicionar('l.categoria_id = ?', filtros.categoriaId);
  if (filtros.fonteDestinoId) adicionar('l.fonte_destino_id = ?', filtros.fonteDestinoId);

  const where = condicoes.join(' AND ');
  const resumo = await pool.query(
    `SELECT
       COALESCE(SUM(valor) FILTER (WHERE tipo = 'entrada'), 0)::numeric(12,2) AS "totalEntradas",
       COALESCE(SUM(valor) FILTER (WHERE tipo = 'saida'), 0)::numeric(12,2) AS "totalSaidas",
       COUNT(*)::integer AS total
     FROM lancamentos l WHERE ${where}`,
    valores,
  );
  const offset = (filtros.pagina - 1) * filtros.limite;
  const parametros = [...valores, filtros.limite, offset];
  const linhas = await pool.query(
    `SELECT ${selecao} FROM lancamentos l
     JOIN categorias c ON c.id = l.categoria_id AND c.usuario_id = l.usuario_id
     JOIN fontes_destinos f ON f.id = l.fonte_destino_id AND f.usuario_id = l.usuario_id
     WHERE ${where} ORDER BY l.data DESC, l.id DESC
     LIMIT $${valores.length + 1} OFFSET $${valores.length + 2}`,
    parametros,
  );
  const totalEntradas = Number(resumo.rows[0].totalEntradas);
  const totalSaidas = Number(resumo.rows[0].totalSaidas);
  return {
    lancamentos: linhas.rows,
    pagina: filtros.pagina,
    limite: filtros.limite,
    totalEntradas: totalEntradas.toFixed(2),
    totalSaidas: totalSaidas.toFixed(2),
    saldo: (totalEntradas - totalSaidas).toFixed(2),
    total: resumo.rows[0].total,
    totalPaginas: Math.ceil(resumo.rows[0].total / filtros.limite),
  };
}

export async function buscarLancamento(usuarioId, id) {
  const { rows: [lancamento] } = await pool.query(
    `SELECT ${selecao} FROM lancamentos l
     JOIN categorias c ON c.id = l.categoria_id AND c.usuario_id = l.usuario_id
     JOIN fontes_destinos f ON f.id = l.fonte_destino_id AND f.usuario_id = l.usuario_id
     WHERE l.id = $1 AND l.usuario_id = $2`, [id, usuarioId],
  );
  return lancamento ?? null;
}

export async function validarCategoriaFonte(usuarioId, categoriaId, fonteDestinoId) {
  const { rows: [relacoes] } = await pool.query(
    `SELECT c.tipo AS categoria_tipo, f.tipo AS fonte_destino_tipo
     FROM categorias c CROSS JOIN fontes_destinos f
     WHERE c.id = $1 AND f.id = $2
       AND c.usuario_id = $3 AND f.usuario_id = $3`,
    [categoriaId, fonteDestinoId, usuarioId],
  );
  return relacoes ?? null;
}

export async function criarLancamentosTransacao(usuarioId, dados, parcelasCentavos, grupo) {
  const cliente = await pool.connect();
  try {
    await cliente.query('BEGIN');
    const criados = [];
    for (let indice = 0; indice < parcelasCentavos.length; indice += 1) {
      const { rows: [lancamento] } = await cliente.query(
        `INSERT INTO lancamentos
          (usuario_id, tipo, descricao, valor, data, categoria_id, fonte_destino_id,
           parcela_atual, total_parcelas, grupo_parcelamento)
         VALUES ($1, $2, $3, $4, $5::date, $6, $7, $8, $9, $10)
         RETURNING id, tipo, descricao, valor, to_char(data, 'YYYY-MM-DD') AS data,
           categoria_id, fonte_destino_id, parcela_atual, total_parcelas, grupo_parcelamento`,
        [usuarioId, dados.tipo, dados.descricao, centavosParaDecimal(parcelasCentavos[indice]),
          dados.data, dados.categoria_id, dados.fonte_destino_id, indice + 1,
          parcelasCentavos.length, grupo],
      );
      criados.push(lancamento);
    }
    await cliente.query('COMMIT');
    return criados;
  } catch (erro) {
    await cliente.query('ROLLBACK');
    throw erro;
  } finally {
    cliente.release();
  }
}

export async function atualizarLancamento(usuarioId, id, dados, centavos) {
  const { rows: [lancamento] } = await pool.query(
    `UPDATE lancamentos SET tipo = $1, descricao = $2, valor = $3, data = $4::date,
       categoria_id = $5, fonte_destino_id = $6
     WHERE id = $7 AND usuario_id = $8
     RETURNING id, tipo, descricao, valor, to_char(data, 'YYYY-MM-DD') AS data,
       categoria_id, fonte_destino_id, parcela_atual, total_parcelas, grupo_parcelamento`,
    [dados.tipo, dados.descricao, centavosParaDecimal(centavos), dados.data,
      dados.categoria_id, dados.fonte_destino_id, id, usuarioId],
  );
  return lancamento ?? null;
}

export async function removerLancamento(usuarioId, id, todasParcelas) {
  const existente = await buscarLancamento(usuarioId, id);
  if (!existente) return null;
  const grupo = todasParcelas && existente.grupo_parcelamento;
  const resultado = grupo
    ? await pool.query('DELETE FROM lancamentos WHERE usuario_id = $1 AND grupo_parcelamento = $2', [usuarioId, grupo])
    : await pool.query('DELETE FROM lancamentos WHERE usuario_id = $1 AND id = $2', [usuarioId, id]);
  return resultado.rowCount;
}
