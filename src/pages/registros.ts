import { supabase } from '../lib/supabase';

let registros: any[] = [];
let busqueda = '';
let ordenCampo = 'fecha';
let ordenAscendente = false;
let fechaDesde = '';
let fechaHasta = '';

function formatearTiempo(minutos: number): string {
  const total = Math.max(0, Math.floor(Number(minutos) || 0));
  const horas = Math.floor(total / 60);
  const mins = total % 60;
  return `${String(horas).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
}

// Fecha de base de datos YYYY-MM-DD -> formato visual DD-MM-YYYY.
function formatearFecha(fecha: string): string {
  if (!fecha) return '';
  const partes = fecha.split('-');
  if (partes.length !== 3) return fecha;
  return `${partes[2]}-${partes[1]}-${partes[0]}`;
}

export async function renderRegistros(container: HTMLElement) {
  container.innerHTML = `
    <article>
      <h2>📋 Ver registros</h2>

      <div style="display: grid; grid-template-columns: minmax(180px, 1fr) auto auto; gap: 0.75rem; align-items: end;">
        <label>
          Buscar
          <input type="search" id="buscarRegistros" placeholder="Buscar..." value="${escapar(busqueda)}">
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

      <div style="display: flex; gap: 0.5rem; flex-wrap: wrap; margin-top: 0.75rem;">
        <button type="button" id="exportarCsv" class="secondary">⇩ Exportar CSV</button>
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

  document.getElementById('exportarCsv')?.addEventListener('click', exportarCSV);

  establecerPeriodoPorDefecto();
  await cargarRegistros();
}

function establecerPeriodoPorDefecto() {
  if (fechaDesde || fechaHasta) return;
  const hoy = fechaLocalISO();
  fechaDesde = hoy;
  fechaHasta = hoy;

  const desde = document.getElementById('fechaDesde') as HTMLInputElement | null;
  const hasta = document.getElementById('fechaHasta') as HTMLInputElement | null;
  if (desde) desde.value = hoy;
  if (hasta) hasta.value = hoy;
}

function fechaLocalISO(): string {
  const ahora = new Date();
  const año = ahora.getFullYear();
  const mes = String(ahora.getMonth() + 1).padStart(2, '0');
  const dia = String(ahora.getDate()).padStart(2, '0');
  return `${año}-${mes}-${dia}`;
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
    body.innerHTML = `<tr><td colspan="6" style="color: red;">❌ Error: ${escapar(error.message)}</td></tr>`;
    return;
  }

  registros = data ?? [];
  mostrarRegistros();
}

function obtenerRegistrosVisibles(): any[] {
  const termino = busqueda.trim().toLowerCase();

  const filtrados = registros.filter((r) => {
    if (!termino) return true;
    const texto = [
      r.fecha,
      formatearFecha(r.fecha),
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

  return filtrados;
}

function mostrarRegistros() {
  const body = document.getElementById('registrosBody');
  const resumen = document.getElementById('registrosResumen');
  if (!body || !resumen) return;

  const filtrados = obtenerRegistrosVisibles();

  if (!filtrados.length) {
    body.innerHTML = '<tr><td colspan="6">No hay registros para mostrar.</td></tr>';
  } else {
    body.innerHTML = filtrados.map((r) => `
      <tr>
        <td>${escapar(formatearFecha(r.fecha || ''))}</td>
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

// Escapa una celda para CSV y evita romper columnas por comas, comillas o saltos de línea.
function escaparCSV(valor: string): string {
  const texto = String(valor ?? '');
  return `"${texto.replace(/"/g, '""')}"`;
}

// Exporta exactamente lo que se está viendo: período, búsqueda y orden actuales.
// El BOM UTF-8 mejora la compatibilidad con Excel y Google Sheets, especialmente con tildes.
function exportarCSV() {
  const visibles = obtenerRegistrosVisibles();
  const encabezados = ['Fecha', 'Proyecto', 'Categoría', 'Cliente', 'Tiempo', 'Detalle'];

  const filas = visibles.map((r) => [
    formatearFecha(r.fecha || ''),
    r.proyecto?.nombre || '',
    r.categoria?.nombre || '',
    r.cliente?.nombre || '',
    formatearTiempo(r.tiempo_minutos),
    r.detalle || ''
  ]);

  const csv = [encabezados, ...filas]
    .map(fila => fila.map(escaparCSV).join(';'))
    .join('\r\n');

  const bom = '\uFEFF';
  const blob = new Blob([bom + csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const enlace = document.createElement('a');
  enlace.href = url;
  enlace.download = `eon-registros-${fechaDesde || 'periodo'}-${fechaHasta || 'periodo'}.csv`;
  document.body.appendChild(enlace);
  enlace.click();
  enlace.remove();
  URL.revokeObjectURL(url);
}

function escapar(valor: string) {
  return valor
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
