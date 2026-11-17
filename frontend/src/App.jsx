import { Navigate, Route, Routes } from 'react-router-dom';
import Login from './components/Login.jsx';
import Cadastro from './components/Cadastro.jsx';
import RotaProtegida from './components/RotaProtegida.jsx';
import Painel, { PainelLayout } from './components/Painel.jsx';
import Lancamentos from './components/Lancamentos.jsx';
import Categorias from './components/Categorias.jsx';
import FontesDestinos from './components/FontesDestinos.jsx';

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/cadastro" element={<Cadastro />} />
      <Route path="/" element={<RotaProtegida><PainelLayout><Painel /></PainelLayout></RotaProtegida>} />
      <Route path="/lancamentos" element={<RotaProtegida><PainelLayout><Lancamentos /></PainelLayout></RotaProtegida>} />
      <Route path="/categorias" element={<RotaProtegida><PainelLayout><Categorias /></PainelLayout></RotaProtegida>} />
      <Route path="/fontes-destinos" element={<RotaProtegida><PainelLayout><FontesDestinos /></PainelLayout></RotaProtegida>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
