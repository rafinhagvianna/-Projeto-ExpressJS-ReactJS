import { useCallback, useEffect, useMemo, useState } from 'react';
import api from '../services/api.js';
import { dataBrasileira, dinheiroParaApi, mascaraDinheiro, moeda } from './formatos.js';

function hojeIso() {
  const hoje = new Date();
  return `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}-${String(hoje.getDate()).padStart(2, '0')}`;
}

function mesCorrente() {
  const hoje = new Date();
  return {
    inicio: `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}-01`,
    fim: `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}-${new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0).getDate()}`,
  };
}

const novoForm = () => ({ tipo: 'saida', descricao: '', valor: '0,00', data: hojeIso(), categoria_id: '', fonte_destino_id: '', total_parcelas: 1 });

export default function Lancamentos() {
  const mes = useMemo(mesCorrente, []);
  const [filtros, setFiltros] = useState({ ...mes, tipo: '', categoriaId: '', fonteDestinoId: '' });
  const [pagina, setPagina] = useState(1);
  const [dados, setDados] = useState(null);
  const [categorias, setCategorias] = useState([]);
  const [fontes, setFontes] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [campos, setCampos] = useState({});
  const [form, setForm] = useState(novoForm());
  const [aberto, setAberto] = useState(false);
  const [editando, setEditando] = useState(null);
  const [apagar, setApagar] = useState(null);

  useEffect(() => {
    let ativo = true;
    Promise.all([api.get('/categorias'), api.get('/fontes-destinos')])
      .then(([cats, fontesResp]) => {
        if (!ativo) return;
        setCategorias(cats.data.categorias);
        setFontes(fontesResp.data.fontesDestinos);
      })
      .catch((falha) => { if (ativo) setErro(falha.response?.data?.erro || 'Não foi possível carregar os filtros.'); });
    return () => { ativo = false; };
  }, []);

  const carregar = useCallback(async () => {
    setCarregando(true); setErro('');
    try {
      const { data } = await api.get('/lancamentos', {
        params: {
          inicio: filtros.inicio, fim: filtros.fim, tipo: filtros.tipo || undefined,
          categoriaId: filtros.categoriaId || undefined, fonteDestinoId: filtros.fonteDestinoId || undefined,
          pagina, limite: 10,
        },
      });
      setDados(data);
    } catch (falha) { setErro(falha.response?.data?.erro || 'Não foi possível carregar os lançamentos.'); }
    finally { setCarregando(false); }
  }, [filtros, pagina]);
  useEffect(() => { carregar(); }, [carregar]);

  const categoriasDoTipo = categorias.filter((item) => item.tipo === form.tipo);
  const fontesDoTipo = fontes.filter((item) => form.tipo === 'entrada'
    ? item.tipo !== 'cartao_credito'
    : item.tipo !== 'renda');

  function atualizarForm(campo, valor) {
    setForm((atual) => {
      const novo = { ...atual, [campo]: valor };
      if (campo === 'tipo') {
        novo.categoria_id = '';
        novo.fonte_destino_id = '';
        novo.total_parcelas = 1;
      }
      return novo;
    });
    setCampos((atuais) => ({ ...atuais, [campo]: '' }));
  }

  function abrirNovo() {
    setEditando(null); setForm(novoForm()); setCampos({}); setErro(''); setAberto(true);
  }

  function abrirEdicao(item) {
    setEditando(item);
    setForm({
      tipo: item.tipo, descricao: item.descricao,
      valor: mascaraDinheiro(String(Math.round(Number(item.valor) * 100))), data: item.data,
      categoria_id: String(item.categoria_id), fonte_destino_id: String(item.fonte_destino_id),
      total_parcelas: item.total_parcelas,
    });
    setCampos({}); setErro(''); setAberto(true);
  }

  function fecharForm() { setAberto(false); setEditando(null); setCampos({}); }

  async function salvar(evento) {
    evento.preventDefault();
    const novosErros = {};
    if (!form.descricao.trim()) novosErros.descricao = 'Informe uma descrição.';
    if (!Number(dinheiroParaApi(form.valor))) novosErros.valor = 'Informe um valor positivo.';
    if (!form.data) novosErros.data = 'Informe a data.';
    if (!form.categoria_id) novosErros.categoria_id = 'Selecione uma categoria.';
    if (!form.fonte_destino_id) novosErros.fonte_destino_id = 'Selecione uma fonte ou destino.';
    const parcelas = Number(form.total_parcelas);
    if (!Number.isInteger(parcelas) || parcelas < 1 || parcelas > 48) novosErros.total_parcelas = 'Use de 1 a 48 parcelas.';
    setCampos(novosErros); setErro('');
    if (Object.keys(novosErros).length) return;

    const payload = {
      ...form, descricao: form.descricao.trim(), valor: dinheiroParaApi(form.valor),
      categoria_id: Number(form.categoria_id), fonte_destino_id: Number(form.fonte_destino_id),
      total_parcelas: parcelas,
    };
    try {
      if (editando) await api.put(`/lancamentos/${editando.id}`, payload);
      else await api.post('/lancamentos', payload);
      fecharForm(); await carregar();
    } catch (falha) {
      setCampos((atuais) => ({ ...atuais, ...(falha.response?.data?.campos || {}) }));
      setErro(falha.response?.data?.erro || 'Não foi possível salvar o lançamento.');
    }
  }

  async function confirmarExclusao(todas) {
    if (!apagar) return;
    setErro('');
    try {
      await api.delete(`/lancamentos/${apagar.id}`, { params: { todasParcelas: todas ? 'true' : 'false' } });
      setApagar(null); await carregar();
    } catch (falha) { setErro(falha.response?.data?.erro || 'Não foi possível excluir o lançamento.'); }
  }

  return (
    <section className="page-content">
      <div className="page-heading"><div><span className="eyebrow">REGISTROS</span><h1>Lançamentos</h1><p>Registre e acompanhe suas entradas e saídas.</p></div><button className="button button-primary" onClick={abrirNovo}>+ Novo lançamento</button></div>
      {erro && <div className="alert" role="alert">{erro}</div>}
      <section className="filter-panel">
        <div className="form-control"><label htmlFor="inicio">De</label><input id="inicio" type="date" value={filtros.inicio} onChange={(e) => { setFiltros({ ...filtros, inicio: e.target.value }); setPagina(1); }} /></div>
        <div className="form-control"><label htmlFor="fim">Até</label><input id="fim" type="date" value={filtros.fim} onChange={(e) => { setFiltros({ ...filtros, fim: e.target.value }); setPagina(1); }} /></div>
        <div className="form-control"><label htmlFor="filtro-tipo">Tipo</label><select id="filtro-tipo" value={filtros.tipo} onChange={(e) => { setFiltros({ ...filtros, tipo: e.target.value }); setPagina(1); }}><option value="">Todos</option><option value="entrada">Entrada</option><option value="saida">Saída</option></select></div>
        <div className="form-control"><label htmlFor="filtro-categoria">Categoria</label><select id="filtro-categoria" value={filtros.categoriaId} onChange={(e) => { setFiltros({ ...filtros, categoriaId: e.target.value }); setPagina(1); }}><option value="">Todas</option>{categorias.filter((c) => !filtros.tipo || c.tipo === filtros.tipo).map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}</select></div>
        <div className="form-control"><label htmlFor="filtro-fonte">Fonte/destino</label><select id="filtro-fonte" value={filtros.fonteDestinoId} onChange={(e) => { setFiltros({ ...filtros, fonteDestinoId: e.target.value }); setPagina(1); }}><option value="">Todas</option>{fontes.map((f) => <option key={f.id} value={f.id}>{f.nome}</option>)}</select></div>
      </section>
      {dados && <div className="summary-strip"><span>Entradas <strong className="positive">{moeda.format(Number(dados.totalEntradas))}</strong></span><span>Saídas <strong className="negative">{moeda.format(Number(dados.totalSaidas))}</strong></span><span>Saldo <strong>{moeda.format(Number(dados.saldo))}</strong></span></div>}
      <section className="panel-card">
        {carregando ? <div className="state-card">Carregando lançamentos…</div> : !dados?.lancamentos.length ? <div className="empty-state"><strong>Nenhum lançamento neste período.</strong><p>Altere os filtros ou registre uma nova movimentação.</p></div> : (
          <div className="table-wrap"><table><thead><tr><th>Descrição</th><th>Categoria</th><th>Data</th><th>Fonte/destino</th><th>Valor</th><th className="actions-heading">Ações</th></tr></thead><tbody>
            {dados.lancamentos.map((item) => <tr key={item.id}><td><strong>{item.descricao}</strong>{item.total_parcelas > 1 && <small>Parcela {item.parcela_atual}/{item.total_parcelas}</small>}</td><td>{item.categoria_nome}</td><td>{dataBrasileira(item.data)}</td><td>{item.fonte_destino_nome}</td><td className={item.tipo === 'entrada' ? 'positive' : 'negative'}>{item.tipo === 'entrada' ? '+' : '−'} {moeda.format(Number(item.valor))}</td><td className="row-actions"><button className="text-button" onClick={() => abrirEdicao(item)}>Editar</button><button className="text-button danger" onClick={() => setApagar(item)}>Excluir</button></td></tr>)}
          </tbody></table></div>
        )}
        {dados?.totalPaginas > 1 && <div className="pagination"><button className="button button-quiet" disabled={pagina <= 1} onClick={() => setPagina(pagina - 1)}>Anterior</button><span>Página {pagina} de {dados.totalPaginas}</span><button className="button button-quiet" disabled={pagina >= dados.totalPaginas} onClick={() => setPagina(pagina + 1)}>Próxima</button></div>}
      </section>

      {aberto && <div className="modal-backdrop"><section className="modal-card modal-form" role="dialog" aria-modal="true" aria-labelledby="form-titulo">
        <div className="section-heading"><div><span className="eyebrow">MOVIMENTAÇÃO</span><h2 id="form-titulo">{editando ? 'Editar lançamento' : 'Novo lançamento'}</h2></div><button className="button button-quiet" onClick={fecharForm}>Fechar</button></div>
        {erro && <div className="alert" role="alert">{erro}</div>}
        <form onSubmit={salvar}>
          <div className="form-row"><div className="form-control"><label htmlFor="lanc-tipo">Tipo</label><select id="lanc-tipo" value={form.tipo} onChange={(e) => atualizarForm('tipo', e.target.value)}><option value="saida">Saída</option><option value="entrada">Entrada</option></select></div><div className="form-control"><label htmlFor="lanc-data">Data</label><input id="lanc-data" type="date" value={form.data} onChange={(e) => atualizarForm('data', e.target.value)} aria-invalid={Boolean(campos.data)} />{campos.data && <small className="field-error">{campos.data}</small>}</div></div>
          <div className="form-control"><label htmlFor="lanc-descricao">Descrição</label><input id="lanc-descricao" maxLength="120" value={form.descricao} onChange={(e) => atualizarForm('descricao', e.target.value)} aria-invalid={Boolean(campos.descricao)} />{campos.descricao && <small className="field-error">{campos.descricao}</small>}</div>
          <div className="form-row"><div className="form-control"><label htmlFor="lanc-valor">Valor (R$)</label><input id="lanc-valor" inputMode="decimal" value={form.valor} onChange={(e) => atualizarForm('valor', mascaraDinheiro(e.target.value))} aria-invalid={Boolean(campos.valor)} />{campos.valor && <small className="field-error">{campos.valor}</small>}</div><div className="form-control"><label htmlFor="lanc-categoria">Categoria</label><select id="lanc-categoria" value={form.categoria_id} onChange={(e) => atualizarForm('categoria_id', e.target.value)} aria-invalid={Boolean(campos.categoria_id)}><option value="">Selecione</option>{categoriasDoTipo.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}</select>{campos.categoria_id && <small className="field-error">{campos.categoria_id}</small>}</div></div>
          <div className="form-row"><div className="form-control"><label htmlFor="lanc-fonte">Fonte/destino</label><select id="lanc-fonte" value={form.fonte_destino_id} onChange={(e) => { atualizarForm('fonte_destino_id', e.target.value); if (fontes.find((f) => String(f.id) === e.target.value)?.tipo !== 'cartao_credito') atualizarForm('total_parcelas', 1); }} aria-invalid={Boolean(campos.fonte_destino_id)}><option value="">Selecione</option>{fontesDoTipo.map((f) => <option key={f.id} value={f.id}>{f.nome}</option>)}</select>{campos.fonte_destino_id && <small className="field-error">{campos.fonte_destino_id}</small>}</div>
            {fontes.find((f) => String(f.id) === String(form.fonte_destino_id))?.tipo === 'cartao_credito' && <div className="form-control"><label htmlFor="parcelas">Parcelas</label><input id="parcelas" type="number" min="1" max="48" value={form.total_parcelas} disabled={Boolean(editando?.grupo_parcelamento)} onChange={(e) => atualizarForm('total_parcelas', e.target.value)} aria-invalid={Boolean(campos.total_parcelas)} />{campos.total_parcelas && <small className="field-error">{campos.total_parcelas}</small>}</div>}
          </div>
          <div className="modal-actions"><button type="button" className="button button-quiet" onClick={fecharForm}>Cancelar</button><button className="button button-primary">{editando ? 'Salvar lançamento' : 'Registrar lançamento'}</button></div>
        </form>
      </section></div>}

      {apagar && <div className="modal-backdrop"><section className="modal-card" role="dialog" aria-modal="true" aria-labelledby="exclusao-titulo"><span className="eyebrow">CONFIRMAÇÃO</span><h2 id="exclusao-titulo">Excluir lançamento?</h2><p>{apagar.total_parcelas > 1 ? `“${apagar.descricao}” é a parcela ${apagar.parcela_atual}/${apagar.total_parcelas}. Escolha se deseja excluir apenas esta parcela ou o grupo inteiro.` : `Esta ação removerá “${apagar.descricao}”.`}</p><div className="modal-actions"><button className="button button-quiet" onClick={() => setApagar(null)}>Cancelar</button>{apagar.total_parcelas > 1 ? <><button className="button button-outline" onClick={() => confirmarExclusao(false)}>Só esta parcela</button><button className="button button-danger" onClick={() => confirmarExclusao(true)}>Todas as parcelas</button></> : <button className="button button-danger" onClick={() => confirmarExclusao(false)}>Excluir</button>}</div></section></div>}
    </section>
  );
}
