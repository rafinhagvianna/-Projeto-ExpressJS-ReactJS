import { Link, Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext.jsx';
import Login from './components/Login.jsx';
import Cadastro from './components/Cadastro.jsx';
import RotaProtegida from './components/RotaProtegida.jsx';

function Inicio() {
  const { usuario, logout } = useAuth();
  return (
    <main className="app-shell">
      <header className="topbar">
        <Link className="brand" to="/">clareza<span>.</span></Link>
        <button className="button button-quiet" onClick={logout}>Sair</button>
      </header>
      <section className="welcome-card">
        <span className="eyebrow">ÁREA SEGURA</span>
        <h1>Olá, {usuario?.nome?.split(' ')[0]}.</h1>
        <p>Sua conta está protegida. O painel financeiro será conectado nos próximos marcos.</p>
      </section>
    </main>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/cadastro" element={<Cadastro />} />
      <Route path="/" element={<RotaProtegida><Inicio /></RotaProtegida>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
