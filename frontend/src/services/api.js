import axios from 'axios';

// Todas as chamadas HTTP passam por esta instância.
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3000/api',
  timeout: 12000,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('financas_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (resposta) => resposta,
  (erro) => {
    const config = erro.config;
    if (erro.response?.status === 401 && config?.headers?.Authorization && !config.url?.includes('/auth/login')) {
      localStorage.removeItem('financas_token');
      window.dispatchEvent(new Event('auth:expired'));
      window.location.assign('/login');
    }
    return Promise.reject(erro);
  },
);

export default api;
