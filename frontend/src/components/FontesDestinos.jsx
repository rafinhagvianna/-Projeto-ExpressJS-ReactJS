import { useCallback, useEffect, useState } from 'react';
import api from '../services/api.js';
import { dinheiroParaApi, mascaraDinheiro, moeda } from './formatos.js';

const vazio = { nome: '', tipo: 'conta', dia_fechamento: '', dia_vencimento: '', limite: '', reserva: false };

function paraFormulario(fonte) {
  const centavos = Math.round(Number(fonte.limite || 0) * 100);
  return {
    nome: fonte.nome, tipo: fonte.tipo, dia_fechamento: fonte.dia_fechamento || '',
    dia_vencimento: fonte.dia_vencimento || '', limite: mascaraDinheiro(String(centavos)), reserva: fonte.reserva,
  };
}

export default function FontesDestinos() {
  const [fontes, setFontes] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [campos, setCampos] = useState({});
  const [form, setForm] = useState(vazio);
  const [editando, setEditando] = useState(null);
  const [aberto, setAberto] = useState(false);

  const carregar = useCallback(async () => {
    setCarregando(true); setErro('');
    try { const { data } = await api.get('/fontes-destinos'); setFontes(data.fontesDestinos); }
    catch (falha) { setErro(falha.response?.data?.erro || 'Não foi possível carregar fontes e destinos.'); }
    finally { setCarregando(false); }
  }, []);
  useEffect(() => { carregar(); }, [carregar]);

  function cancelar() { setAberto(false); setEditando(null); setForm(vazio); setCampos({}); }
  function editar(fonte) { setEditando(fonte.id); setForm(paraFormulario(fonte)); setCampos({}); setErro(''); setAberto(true); }

  async function salvar(evento) {
    evento.preventDefault();
    const novos = {};
    if (!form.nome.trim()) novos.nome = 'Informe um nome.';
    if (form.tipo === 'cartao_credito') {
      const fecha = Number(form.dia_fechamento); const vence = Number(form.dia_vencimento);
      if (!Number.isInteger(fecha) || fecha < 1 || fecha > 31) novos.dia_fechamento = 'Use um dia de 1 a 31.';
      if (!Number.isInteger(vence) || vence < 1 || vence > 31) novos.dia_vencimento = 'Use um dia de 1 a 31.';
      if (!Number(dinheiroParaApi(form.limite))) novos.limite = 'Informe um limite positivo.';
    }
    setCampos(novos); setErro('');
    if (Object.keys(novos).length) return;
    const dados = {
      nome: form.nome.trim(), tipo: form.tipo,
      dia_fechamento: form.tipo === 'cartao_credito' ? Number(form.dia_fechamento) : null,
      dia_vencimento: form.tipo === 'cartao_credito' ? Number(form.dia_vencimento) : null,
      limite: form.tipo === 'cartao_credito' ? dinheiroParaApi(form.limite) : null,
      reserva: form.tipo === 'conta' && form.reserva,
    };
    try {
      if (editando) await api.put(`/fontes-destinos/${editando}`, dados);
      else await api.post('/fontes-destinos', dados);
      cancelar(); await carregar();
    } catch (falha) {
      setCampos((atuais) => ({ ...atuais, ...(falha.response?.data?.campos || {}) }));
      setErro(falha.response?.data?.erro || 'Não foi possível salvar a fonte ou destino.');
    }
  }

  async function excluir(fonte) {
    if (!window.confirm(`Excluir “${fonte.nome}”?`)) return;
    setErro('');
    try { await api.delete(`/fontes-destinos/${fonte.id}`); await carregar(); }
    catch (falha) { setErro(falha.response?.data?.erro || 'Não foi possível excluir este cadastro.'); }
  }

  return (
    <section className="page-content">
      <div className="page-heading"><div><span className="eyebrow">CONTAS E CARTÕES</span><h1>Fontes e destinos</h1><p>Cadastre contas, rendas e cartões usados nos lançamentos.</p></div><button className="button button-primary" onClick={() => { setAberto(!aberto); setEditando(null); setForm(vazio); }}>+ Novo cadastro</button></div>
      {erro && <div className="alert" role="alert">{erro}</div>}
      {aberto && <form className="form-panel" onSubmit={salvar}>
        <div className="section-heading"><h2>{editando ? 'Editar cadastro' : 'Novo cadastro'}</h2><button className="button button-quiet" type="button" onClick={cancelar}>Fechar</button></div>
        <div className="form-row">
          <div className="form-control"><label htmlFor="fonte-nome">Nome</label><input id="fonte-nome" value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} aria-invalid={Boolean(campos.nome)} />{campos.nome && <small className="field-error">{campos.nome}</small>}</div>
          <div className="form-control"><label htmlFor="fonte-tipo">Tipo</label><select id="fonte-tipo" value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value })}><option value="conta">Conta</option><option value="renda">Renda</option><option value="cartao_credito">Cartão de crédito</option></select>{campos.tipo && <small className="field-error">{campos.tipo}</small>}</div>
        </div>
        {form.tipo === 'cartao_credito' && <div className="form-row form-row-three">
          <div className="form-control"><label htmlFor="fechamento">Dia de fechamento</label><input id="fechamento" type="number" min="1" max="31" value={form.dia_fechamento} onChange={(e) => setForm({ ...form, dia_fechamento: e.target.value })} aria-invalid={Boolean(campos.dia_fechamento)} />{campos.dia_fechamento && <small className="field-error">{campos.dia_fechamento}</small>}</div>
          <div className="form-control"><label htmlFor="vencimento">Dia de vencimento</label><input id="vencimento" type="number" min="1" max="31" value={form.dia_vencimento} onChange={(e) => setForm({ ...form, dia_vencimento: e.target.value })} aria-invalid={Boolean(campos.dia_vencimento)} />{campos.dia_vencimento && <small className="field-error">{campos.dia_vencimento}</small>}</div>
          <div className="form-control"><label htmlFor="limite">Limite do cartão (R$)</label><input id="limite" inputMode="decimal" value={form.limite} placeholder="0,00" onChange={(e) => setForm({ ...form, limite: mascaraDinheiro(e.target.value) })} aria-invalid={Boolean(campos.limite)} />{campos.limite && <small className="field-error">{campos.limite}</small>}</div>
        </div>}
        {form.tipo === 'conta' && <label className="check-control"><input type="checkbox" checked={form.reserva} onChange={(e) => setForm({ ...form, reserva: e.target.checked })} /> Marcar como reserva de emergência</label>}
        <button className="button button-primary">{editando ? 'Salvar alterações' : 'Criar cadastro'}</button>
      </form>}
      <section className="panel-card">
        <div className="section-heading"><div><span className="eyebrow">CADASTROS PESSOAIS</span><h2>Contas, rendas e cartões</h2></div></div>
        {carregando ? <div className="state-card">Carregando cadastros…</div> : fontes.length === 0 ? <div className="empty-state"><strong>Nenhuma fonte ou destino cadastrado.</strong><p>Adicione uma conta, renda ou cartão para registrar movimentações.</p></div> : (
          <div className="table-wrap"><table><thead><tr><th>Nome</th><th>Tipo</th><th>Detalhes</th><th className="actions-heading">Ações</th></tr></thead><tbody>
            {fontes.map((fonte) => <tr key={fonte.id}><td><strong>{fonte.nome}</strong>{fonte.reserva && <small>Reserva de emergência</small>}</td><td><span className="tag">{fonte.tipo === 'cartao_credito' ? 'Cartão' : fonte.tipo === 'renda' ? 'Renda' : 'Conta'}</span></td><td>{fonte.tipo === 'cartao_credito' ? `Fecha dia ${fonte.dia_fechamento} · vence dia ${fonte.dia_vencimento} · ${moeda.format(Number(fonte.limite))}` : '—'}</td><td className="row-actions"><button className="text-button" onClick={() => editar(fonte)}>Editar</button><button className="text-button danger" onClick={() => excluir(fonte)}>Excluir</button></td></tr>)}
          </tbody></table></div>
        )}
      </section>
    </section>
  );
}
