import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext.jsx';

function mascararCpf(valor) {
  const d = valor.replace(/\D/g, '').slice(0, 11);
  return d.replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d{1,2})$/, '$1-$2');
}

function validarCpf(valor) {
  const d = valor.replace(/\D/g, '');
  if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return false;
  const digito = (tamanho) => {
    const soma = d.slice(0, tamanho).split('').reduce((total, n, i) => total + Number(n) * (tamanho + 1 - i), 0);
    const resto = (soma * 10) % 11;
    return resto === 10 ? 0 : resto;
  };
  return digito(9) === Number(d[9]) && digito(10) === Number(d[10]);
}

export default function Cadastro() {
  const { cadastrar } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ nome: '', email: '', cpf: '', senha: '', confirmarSenha: '' });
  const [campos, setCampos] = useState({});
  const [erro, setErro] = useState('');
  const [carregando, setCarregando] = useState(false);

  function alterar(campo, valor) {
    setForm((atual) => ({ ...atual, [campo]: valor }));
    setCampos((atuais) => ({ ...atuais, [campo]: '' }));
    setErro('');
  }

  async function enviar(evento) {
    evento.preventDefault();
    const novosErros = {};
    if (!form.nome.trim()) novosErros.nome = 'Informe seu nome.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) novosErros.email = 'Informe um e-mail válido.';
    if (!validarCpf(form.cpf)) novosErros.cpf = 'Informe um CPF válido.';
    if (form.senha.length < 8 || !/[A-Za-z]/.test(form.senha) || !/\d/.test(form.senha)) novosErros.senha = 'Use 8 caracteres ou mais, com letras e números.';
    if (form.confirmarSenha !== form.senha) novosErros.confirmarSenha = 'As senhas não coincidem.';
    setCampos(novosErros);
    setErro('');
    if (Object.keys(novosErros).length) return;

    setCarregando(true);
    try {
      await cadastrar({ ...form, nome: form.nome.trim(), email: form.email.trim(), cpf: form.cpf.replace(/\D/g, '') });
      navigate('/login', { replace: true, state: { cadastroOk: true } });
    } catch (falha) {
      setCampos((atuais) => ({ ...atuais, ...(falha.response?.data?.campos || {}) }));
      setErro(falha.response?.data?.erro || 'Não foi possível concluir o cadastro. Tente novamente.');
    } finally {
      setCarregando(false);
    }
  }

  return (
    <main className="auth-layout auth-layout-register">
      <section className="auth-aside">
        <Link className="brand brand-light" to="/login">clareza<span>.</span></Link>
        <div className="aside-copy">
          <span className="eyebrow">UM BOM COMEÇO</span>
          <h1>Entenda seu dinheiro.<br />No seu ritmo.</h1>
          <p>Crie sua conta para começar a registrar entradas, gastos e planos.</p>
        </div>
        <span className="aside-note">SEUS DADOS SÃO PROTEGIDOS</span>
      </section>
      <section className="auth-main">
        <div className="auth-card auth-card-register">
          <span className="eyebrow">NOVO POR AQUI?</span>
          <h2>Crie sua conta</h2>
          <p className="form-intro">Preencha seus dados para começar.</p>
          {erro && <div className="alert" role="alert">{erro}</div>}
          <form onSubmit={enviar} noValidate>
            <label className="field-label" htmlFor="nome">Nome</label>
            <input id="nome" autoComplete="name" value={form.nome} onChange={(e) => alterar('nome', e.target.value)} aria-invalid={Boolean(campos.nome)} />
            {campos.nome && <span className="field-error">{campos.nome}</span>}
            <label className="field-label" htmlFor="email">E-mail</label>
            <input id="email" type="email" autoComplete="email" value={form.email} onChange={(e) => alterar('email', e.target.value)} aria-invalid={Boolean(campos.email)} />
            {campos.email && <span className="field-error">{campos.email}</span>}
            <label className="field-label" htmlFor="cpf">CPF</label>
            <input id="cpf" inputMode="numeric" autoComplete="off" value={form.cpf} onChange={(e) => alterar('cpf', mascararCpf(e.target.value))} placeholder="000.000.000-00" aria-invalid={Boolean(campos.cpf)} />
            {campos.cpf && <span className="field-error">{campos.cpf}</span>}
            <div className="field-grid">
              <div>
                <label className="field-label" htmlFor="senha">Senha</label>
                <input id="senha" type="password" autoComplete="new-password" value={form.senha} onChange={(e) => alterar('senha', e.target.value)} aria-invalid={Boolean(campos.senha)} />
                {campos.senha && <span className="field-error">{campos.senha}</span>}
              </div>
              <div>
                <label className="field-label" htmlFor="confirmarSenha">Confirmar senha</label>
                <input id="confirmarSenha" type="password" autoComplete="new-password" value={form.confirmarSenha} onChange={(e) => alterar('confirmarSenha', e.target.value)} aria-invalid={Boolean(campos.confirmarSenha)} />
                {campos.confirmarSenha && <span className="field-error">{campos.confirmarSenha}</span>}
              </div>
            </div>
            <button className="button button-primary button-wide" disabled={carregando}>
              {carregando ? 'Criando conta…' : 'Criar conta'}
            </button>
          </form>
          <p className="form-footer">Já tem uma conta? <Link to="/login">Entrar</Link></p>
        </div>
      </section>
    </main>
  );
}
