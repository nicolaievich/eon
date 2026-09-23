import { supabase } from '../lib/supabase';

declare const Chart: any;

type Periodo = 'hoy' | 'semana' | 'mes';

function fechaLocalISO(fecha = new Date()): string {
  const año = fecha.getFullYear();
  const mes = String(fecha.getMonth() + 1).padStart(2, '0');
  const dia = String(fecha.getDate()).padStart(2, '0');
  return `${año}-${mes}-${dia}`;
}

function formatearTiempo(minutos: number): string {
  const total = Math.max(0, Math.floor(Number(minutos) || 0));
  const horas = Math.floor(total / 60);
  const mins = total % 60;
  return `${String(horas).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
}

function escapar(valor: string): string {
  return String(valor ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function rangoPeriodo(periodo: Periodo) {
  const hoy = new Date();
  const hoyISO = fechaLocalISO(hoy);

  if (periodo === 'hoy') {
    return { desde: hoyISO, hasta: hoyISO, titulo: 'Hoy' };
  }

  if (periodo === 'semana') {
    const diaSemana = hoy.getDay();
    const diasDesdeLunes = diaSemana === 0 ? 6 : diaSemana - 1;
    const inicio = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() - diasDesdeLunes);
    return { desde: fechaLocalISO(inicio), hasta: hoyISO, titulo: 'Esta semana' };
  }

  const inicio = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
  return { desde: fechaLocalISO(inicio), hasta: hoyISO, titulo: 'Este mes' };
}

export async function renderGrafico(container: HTMLElement, periodo: Periodo) {
  const rango = rangoPeriodo(periodo);
  const fechaTexto = rango.desde === rango.hasta
    ? rango.desde.split('-').reverse().join('-')
    : `${rango.desde.split('-').reverse().join('-')} al ${rango.hasta.split('-').reverse().join('-')}`;

  container.innerHTML = `
    <article>
      <button type="button" id="volverRegistros" class="secondary outline">← Volver a registros</button>
      <h2 style="margin-top:1rem;">📊 Horas por categoría</h2>
      <p><strong>${rango.titulo}</strong> · ${fechaTexto}</p>
      <div id="graficoMensaje"><small>Cargando...</small></div>
      <div style="max-width:650px;margin:1.5rem auto;">
        <canvas id="graficoCategorias"></canvas>
      </div>
      <div id="graficoDetalle"></div>
    </article>
  `;

  const user = await supabase.auth.getUser();
  const userId = user.data.user?.id;
  const mensaje = document.getElementById('graficoMensaje');
  if (!userId || !mensaje) return;

  const [registrosResult, categoriasResult] = await Promise.all([
    supabase.from('registros').select('tiempo_minutos, categoria_id').eq('user_id', userId).gte('fecha', rango.desde).lte('fecha', rango.hasta),
    supabase.from('categorias').select('id, nombre, color').eq('user_id', userId).order('nombre')
  ]);

  const error = registrosResult.error || categoriasResult.error;
  if (error) {
    mensaje.innerHTML = `<p style="color:red;">❌ ${escapar(error.message)}</p>`;
    return;
  }

  const categoriasMap = new Map((categoriasResult.data ?? []).map((c: any) => [String(c.id), c]));
  const porCategoria = new Map<string, number>();

  (registrosResult.data ?? []).forEach((r: any) => {
    const categoria = categoriasMap.get(String(r.categoria_id));
    const nombre = categoria?.nombre || 'Sin categoría';
    porCategoria.set(nombre, (porCategoria.get(nombre) || 0) + Number(r.tiempo_minutos || 0));
  });

  const filas = [...porCategoria.entries()].sort((a, b) => b[1] - a[1]);

  // Cada categoría conserva su color configurado en Supabase.
  // No usamos colores automáticos de Chart.js: así el mismo color
  // representa siempre la misma categoría en EÓN.
  const colores = filas.map(([nombre]) => {
    const categoria = [...categoriasMap.values()].find((c: any) => String(c.nombre || '') === nombre);
    const color = String(categoria?.color ?? '').trim();
    return /^#[0-9a-fA-F]{3,8}$/.test(color) ? color : '#808080';
  });
  const total = filas.reduce((suma, [, minutos]) => suma + minutos, 0);

  mensaje.innerHTML = total
    ? `<p>Total del período: <strong>${formatearTiempo(total)}</strong></p>`
    : '<p>No hay horas registradas en este período.</p>';

  const detalle = document.getElementById('graficoDetalle');
  if (detalle && filas.length) {
    detalle.innerHTML = `<table><thead><tr><th>Categoría</th><th>Tiempo</th></tr></thead><tbody>${filas.map(([nombre, minutos]) => `<tr><td>${escapar(nombre)}</td><td>${formatearTiempo(minutos)}</td></tr>`).join('')}</tbody></table>`;
  }

  const canvas = document.getElementById('graficoCategorias') as HTMLCanvasElement | null;
  if (!canvas || !filas.length) return;

  if (typeof Chart === 'undefined') {
    mensaje.innerHTML += '<p style="color:red;">❌ No se pudo cargar el motor del gráfico.</p>';
    return;
  }

  new Chart(canvas, {
    type: 'pie',
    data: {
      labels: filas.map(([nombre]) => nombre),
      datasets: [{ data: filas.map(([, minutos]) => minutos), backgroundColor: colores, borderColor: colores, borderWidth: 1 }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: { position: 'bottom' },
        tooltip: {
          callbacks: {
            label: (context: any) => {
              const minutos = Number(context.raw || 0);
              const porcentaje = total ? ((minutos / total) * 100).toFixed(1) : '0.0';
              return ` ${formatearTiempo(minutos)} (${porcentaje}%)`;
            }
          }
        }
      }
    }
  });
}
