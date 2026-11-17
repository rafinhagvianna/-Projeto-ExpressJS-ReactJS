import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import api from '../services/api.js';
import { moeda } from './formatos.js';

const mesPt = (valor) => new Intl.DateTimeFormat('pt-BR', { month: 'short', year: '2-digit', timeZone: 'UTC' }).format(new Date(`${valor}-01T00:00:00Z`));

export default function SaudeFinanceira() {
  const [dados, setDados] = useState(null);
  const [erro, setErro] = useState('');
  useEffect(() => {
    let ativo = true;
    api.get('/saude-financeira').then(({ data }) => { if (ativo) setDados(data); })
      .catch((falha) => { if (ativo) setErro(falha.response?.data?.erro || 'Não foi possível carregar os indicadores.'); });
    return () => { ativo = false; };
  }, []);

  if (erro) return <section className="page-content"><div className="alert" role="alert">{erro}</div></section>;
  if (!dados) return <section className="page-content"><div className="state-card">Calculando seus indicadores…</div></section>;
  const { indicadores: i, projecao, dicas } = dados;
  const indicadores = [
    ['Taxa de poupança', `${i.taxaPoupanca}%`, 'Entradas menos saídas nos últimos três meses'],
    ['Limite comprometido', `${i.comprometimentoCartoes}%`, 'Parte dos limites de cartão já utilizada'],
    ['Reserva de emergência', moeda.format(Number(i.reservaEmergencia.total)), `${i.reservaEmergencia.mesesCobertos} meses cobertos · referência ${moeda.format(Number(i.reservaEmergencia.metaTresMeses))}`],
    ['Média líquida mensal', moeda.format(Number(i.mediaLiquidaMensal)), 'Média de entradas menos saídas sem duplicar compras no cartão'],
  ];

  return <section className="page-content">
    <div className="page-heading"><div><span className="eyebrow">INDICADORES EDUCATIVOS</span><h1>Saúde financeira</h1><p>Uma leitura simples do seu histórico e dos compromissos já registrados.</p></div><Link className="button button-primary" to="/faturas">Ver faturas</Link></div>
    <div className="health-disclaimer" role="note"><strong>As informações são educativas e não constituem recomendação financeira profissional.</strong></div>
    <div className="summary-grid">{indicadores.map(([rotulo, valor, detalhe]) => <article className="summary-card" key={rotulo}><span>{rotulo}</span><strong>{valor}</strong><small>{detalhe}</small></article>)}</div>
    <section className="panel-card"><div className="section-heading"><div><span className="eyebrow">PRÓXIMOS SEIS MESES</span><h2>Projeção de saldo</h2></div></div><p className="health-explainer">Estimativa que parte do saldo registrado e repete a média líquida recente, descontando parcelas e faturas conhecidas. Não antecipa despesas que ainda não foram lançadas.</p>
      <div className="health-chart"><ResponsiveContainer width="100%" height="100%"><BarChart data={projecao} margin={{ top: 12, right: 12, left: 4, bottom: 4 }}><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e8eee8"/><XAxis dataKey="mes" tickFormatter={mesPt} axisLine={false} tickLine={false}/><YAxis tickFormatter={(valor) => moeda.format(valor)} width={88} axisLine={false} tickLine={false}/><Tooltip labelFormatter={mesPt} formatter={(valor, nome) => [moeda.format(Number(valor)), nome === 'saldoProjetado' ? 'Saldo projetado' : 'Parcelas conhecidas']}/><Bar dataKey="saldoProjetado" name="Saldo projetado" fill="#3b765a" radius={[5,5,0,0]}/></BarChart></ResponsiveContainer></div>
      <div className="table-wrap"><table><thead><tr><th>Mês</th><th>Saldo estimado</th><th>Parcelas/faturas conhecidas</th></tr></thead><tbody>{projecao.map((linha) => <tr key={linha.mes}><td>{mesPt(linha.mes)}</td><td>{moeda.format(Number(linha.saldoProjetado))}</td><td>{moeda.format(Number(linha.parcelasConhecidas))}</td></tr>)}</tbody></table></div>
    </section>
    <section className="report-grid health-details">
      <article className="panel-card"><span className="eyebrow">PARCELAS FUTURAS</span><h2>Compromissos parcelados</h2>{i.parcelasFuturas.length ? <ul className="health-list">{i.parcelasFuturas.map((linha) => <li key={linha.mes}><span>{mesPt(linha.mes)}</span><strong>{moeda.format(Number(linha.total))}</strong></li>)}</ul> : <p className="health-explainer">Nenhuma parcela futura identificada nas faturas consultadas.</p>}</article>
      <article className="panel-card"><span className="eyebrow">ATENÇÃO AO ORÇAMENTO</span><h2>Pontos para acompanhar</h2><ul className="health-tips">{dicas.map((dica) => <li key={dica}>{dica}</li>)}</ul>{i.categoriaForaDaCurva && <p className="health-explainer">Categoria em destaque: <strong>{i.categoriaForaDaCurva.nome}</strong>, {i.categoriaForaDaCurva.aumentoPercentual}% acima da média anterior.</p>}</article>
    </section>
  </section>;
}
