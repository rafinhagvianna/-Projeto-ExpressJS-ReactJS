import { lazy, Suspense, useEffect, useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext.jsx';
import api from '../services/api.js';
import { dataBrasileira, moeda } from './formatos.js';
const GraficoCategorias = lazy(() => import('./GraficoCategorias.jsx'));

export function PainelLayout({ children }) {
  const { usuario, logout } = useAuth();
  const links = [
    ['/', 'Visão geral'], ['/lancamentos', 'Lançamentos'],
    ['/categorias', 'Categorias'], ['/fontes-destinos', 'Fontes e destinos'],
    ['/relatorios', 'Relatórios'], ['/faturas', 'Faturas'],
  ];
  return (
    <main className="app-shell">
      <header className="app-header">
        <Link className="brand" to="/">clareza<span>.</span></Link>
        <nav className="main-nav" aria-label="Navegação principal">
          {links.map(([to, texto]) => <NavLink key={to} to={to} end={to === '/'}>{texto}</NavLink>)}
        </nav>
        <div className="account-actions"><span>{usuario?.nome?.split(' ')[0]}</span><button className="button button-quiet" onClick={logout}>Sair</button></div>
      </header>
      {children}
    </main>
  );
}

export default function Painel() {
  const [dados, setDados] = useState(null);
  const [relatorio, setRelatorio] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');

  useEffect(() => {
    let ativo = true;
    Promise.all([api.get('/lancamentos', { params: { pagina: 1, limite: 5 } }), api.get('/relatorios/categorias')])
      .then(([resumo, categorias]) => { if (ativo) { setDados(resumo.data); setRelatorio(categorias.data); } })
      .catch((falha) => { if (ativo) setErro(falha.response?.data?.erro || 'Não foi possível carregar o resumo.'); })
      .finally(() => { if (ativo) setCarregando(false); });
    return () => { ativo = false; };
  }, []);

  return (
    <section className="page-content">
      <div className="page-heading"><div><span className="eyebrow">RESUMO DO MÊS</span><h1>Seu dinheiro, em foco.</h1><p>Acompanhe suas entradas e saídas registradas.</p></div><Link className="button button-primary" to="/lancamentos">+ Novo lançamento</Link></div>
      {erro && <div className="alert" role="alert">{erro}</div>}
      {carregando ? <div className="state-card">Carregando seu resumo…</div> : dados && <>
        <div className="summary-grid">
          <div className="summary-card"><span>Entradas</span><strong className="positive">{moeda.format(Number(dados.totalEntradas))}</strong></div>
          <div className="summary-card"><span>Saídas</span><strong className="negative">{moeda.format(Number(dados.totalSaidas))}</strong></div>
          <div className="summary-card summary-card-highlight"><span>Saldo do período</span><strong>{moeda.format(Number(dados.saldo))}</strong></div>
        </div>
        <section className="panel-card">
          <div className="section-heading"><div><span className="eyebrow">MOVIMENTAÇÕES RECENTES</span><h2>Últimos lançamentos</h2></div><Link to="/lancamentos">Ver todos</Link></div>
          {dados.lancamentos.length === 0 ? <div className="empty-state"><strong>Nenhum lançamento neste mês.</strong><p>Registre uma entrada ou saída para acompanhar seu resumo.</p></div> : (
            <div className="table-wrap"><table><thead><tr><th>Descrição</th><th>Categoria</th><th>Data</th><th>Valor</th></tr></thead><tbody>
              {dados.lancamentos.map((item) => <tr key={item.id}><td><strong>{item.descricao}</strong><small>{item.fonte_destino_nome}</small></td><td>{item.categoria_nome}</td><td>{dataBrasileira(item.data)}</td><td className={item.tipo === 'entrada' ? 'positive' : 'negative'}>{item.tipo === 'entrada' ? '+' : '−'} {moeda.format(Number(item.valor))}</td></tr>)}
            </tbody></table></div>
          )}
        </section>
        <section className="panel-card mini-chart-card">
          <div className="section-heading"><div><span className="eyebrow">SAÍDAS DO MÊS</span><h2>Onde você gastou</h2></div><Link to="/relatorios">Ver relatórios</Link></div>
          {!relatorio?.categoriasSaida?.some((item) => Number(item.total) > 0) ? <div className="empty-state"><p>Seus gastos por categoria aparecerão aqui.</p></div> : <Suspense fallback={<div className="state-card">Carregando gráfico…</div>}><GraficoCategorias categorias={relatorio.categoriasSaida} /></Suspense>}
        </section>
      </>}
    </section>
  );
}
