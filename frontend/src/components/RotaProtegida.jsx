import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext.jsx';

export default function RotaProtegida({ children }) {
  const { usuario, token, carregando } = useAuth();
  if (carregando) return <main className="center-screen">Verificando sua sessão…</main>;
  if (!token || !usuario) return <Navigate to="/login" replace />;
  return children;
}
