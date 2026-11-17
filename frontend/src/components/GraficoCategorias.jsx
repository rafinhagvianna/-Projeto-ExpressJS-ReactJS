import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { moeda } from './formatos.js';

const cores = ['#28614f', '#7ea980', '#d4a56c', '#9e7864', '#8399a0'];

export default function GraficoCategorias({ categorias }) {
  const comGastos = categorias.filter((item) => Number(item.total) > 0);
  return (
    <div className="mini-chart-layout">
      <div className="mini-pie"><ResponsiveContainer width="100%" height="100%"><PieChart>
        <Pie data={comGastos} dataKey="total" nameKey="nome" innerRadius="55%" outerRadius="82%" paddingAngle={3}>
          {comGastos.map((item, indice) => <Cell key={item.id} fill={cores[indice % cores.length]} />)}
        </Pie>
        <Tooltip formatter={(valor) => moeda.format(Number(valor))} />
      </PieChart></ResponsiveContainer></div>
      <div className="mini-legend">{comGastos.slice(0, 5).map((item, indice) => <div key={item.id}><i style={{ background: cores[indice % cores.length] }} /><span>{item.nome}</span><strong>{moeda.format(Number(item.total))}</strong></div>)}</div>
    </div>
  );
}
