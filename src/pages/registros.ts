import { supabase } from '../lib/supabase';

// Estado local de la pantalla. Se conserva mientras la aplicación permanece abierta
// para no perder filtros y ordenamiento al volver a esta vista.
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

// Renderiza la pantalla "Ver registros" y conecta sus controles.
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
        <button type="button" id="exportarSvg" class="secondary">⇩ Exportar SVG</button>
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

  document.getElementById('exportarSvg')?.addEventListener('click', exportarSVG);

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

// Aplica búsqueda y ordenamiento, y actualiza tabla y resumen.
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
      : String(valorA).localeCompare(String(valorB), 'es', {
          numeric: true,
          sensitivity: 'base'
        });

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

  const totalMinutos = filtrados.reduce(
    (total, r) => total + Number(r.tiempo_minutos || 0),
    0
  );

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

// Exporta exactamente los registros actualmente visibles, respetando búsqueda y orden.
function exportarSVG() {
  const visibles = obtenerRegistrosVisibles();
  const totalMinutos = visibles.reduce(
    (total, r) => total + Number(r.tiempo_minutos || 0),
    0
  );

  const margen = 40;
  const ancho = 1100;
  const altoFila = 30;
  const altoCabecera = 110;
  const alto = altoCabecera + (visibles.length + 1) * altoFila + 40;

  const esc = (valor: string) => escapar(valor);
  const tituloPeriodo = fechaDesde && fechaHasta
    ? `${formatearFecha(fechaDesde)} al ${formatearFecha(fechaHasta)}`
    : 'Período seleccionado';

  const columnas = [
    { nombre: 'Fecha', x: margen, ancho: 110 },
    { nombre: 'Proyecto', x: margen + 110, ancho: 180 },
    { nombre: 'Categoría', x: margen + 290, ancho: 180 },
    { nombre: 'Cliente', x: margen + 470, ancho: 180 },
    { nombre: 'Tiempo', x: margen + 650, ancho: 100 },
    { nombre: 'Detalle', x: margen + 750, ancho: 310 }
  ];

  const filas = visibles.map((r, indice) => {
    const y = altoCabecera + indice * altoFila;
    const valores = [
      formatearFecha(r.fecha || ''),
      r.proyecto?.nombre || '—',
      r.categoria?.nombre || '—',
      r.cliente?.nombre || '—',
      formatearTiempo(r.tiempo_minutos),
      r.detalle || ''
    ];

    const fondo = indice % 2 === 0 ? '#f5f5f5' : '#ffffff';
    return `
      <rect x="${margen}" y="${y}" width="${ancho - margen * 2}" height="${altoFila}" fill="${fondo}"/>
      ${valores.map((valor, i) => `<text x="${columnas[i].x + 6}" y="${y + 20}" font-family="Arial, sans-serif" font-size="13">${esc(String(valor))}</text>`).join('')}
    `;
  }).join('');

  const cabecera = columnas.map((columna) => `
    <text x="${columna.x + 6}" y="${altoCabecera + 20}" font-family="Arial, sans-serif" font-size="13" font-weight="bold">${columna.nombre}</text>
  `).join('');

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${ancho}" height="${alto}" viewBox="0 0 ${ancho} ${alto}">
  <rect width="100%" height="100%" fill="#ffffff"/>
  <text x="${margen}" y="38" font-family="Arial, sans-serif" font-size="24" font-weight="bold">EÓN — Registros</text>
  <text x="${margen}" y="65" font-family="Arial, sans-serif" font-size="14">Período: ${esc(tituloPeriodo)} · ${visibles.length} registros · Total: ${formatearTiempo(totalMinutos)}</text>
  <line x1="${margen}" y1="${altoCabecera}" x2="${ancho - margen}" y2="${altoCabecera}" stroke="#777"/>
  ${cabecera}
  ${filas}
  <text x="${margen}" y="${alto - 15}" font-family="Arial, sans-serif" font-size="11">Exportado desde EÓN</text>
</svg>`;

  const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const enlace = document.createElement('a');
  enlace.href = url;
  enlace.download = `eon-registros-${fechaDesde || 'periodo'}-${fechaHasta || 'periodo'}.svg`;
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
