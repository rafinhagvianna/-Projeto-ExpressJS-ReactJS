import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api.js';

const AuthContext = createContext(null);
const TOKEN_KEY = 'financas_token';

export function AuthProvider({ children }) {
  const navigate = useNavigate();
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_KEY));
  const [usuario, setUsuario] = useState(null);
  const [carregando, setCarregando] = useState(Boolean(localStorage.getItem(TOKEN_KEY)));

  useEffect(() => {
    if (!token) {
      setCarregando(false);
      return undefined;
    }
    let ativo = true;
    api.get('/auth/me')
      .then(({ data }) => { if (ativo) setUsuario(data.usuario); })
      .catch(() => {
        if (ativo && !localStorage.getItem(TOKEN_KEY)) setUsuario(null);
      })
      .finally(() => { if (ativo) setCarregando(false); });

    return () => { ativo = false; };
  }, [token]);

  useEffect(() => {
    const encerrarSessao = () => {
      localStorage.removeItem(TOKEN_KEY);
      setToken(null);
      setUsuario(null);
      setCarregando(false);
      navigate('/login', { replace: true });
    };
    window.addEventListener('auth:expired', encerrarSessao);
    return () => window.removeEventListener('auth:expired', encerrarSessao);
  }, [navigate]);

  async function login(email, senha) {
    const { data } = await api.post('/auth/login', { email, senha });
    localStorage.setItem(TOKEN_KEY, data.token);
    setToken(data.token);
    setUsuario(data.usuario);
    navigate('/', { replace: true });
  }

  async function cadastrar(dados) {
    return api.post('/auth/cadastro', dados);
  }

  function logout() {
    localStorage.removeItem(TOKEN_KEY);
    setToken(null);
    setUsuario(null);
    navigate('/login', { replace: true });
  }

  const valor = useMemo(() => ({ usuario, token, carregando, login, logout, cadastrar }), [
    usuario, token, carregando,
  ]);
  return <AuthContext.Provider value={valor}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const contexto = useContext(AuthContext);
  if (!contexto) throw new Error('useAuth deve ser usado dentro de AuthProvider.');
  return contexto;
}
