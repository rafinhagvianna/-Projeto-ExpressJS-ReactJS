import { useEffect, useState } from 'react';
import api from '../services/api.js';
import { dataBrasileira, moeda } from './formatos.js';

export default function Faturas() {
  const [dados, setDados] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');

  useEffect(() => {
    let ativo = true;
    api.get('/relatorios/faturas', { params: { meses: 3 } })
      .then(({ data }) => { if (ativo) setDados(data); })
      .catch((falha) => { if (ativo) setErro(falha.response?.data?.erro || 'Não foi possível carregar as faturas.'); })
      .finally(() => { if (ativo) setCarregando(false); });
    return () => { ativo = false; };
  }, []);

  return (
    <section className="page-content">
      <div className="page-heading"><div><span className="eyebrow">CARTÕES DE CRÉDITO</span><h1>Faturas previstas</h1><p>Fatura em aberto e as próximas três, com limite comprometido.</p></div></div>
      {erro && <div className="alert" role="alert">{erro}</div>}
      {carregando ? <section className="panel-card state-card">Calculando faturas…</section> : dados?.cartoes.length === 0 ? <section className="panel-card empty-state"><strong>Nenhum cartão cadastrado.</strong><p>Cadastre um cartão para acompanhar faturas e parcelas futuras.</p></section> : dados && <div className="invoice-list">
        {dados.cartoes.map((cartao) => {
          const percent = Math.max(0, Math.min(100, Number(cartao.percentualUtilizado)));
          return <article className="panel-card invoice-card" key={cartao.id}>
            <div className="invoice-head"><div><span className="eyebrow">CARTÃO</span><h2>{cartao.nome}</h2><p>Fecha dia {cartao.diaFechamento} · vence dia {cartao.diaVencimento}</p></div><div className="invoice-limit"><strong>{moeda.format(Number(cartao.limiteDisponivel))}</strong><span>disponível de {moeda.format(Number(cartao.limite))}</span></div></div>
            <div className="limit-bar" role="progressbar" aria-label={`Limite utilizado no ${cartao.nome}`} aria-valuenow={percent} aria-valuemin="0" aria-valuemax="100"><span style={{ width: `${percent}%` }} /></div>
            <div className="limit-details"><span>Utilizado: {moeda.format(Number(cartao.limiteUtilizado))}</span><span>{Number(cartao.percentualUtilizado).toFixed(1)}%</span></div>
            <div className="invoice-grid">{cartao.faturas.map((fatura) => <section className={`invoice-period ${fatura.aberta ? 'invoice-current' : ''}`} key={`${cartao.id}-${fatura.referencia}`}>
              <div className="invoice-period-head"><div><span className="eyebrow">{fatura.aberta ? 'FATURA EM ABERTO' : 'PRÓXIMA FATURA'}</span><h3>{fatura.referencia}</h3></div><strong>{moeda.format(Number(fatura.total))}</strong></div>
              <p className="invoice-dates">Fechamento {dataBrasileira(fatura.fechamento)} · vencimento {dataBrasileira(fatura.vencimento)}</p>
              {!fatura.itens.length ? <div className="invoice-empty">Sem lançamentos previstos.</div> : <ul className="invoice-items">{fatura.itens.map((item) => <li key={item.id}><span><strong>{item.descricaoParcela}</strong><small>Compra em {dataBrasileira(item.data)}</small></span><b>{moeda.format(Number(item.valor))}</b></li>)}</ul>}
            </section>)}</div>
          </article>;
        })}
      </div>}
    </section>
  );
}
