import { useCallback, useEffect, useState } from 'react';
import api from '../services/api.js';
import { Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { moeda } from './formatos.js';

function periodoPadrao() {
  const hoje = new Date();
  const mes = String(hoje.getMonth() + 1).padStart(2, '0');
  const ultimo = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0).getDate();
  return {
    inicio: `${hoje.getFullYear()}-${mes}-01`,
    fim: `${hoje.getFullYear()}-${mes}-${String(ultimo).padStart(2, '0')}`,
  };
}

const cores = ['#28614f', '#7ea980', '#d4a56c', '#9e7864', '#8399a0', '#c87968', '#72918c'];

function IndicadorTendencia({ item }) {
  if (item.tendencia === 'igual') return <span className="trend neutral">Sem mudança</span>;
  if (item.variacaoPercentual === null) return <span className="trend">Novo período</span>;
  return <span className={`trend ${item.tendencia}`}>{item.tendencia === 'aumento' ? '↑' : '↓'} {Math.abs(item.variacaoPercentual).toFixed(2)}% vs. anterior</span>;
}

export default function Relatorios() {
  const [periodo, setPeriodo] = useState(periodoPadrao);
  const [categorias, setCategorias] = useState(null);
  const [fontes, setFontes] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');

  const carregar = useCallback(async () => {
    setCarregando(true); setErro('');
    try {
      const [porCategoria, porFonte] = await Promise.all([
        api.get('/relatorios/categorias', { params: periodo }),
        api.get('/relatorios/fontes-destinos', { params: periodo }),
      ]);
      setCategorias(porCategoria.data); setFontes(porFonte.data);
    } catch (falha) { setErro(falha.response?.data?.erro || 'Não foi possível carregar os relatórios.'); }
    finally { setCarregando(false); }
  }, [periodo]);

  useEffect(() => { carregar(); }, [carregar]);

  const saidasComGasto = categorias?.categoriasSaida?.filter((item) => Number(item.total) > 0) ?? [];
  const entradasComValor = categorias?.categoriasEntrada?.filter((item) => Number(item.total) > 0) ?? [];
  const fontesComEntrada = fontes?.entradasPorFonte ?? [];
  const destinosComSaida = fontes?.saidasPorDestino ?? [];

  return (
    <section className="page-content">
      <div className="page-heading"><div><span className="eyebrow">VISÃO POR PERÍODO</span><h1>Relatórios</h1><p>Totais e comparações calculados a partir dos seus lançamentos.</p></div></div>
      <section className="filter-panel report-filters">
        <div className="form-control"><label htmlFor="rel-inicio">De</label><input id="rel-inicio" type="date" value={periodo.inicio} onChange={(e) => setPeriodo((p) => ({ ...p, inicio: e.target.value }))} /></div>
        <div className="form-control"><label htmlFor="rel-fim">Até</label><input id="rel-fim" type="date" value={periodo.fim} onChange={(e) => setPeriodo((p) => ({ ...p, fim: e.target.value }))} /></div>
        <button className="button button-primary report-submit" onClick={carregar}>Atualizar período</button>
      </section>
      {erro && <div className="alert" role="alert">{erro}</div>}
      {carregando ? <section className="panel-card state-card">Carregando relatórios…</section> : categorias && fontes && <>
        <div className="summary-grid report-summary">
          <div className="summary-card"><span>Entradas do período</span><strong className="positive">{moeda.format(Number(categorias.totalEntradas))}</strong></div>
          <div className="summary-card"><span>Saídas do período</span><strong className="negative">{moeda.format(Number(categorias.totalSaidas))}</strong></div>
          <div className="summary-card summary-card-highlight"><span>Saldo por movimentação</span><strong>{moeda.format(Number(categorias.saldo))}</strong></div>
        </div>
        <div className="report-grid">
          <section className="panel-card">
            <div className="section-heading"><div><span className="eyebrow">DESPESAS</span><h2>Saídas por categoria</h2></div></div>
            {saidasComGasto.length === 0 ? <div className="empty-state"><strong>Sem saídas no período.</strong><p>Quando houver despesas, a distribuição aparecerá aqui.</p></div> : <div className="chart-block"><ResponsiveContainer width="100%" height={250}><PieChart><Pie data={saidasComGasto} dataKey="total" nameKey="nome" innerRadius="48%" outerRadius="78%" paddingAngle={3}>{saidasComGasto.map((item, indice) => <Cell key={item.id} fill={cores[indice % cores.length]} />)}</Pie><Tooltip formatter={(valor) => moeda.format(Number(valor))} /><Legend /></PieChart></ResponsiveContainer></div>}
          </section>
          <section className="panel-card">
            <div className="section-heading"><div><span className="eyebrow">COMPARAÇÃO</span><h2>Período anterior</h2></div></div>
            {!saidasComGasto.length ? <div className="empty-state"><p>Não há despesas para comparar neste período.</p></div> : <div className="comparison-list">{saidasComGasto.map((item) => <div className="comparison-row" key={item.id}><div><strong>{item.nome}</strong><small>{moeda.format(Number(item.total))} · {item.percentual.toFixed(2)}% do total</small></div><IndicadorTendencia item={item} /></div>)}</div>}
          </section>
        </div>
        <section className="panel-card">
          <div className="section-heading"><div><span className="eyebrow">DETALHAMENTO</span><h2>Categorias de saída</h2></div><small>{categorias.periodo.inicio} a {categorias.periodo.fim}</small></div>
          {!saidasComGasto.length ? <div className="empty-state"><p>Não há saídas por categoria neste período.</p></div> : <div className="table-wrap"><table><thead><tr><th>Categoria</th><th>Total atual</th><th>% das saídas</th><th>Período anterior</th><th>Variação</th></tr></thead><tbody>{saidasComGasto.map((item) => <tr key={item.id}><td><strong>{item.nome}</strong></td><td>{moeda.format(Number(item.total))}</td><td>{item.percentual.toFixed(2)}%</td><td>{moeda.format(Number(item.totalAnterior))}</td><td><IndicadorTendencia item={item} /></td></tr>)}</tbody></table></div>}
        </section>
        <div className="report-grid">
          <section className="panel-card">
            <div className="section-heading"><div><span className="eyebrow">ENTRADAS</span><h2>Por categoria</h2></div></div>
            {!entradasComValor.length ? <div className="empty-state"><p>Não há entradas neste período.</p></div> : <div className="table-wrap"><table><thead><tr><th>Categoria</th><th>Total</th><th>Anterior</th></tr></thead><tbody>{entradasComValor.map((item) => <tr key={item.id}><td><strong>{item.nome}</strong></td><td className="positive">{moeda.format(Number(item.total))}</td><td>{moeda.format(Number(item.totalAnterior))}</td></tr>)}</tbody></table></div>}
          </section>
          <section className="panel-card">
            <div className="section-heading"><div><span className="eyebrow">FONTES DE RENDA</span><h2>Entradas por fonte</h2></div></div>
            {!fontesComEntrada.length ? <div className="empty-state"><p>Não há entradas por fonte neste período.</p></div> : <ResponsiveContainer width="100%" height={230}><BarChart data={fontesComEntrada} margin={{ top: 8, right: 12, bottom: 10, left: 8 }}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="nome" tick={{ fontSize: 10 }} /><YAxis tick={{ fontSize: 10 }} /><Tooltip formatter={(valor) => moeda.format(Number(valor))} /><Bar dataKey="entradas" name="Entradas" fill="#478366" radius={[5, 5, 0, 0]} /></BarChart></ResponsiveContainer>}
          </section>
        </div>
        <section className="panel-card">
          <div className="section-heading"><div><span className="eyebrow">DESTINOS</span><h2>Saídas por conta e cartão</h2></div></div>
          {!destinosComSaida.length ? <div className="empty-state"><p>Não há saídas por destino neste período.</p></div> : <div className="chart-block"><ResponsiveContainer width="100%" height={260}><BarChart data={destinosComSaida} margin={{ top: 8, right: 16, bottom: 10, left: 8 }}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="nome" tick={{ fontSize: 10 }} /><YAxis tick={{ fontSize: 10 }} /><Tooltip formatter={(valor) => moeda.format(Number(valor))} /><Bar dataKey="saidas" name="Saídas" fill="#c87968" radius={[5, 5, 0, 0]} /></BarChart></ResponsiveContainer></div>}
        </section>
        <section className="panel-card">
          <div className="section-heading"><div><span className="eyebrow">CONTAS</span><h2>Saldo por conta</h2></div></div>
          {!fontes.saldoPorConta.length ? <div className="empty-state"><p>Não há contas cadastradas.</p></div> : <div className="table-wrap"><table><thead><tr><th>Conta</th><th>Entradas</th><th>Saídas</th><th>Saldo</th></tr></thead><tbody>{fontes.saldoPorConta.map((item) => <tr key={item.id}><td><strong>{item.nome}</strong></td><td>{moeda.format(Number(item.entradas))}</td><td>{moeda.format(Number(item.saidas))}</td><td className={Number(item.saldo) >= 0 ? 'positive' : 'negative'}>{moeda.format(Number(item.saldo))}</td></tr>)}</tbody></table></div>}
        </section>
      </>}
    </section>
  );
}
