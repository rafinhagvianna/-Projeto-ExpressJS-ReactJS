import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext.jsx';

export default function Login() {
  const { login } = useAuth();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState('');
  const [carregando, setCarregando] = useState(false);

  async function enviar(evento) {
    evento.preventDefault();
    setErro('');
    if (!email.trim() || !senha) return setErro('Informe seu e-mail e sua senha.');
    setCarregando(true);
    try {
      await login(email.trim(), senha);
    } catch (falha) {
      setErro(falha.response?.data?.erro || 'Não foi possível entrar. Tente novamente.');
    } finally {
      setCarregando(false);
    }
  }

  return (
    <main className="auth-layout">
      <section className="auth-aside">
        <Link className="brand brand-light" to="/login">clareza<span>.</span></Link>
        <div className="aside-copy">
          <span className="eyebrow">SEU DINHEIRO, COM MAIS CLAREZA</span>
          <h1>Pequenas escolhas.<br />Mais tranquilidade.</h1>
          <p>Organize suas movimentações e acompanhe o que importa para você.</p>
        </div>
        <span className="aside-note">CONTROLE FINANCEIRO PESSOAL</span>
      </section>
      <section className="auth-main">
        <div className="auth-card">
          <span className="eyebrow">BEM-VINDA(O) DE VOLTA</span>
          <h2>Entre na sua conta</h2>
          <p className="form-intro">Use seu e-mail e senha para continuar.</p>
          {location.state?.cadastroOk && <div className="notice" role="status">Cadastro concluído. Agora entre com seu e-mail.</div>}
          {erro && <div className="alert" role="alert">{erro}</div>}
          <form onSubmit={enviar} noValidate>
            <label className="field-label" htmlFor="email">E-mail</label>
            <input id="email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="voce@email.com" />
            <label className="field-label" htmlFor="senha">Senha</label>
            <input id="senha" type="password" autoComplete="current-password" value={senha} onChange={(e) => setSenha(e.target.value)} placeholder="Sua senha" />
            <button className="button button-primary button-wide" disabled={carregando}>
              {carregando ? 'Entrando…' : 'Entrar'}
            </button>
          </form>
          <p className="form-footer">Ainda não tem uma conta? <Link to="/cadastro">Criar cadastro</Link></p>
        </div>
      </section>
    </main>
  );
}
