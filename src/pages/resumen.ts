import { supabase } from '../lib/supabase';

declare const Chart: any;

interface RegistroResumen {
  fecha: string;
  tiempo_minutos: number | null;
  categoria: {
    id?: number;
    nombre?: string;
    color?: string | null;
  } | Array<{
    id?: number;
    nombre?: string;
    color?: string | null;
  }> | null;
}

let observadorActivo = false;
let graficos: any[] = [];

function fechaLocalISO(fecha = new Date()): string {
  const año = fecha.getFullYear();
  const mes = String(fecha.getMonth() + 1).padStart(2, '0');
  const dia = String(fecha.getDate()).padStart(2, '0');
  return `${año}-${mes}-${dia}`;
}

function obtenerCategoria(categoria: RegistroResumen['categoria']) {
  if (Array.isArray(categoria)) return categoria[0] ?? {};
  return categoria ?? {};
}

function formatearTiempo(minutos: number): string {
  const total = Math.max(0, Math.floor(minutos || 0));
  const horas = Math.floor(total / 60);
  const mins = total % 60;
  if (horas === 0) return `${mins} min`;
  if (mins === 0) return `${horas} h`;
  return `${horas} h ${mins} min`;
}

function escapar(valor: string): string {
  return String(valor ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function inicioSemana(fecha: Date): Date {
  const copia = new Date(fecha);
  const dia = copia.getDay();
  const diasDesdeLunes = dia === 0 ? 6 : dia - 1;
  copia.setDate(copia.getDate() - diasDesdeLunes);
  return copia;
}

function destruirGraficos() {
  graficos.forEach(grafico => grafico.destroy());
  graficos = [];
}

function iniciarObservador() {
  if (observadorActivo) return;
  observadorActivo = true;

  const observer = new MutationObserver(() => {
    const resumen = document.getElementById('resumenHoras');
    if (resumen && !resumen.dataset.eonGrafico) {
      resumen.dataset.eonGrafico = 'cargando';
      cargarYMostrarResumen();
    }
  });

  observer.observe(document.body, { childList: true, subtree: true });
}

async function cargarYMostrarResumen() {
  const resumen = document.getElementById('resumenHoras');
  if (!resumen || typeof Chart === 'undefined') return;

  const user = await supabase.auth.getUser();
  const userId = user.data.user?.id;
  if (!userId) return;

  const hoy = new Date();
  const hoyISO = fechaLocalISO(hoy);
  const semanaISO = fechaLocalISO(inicioSemana(hoy));
  const mesISO = fechaLocalISO(new Date(hoy.getFullYear(), hoy.getMonth(), 1));

  // Se consulta desde el inicio del mes para poder construir correctamente
  // los tres períodos con una sola fuente de datos.
  const { data, error } = await supabase
    .from('registros')
    .select('fecha, tiempo_minutos, categoria:categorias(id,nombre,color)')
    .eq('user_id', userId)
    .gte('fecha', mesISO)
    .lte('fecha', hoyISO);

  if (error) {
    resumen.innerHTML = `<small style="color:red;">❌ ${escapar(error.message)}</small>`;
    return;
  }

  destruirGraficos();
  resumen.innerHTML = `
    <div style="display:grid; grid-template-columns:repeat(auto-fit,minmax(280px,1fr)); gap:1rem;">
      <article style="margin:0;">
        <header style="margin-bottom:0.75rem;"><strong>HOY</strong></header>
        <div id="resumenHoy"></div>
      </article>
      <article style="margin:0;">
        <header style="margin-bottom:0.75rem;"><strong>ESTA SEMANA</strong></header>
        <div id="resumenSemana"></div>
      </article>
      <article style="margin:0;">
        <header style="margin-bottom:0.75rem;"><strong>ESTE MES</strong></header>
        <div id="resumenMes"></div>
      </article>
    </div>
  `;

  const registros = (data ?? []) as RegistroResumen[];
  pintarPeriodo('resumenHoy', registros.filter(r => r.fecha === hoyISO), 'graficoHoy');
  pintarPeriodo('resumenSemana', registros.filter(r => r.fecha >= semanaISO), 'graficoSemana');
  pintarPeriodo('resumenMes', registros.filter(r => r.fecha >= mesISO), 'graficoMes');

  resumen.dataset.eonGrafico = 'listo';
}

function pintarPeriodo(contenedorId: string, registros: RegistroResumen[], canvasId: string) {
  const contenedor = document.getElementById(contenedorId);
  if (!contenedor) return;

  const porCategoria = new Map<string, { nombre: string; minutos: number; color: string }>();

  registros.forEach(registro => {
    const categoria = obtenerCategoria(registro.categoria);
    const nombre = categoria.nombre || 'Sin categoría';
    const id = categoria.id != null ? String(categoria.id) : `sin-${nombre}`;
    const color = categoria.color || '#9ca3af';
    const actual = porCategoria.get(id);
    const minutos = Number(registro.tiempo_minutos || 0);

    if (actual) actual.minutos += minutos;
    else porCategoria.set(id, { nombre, minutos, color });
  });

  const filas = [...porCategoria.values()]
    .filter(item => item.minutos > 0)
    .sort((a, b) => b.minutos - a.minutos);

  if (!filas.length) {
    contenedor.innerHTML = '<small style="color:var(--pico-muted-color);">Sin horas registradas.</small>';
    return;
  }

  const lista = filas.map(item => `
    <div style="display:flex; align-items:center; justify-content:space-between; gap:0.75rem; margin-bottom:0.45rem;">
      <span style="display:flex; align-items:center; gap:0.5rem; min-width:0;">
        <span aria-hidden="true" style="display:inline-block; flex:0 0 0.8rem; width:0.8rem; height:0.8rem; border-radius:50%; background:${escapar(item.color)};"></span>
        <span style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${escapar(item.nombre)}</span>
      </span>
      <strong style="white-space:nowrap;">${formatearTiempo(item.minutos)}</strong>
    </div>
  `).join('');

  contenedor.innerHTML = `
    <div style="display:grid; grid-template-columns:minmax(150px,1fr) minmax(130px,180px); gap:1rem; align-items:center;">
      <div>${lista}</div>
      <div style="position:relative; width:100%; max-width:180px; margin:auto;">
        <canvas id="${canvasId}" aria-label="Distribución de horas por categoría"></canvas>
      </div>
    </div>
  `;

  const canvas = document.getElementById(canvasId) as HTMLCanvasElement | null;
  if (!canvas) return;

  const grafico = new Chart(canvas, {
    type: 'doughnut',
    data: {
      labels: filas.map(item => item.nombre),
      datasets: [{
        data: filas.map(item => item.minutos),
        backgroundColor: filas.map(item => item.color),
        borderWidth: 1
      }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (context: any) => {
              const valor = Number(context.raw || 0);
              return ` ${context.label}: ${formatearTiempo(valor)}`;
            }
          }
        }
      }
    }
  });

  graficos.push(grafico);
}

iniciarObservador();
