import { supabase } from '../lib/supabase';

let registros: any[] = [];
let busqueda = '';
let ordenCampo = 'fecha';
let ordenAscendente = false;
let fechaDesde = '';
let fechaHasta = '';

export async function renderRegistros(container: HTMLElement) {
  container.innerHTML = `
    <article>
      <h2>📋 Ver registros</h2>

      <div style="display: grid; grid-template-columns: minmax(180px, 1fr) auto auto; gap: 0.75rem; align-items: end;">
        <label>
          Buscar
          <input type="search" id="buscarRegistros" placeholder="Buscar..." value="${busqueda}">
        </label>
        <label>
          Desde
          <input type="date" id="fechaDesde" value="${fechaDesde}">
        </label>
        <label>
          Hasta
          <input type="date" id="fechaHasta" value="${fechaHasta}">
        </label>
      </div>

      <div style="overflow-x: auto; margin-top: 1rem;">
        <table>
          <thead>
            <tr>
              <th><button type="button" class="secondary outline ordenar" data-campo="fecha">Fecha ↕</button></th>
              <th><button type="button" class="secondary outline ordenar" data-campo="proyecto">Proyecto ↕</button></th>
              <th><button type="button" class="secondary outline ordenar" data-campo="categoria">Categoría ↕</button></th>
              <th><button type="button" class="secondary outline ordenar" data-campo="cliente">Cliente ↕</button></th>
              <th><button type="button" class="secondary outline ordenar" data-campo="tiempo">Tiempo ↕</button></th>
              <th><button type="button" class="secondary outline ordenar" data-campo="detalle">Detalle ↕</button></th>
            </tr>
          </thead>
          <tbody id="registrosBody">
            <tr><td colspan="6">Cargando...</td></tr>
          </tbody>
        </table>
      </div>

      <div id="registrosResumen" style="margin-top: 1rem;"></div>
    </article>
  `;

  document.getElementById('buscarRegistros')?.addEventListener('input', (e) => {
    busqueda = (e.target as HTMLInputElement).value;
    mostrarRegistros();
  });
  document.getElementById('fechaDesde')?.addEventListener('change', (e) => {
    fechaDesde = (e.target as HTMLInputElement).value;
    cargarRegistros();
  });
  document.getElementById('fechaHasta')?.addEventListener('change', (e) => {
    fechaHasta = (e.target as HTMLInputElement).value;
    cargarRegistros();
  });

  document.querySelectorAll('.ordenar').forEach((boton) => {
    boton.addEventListener('click', () => {
      const campo = (boton as HTMLElement).dataset.campo || 'fecha';
      if (ordenCampo === campo) ordenAscendente = !ordenAscendente;
      else {
        ordenCampo = campo;
        ordenAscendente = true;
      }
      mostrarRegistros();
    });
  });

  establecerPeriodoPorDefecto();
  await cargarRegistros();
}

function establecerPeriodoPorDefecto() {
  if (fechaDesde || fechaHasta) return;
  const hoy = new Date().toISOString().split('T')[0];
  fechaDesde = hoy;
  fechaHasta = hoy;
  const desde = document.getElementById('fechaDesde') as HTMLInputElement | null;
  const hasta = document.getElementById('fechaHasta') as HTMLInputElement | null;
  if (desde) desde.value = hoy;
  if (hasta) hasta.value = hoy;
}

async function cargarRegistros() {
  const user = await supabase.auth.getUser();
  const userId = user.data.user?.id;
  const body = document.getElementById('registrosBody');
  if (!userId || !body) return;

  let query = supabase
    .from('registros')
    .select(`
      id,
      fecha,
      tiempo_minutos,
      detalle,
      proyecto:proyectos(nombre),
      categoria:categorias(nombre),
      cliente:clientes(nombre)
    `)
    .eq('user_id', userId);

  if (fechaDesde) query = query.gte('fecha', fechaDesde);
  if (fechaHasta) query = query.lte('fecha', fechaHasta);

  const { data, error } = await query.order('fecha', { ascending: false });

  if (error) {
    body.innerHTML = `<tr><td colspan="6" style="color: red;">❌ Error: ${error.message}</td></tr>`;
    return;
  }

  registros = data ?? [];
  mostrarRegistros();
}

function mostrarRegistros() {
  const body = document.getElementById('registrosBody');
  const resumen = document.getElementById('registrosResumen');
  if (!body || !resumen) return;

  const termino = busqueda.trim().toLowerCase();
  let filtrados = registros.filter((r) => {
    if (!termino) return true;
    const texto = [
      r.fecha,
      r.proyecto?.nombre,
      r.categoria?.nombre,
      r.cliente?.nombre,
      formatearTiempo(r.tiempo_minutos),
      r.detalle
    ].filter(Boolean).join(' ').toLowerCase();
    return texto.includes(termino);
  });

  filtrados.sort((a, b) => {
    const valorA = valorOrden(a, ordenCampo);
    const valorB = valorOrden(b, ordenCampo);
    const comparacion = typeof valorA === 'number' && typeof valorB === 'number'
      ? valorA - valorB
      : String(valorA).localeCompare(String(valorB), 'es', { numeric: true, sensitivity: 'base' });
    return ordenAscendente ? comparacion : -comparacion;
  });

  if (!filtrados.length) {
    body.innerHTML = '<tr><td colspan="6">No hay registros para mostrar.</td></tr>';
  } else {
    body.innerHTML = filtrados.map((r) => `
      <tr>
        <td>${r.fecha || ''}</td>
        <td>${escapar(r.proyecto?.nombre || '—')}</td>
        <td>${escapar(r.categoria?.nombre || '—')}</td>
        <td>${escapar(r.cliente?.nombre || '—')}</td>
        <td>${formatearTiempo(r.tiempo_minutos)}</td>
        <td>${escapar(r.detalle || '')}</td>
      </tr>
    `).join('');
  }

  const totalMinutos = filtrados.reduce((total, r) => total + Number(r.tiempo_minutos || 0), 0);
  resumen.innerHTML = `<small>${filtrados.length} registro${filtrados.length === 1 ? '' : 's'} · Total: <strong>${formatearTiempo(totalMinutos)}</strong></small>`;
}

function valorOrden(registro: any, campo: string): string | number {
  switch (campo) {
    case 'fecha': return registro.fecha || '';
    case 'proyecto': return registro.proyecto?.nombre || '';
    case 'categoria': return registro.categoria?.nombre || '';
    case 'cliente': return registro.cliente?.nombre || '';
    case 'tiempo': return Number(registro.tiempo_minutos || 0);
    case 'detalle': return registro.detalle || '';
    default: return '';
  }
}

function formatearTiempo(minutos: number) {
  const totalSegundos = Math.round(Number(minutos || 0) * 60);
  const horas = Math.floor(totalSegundos / 3600);
  const mins = Math.floor((totalSegundos % 3600) / 60);
  const segundos = totalSegundos % 60;
  return `${String(horas).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(segundos).padStart(2, '0')}`;
}

function escapar(valor: string) {
  return valor
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
