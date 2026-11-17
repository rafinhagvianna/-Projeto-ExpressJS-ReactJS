import { pool } from '../config/database.js';
import { relatorioFaturas } from './relatorioModel.js';

function cents(valor) {
  const [inteiro, decimal = '00'] = String(valor ?? '0').split('.');
  return Number(inteiro) * 100 + Number(decimal.padEnd(2, '0').slice(0, 2));
}

function reais(centavos) {
  const sinal = centavos < 0 ? '-' : '';
  const total = Math.abs(centavos);
  return `${sinal}${Math.floor(total / 100)}.${String(total % 100).padStart(2, '0')}`;
}

function mesSomado(anoMes, quantidade) {
  const [ano, mes] = anoMes.split('-').map(Number);
  return new Date(Date.UTC(ano, mes - 1 + quantidade, 1)).toISOString().slice(0, 7);
}

function primeiroDiaMesAtual() {
  const agora = new Date();
  return `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, '0')}`;
}

export async function obterSaudeFinanceira(usuarioId) {
  const { rows: meses } = await pool.query(
    `SELECT TO_CHAR(calendario.mes, 'YYYY-MM') AS mes,
       COALESCE(SUM(l.valor) FILTER (WHERE l.tipo = 'entrada'), 0)::numeric(12,2) AS entradas,
       COALESCE(SUM(l.valor) FILTER (WHERE l.tipo = 'saida'), 0)::numeric(12,2) AS saidas,
       COALESCE(SUM(l.valor) FILTER (WHERE l.tipo = 'saida' AND f.tipo <> 'cartao_credito'), 0)::numeric(12,2) AS saidasSemCartao
     FROM generate_series(
       date_trunc('month', CURRENT_DATE) - INTERVAL '2 months',
       date_trunc('month', CURRENT_DATE), INTERVAL '1 month'
     ) AS calendario(mes)
     LEFT JOIN lancamentos l ON l.usuario_id = $1
       AND l.data >= calendario.mes::date
       AND l.data < (calendario.mes + INTERVAL '1 month')::date
     LEFT JOIN fontes_destinos f ON f.id = l.fonte_destino_id AND f.usuario_id = l.usuario_id
     GROUP BY calendario.mes ORDER BY calendario.mes`,
    [usuarioId],
  );
  const totalEntradas = meses.reduce((soma, item) => soma + cents(item.entradas), 0);
  const totalSaidas = meses.reduce((soma, item) => soma + cents(item.saidas), 0);
  const poupanca = totalEntradas - totalSaidas;
  const taxaPoupanca = totalEntradas ? Number(((poupanca / totalEntradas) * 100).toFixed(2)) : 0;
  const mediaLiquida = Math.round(meses.reduce((soma, item) => (
    soma + cents(item.entradas) - cents(item.saidasSemCartao)
  ), 0) / Math.max(meses.length, 1));
  const mediaDespesasMensais = Math.round(totalSaidas / Math.max(meses.length, 1));

  const saldo = await pool.query(
    `SELECT
       COALESCE(SUM(l.valor) FILTER (WHERE l.tipo = 'entrada'), 0)::numeric(12,2) AS entradas,
       COALESCE(SUM(l.valor) FILTER (WHERE l.tipo = 'saida' AND f.tipo <> 'cartao_credito'), 0)::numeric(12,2) AS saidasSemCartao
     FROM lancamentos l
     JOIN fontes_destinos f ON f.id = l.fonte_destino_id AND f.usuario_id = l.usuario_id
     WHERE l.usuario_id = $1`,
    [usuarioId],
  );
  const saldoBaseCentavos = cents(saldo.rows[0].entradas) - cents(saldo.rows[0].saidasSemCartao);

  const reserva = await pool.query(
    `SELECT COALESCE(SUM(CASE WHEN l.tipo = 'saida' THEN l.valor ELSE -l.valor END), 0)::numeric(12,2) AS total
     FROM fontes_destinos f
     LEFT JOIN lancamentos l ON l.fonte_destino_id = f.id AND l.usuario_id = f.usuario_id
     WHERE f.usuario_id = $1 AND f.tipo = 'conta' AND f.reserva = TRUE`,
    [usuarioId],
  );
  const reservaCentavos = cents(reserva.rows[0].total);

  const { rows: categoriasMes } = await pool.query(
    `WITH meses AS (
       SELECT generate_series(
         date_trunc('month', CURRENT_DATE) - INTERVAL '4 months',
         date_trunc('month', CURRENT_DATE) - INTERVAL '1 month', INTERVAL '1 month'
       ) AS mes
     )
     SELECT c.id, c.nome, meses.mes,
       COALESCE(SUM(l.valor), 0)::numeric(12,2) AS total
     FROM categorias c CROSS JOIN meses
     LEFT JOIN lancamentos l ON l.categoria_id = c.id AND l.usuario_id = c.usuario_id
       AND l.tipo = 'saida' AND l.data >= meses.mes::date
       AND l.data < (meses.mes + INTERVAL '1 month')::date
     WHERE c.usuario_id = $1 AND c.tipo = 'saida'
     GROUP BY c.id, c.nome, meses.mes ORDER BY c.nome, meses.mes`,
    [usuarioId],
  );
  const historicoCategorias = new Map();
  for (const linha of categoriasMes) {
    const valores = historicoCategorias.get(linha.id) ?? { id: linha.id, nome: linha.nome, totais: [] };
    valores.totais.push(cents(linha.total));
    historicoCategorias.set(linha.id, valores);
  }
  const anomalias = [...historicoCategorias.values()]
    .map((categoria) => {
      const base = categoria.totais.slice(0, 3);
      const media = Math.round(base.reduce((soma, valor) => soma + valor, 0) / Math.max(base.length, 1));
      const recente = categoria.totais[3] ?? 0;
      return { ...categoria, media, recente };
    })
    .filter((categoria) => categoria.media > 0 && categoria.recente >= categoria.media * 1.5
      && categoria.recente - categoria.media >= 10000)
    .sort((a, b) => (b.recente - b.media) - (a.recente - a.media))
    .map((categoria) => ({
      id: categoria.id, nome: categoria.nome,
      totalRecente: reais(categoria.recente), mediaAnterior: reais(categoria.media),
      aumentoPercentual: Number((((categoria.recente - categoria.media) / categoria.media) * 100).toFixed(2)),
    }));

  // Relatórios de fatura trazem obrigações futuras agrupadas por cartão e mês.
  const faturas = await relatorioFaturas(usuarioId, 6);
  let limiteSomado = 0;
  let utilizadoSomado = 0;
  const parcelasPorMes = new Map();
  const obrigacoesPorMes = new Map();
  for (const cartao of faturas.cartoes) {
    limiteSomado += cents(cartao.limite);
    utilizadoSomado += cents(cartao.limiteUtilizado);
    for (const fatura of cartao.faturas) {
      const total = cents(fatura.total);
      obrigacoesPorMes.set(fatura.referencia, (obrigacoesPorMes.get(fatura.referencia) ?? 0) + total);
      const parcelas = fatura.itens
        .filter((item) => item.totalParcelas > 1)
        .reduce((soma, item) => soma + cents(item.valor), 0);
      parcelasPorMes.set(fatura.referencia, (parcelasPorMes.get(fatura.referencia) ?? 0) + parcelas);
    }
  }
  const comprometimentoCartoes = limiteSomado
    ? Number(((utilizadoSomado / limiteSomado) * 100).toFixed(2)) : 0;
  const parcelasFuturas = [...parcelasPorMes.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([mes, total]) => ({ mes, total: reais(total) }));

  const mesAtual = primeiroDiaMesAtual();
  let saldoProjetado = saldoBaseCentavos;
  const projecao = Array.from({ length: 6 }, (_, indice) => {
    const mes = mesSomado(mesAtual, indice + 1);
    saldoProjetado += mediaLiquida;
    for (const [referencia, total] of obrigacoesPorMes) {
      if (referencia === mes) saldoProjetado -= total;
    }
    return {
      mes,
      saldoProjetado: reais(saldoProjetado),
      parcelasConhecidas: reais(obrigacoesPorMes.get(mes) ?? 0),
    };
  });

  const limiteReserva = mediaDespesasMensais * 3;
  const indicadores = {
    taxaPoupanca,
    comprometimentoCartoes,
    parcelasFuturas,
    categoriaForaDaCurva: anomalias[0] ?? null,
    reservaEmergencia: {
      total: reais(reservaCentavos),
      mesesCobertos: mediaDespesasMensais ? Number((reservaCentavos / mediaDespesasMensais).toFixed(2)) : 0,
      metaTresMeses: reais(limiteReserva),
    },
    saldoBaseProjecao: reais(saldoBaseCentavos),
    mediaLiquidaMensal: reais(mediaLiquida),
    janelaAnalise: meses.map((item) => item.mes),
  };

  const dicas = [];
  if (taxaPoupanca < 10) dicas.push('A taxa de poupança ficou abaixo de 10% no período analisado. Revise as categorias que mais pesaram no orçamento.');
  if (comprometimentoCartoes >= 70) dicas.push('Os cartões estão usando 70% ou mais dos limites somados. Acompanhe os vencimentos previstos.');
  if (anomalias.length) dicas.push(`A categoria “${anomalias[0].nome}” aumentou pelo menos 50% e R$ 100 em relação à média dos três meses anteriores.`);
  if (reservaCentavos < limiteReserva) dicas.push('A reserva registrada está abaixo da referência educativa de três meses de despesas médias.');
  if (!dicas.length) dicas.push('Os indicadores estão dentro das faixas educativas definidas. Continue acompanhando as próximas movimentações.');

  return { indicadores, projecao, dicas };
}
