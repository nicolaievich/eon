import { supabase } from '../lib/supabase';

// Estado local de la pantalla. Se conserva mientras la aplicación permanece abierta
// para no perder filtros y ordenamiento al volver a esta vista.
let registros: any[] = [];
let busqueda = '';
let ordenCampo = 'fecha';
let ordenAscendente = false;
let fechaDesde = '';
let fechaHasta = '';

// Convierte minutos almacenados por EÓN al formato visible HH:MM.
function formatearTiempo(minutos: number): string {
  const total = Math.max(0, Math.floor(Number(minutos) || 0));
  const horas = Math.floor(total / 60);
  const mins = total % 60;
  return `${String(horas).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
}

// Renderiza la pantalla "Ver registros" y conecta sus controles.
export async function renderRegistros(container: HTMLElement) {
  // Construimos primero la estructura visual; luego cargamos los datos.
  container.innerHTML = `
    <article>
      <h2>📋 Ver registros</h2>

      <!-- Buscador y rango de fechas. El buscador filtra en vivo los registros cargados. -->
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

      <!-- La tabla permite desplazamiento horizontal en pantallas pequeñas. -->
      <div style="overflow-x: auto; margin-top: 1rem;">
        <table>
          <thead>
            <tr>
              <!-- Cada encabezado permite ordenar por esa columna. -->
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

      <!-- Resumen del resultado actualmente visible. -->
      <div id="registrosResumen" style="margin-top: 1rem;"></div>
    </article>
  `;

  // El buscador trabaja en memoria para responder inmediatamente al escribir.
  document.getElementById('buscarRegistros')?.addEventListener('input', (e) => {
    busqueda = (e.target as HTMLInputElement).value;
    mostrarRegistros();
  });

  // Los filtros de fecha sí vuelven a consultar la base de datos.
  document.getElementById('fechaDesde')?.addEventListener('change', (e) => {
    fechaDesde = (e.target as HTMLInputElement).value;
    cargarRegistros();
  });

  document.getElementById('fechaHasta')?.addEventListener('change', (e) => {
    fechaHasta = (e.target as HTMLInputElement).value;
    cargarRegistros();
  });

  // Ordenamiento local de las seis columnas visibles.
  document.querySelectorAll('.ordenar').forEach((boton) => {
    boton.addEventListener('click', () => {
      const campo = (boton as HTMLElement).dataset.campo || 'fecha';

      // Repetir la misma columna invierte el sentido. Una columna nueva comienza ASC.
      if (ordenCampo === campo) ordenAscendente = !ordenAscendente;
      else {
        ordenCampo = campo;
        ordenAscendente = true;
      }

      mostrarRegistros();
    });
  });

  // La primera entrada sin filtros previos muestra únicamente el día actual.
  establecerPeriodoPorDefecto();
  await cargarRegistros();
}

// Define hoy como período inicial si todavía no existe un filtro guardado.
function establecerPeriodoPorDefecto() {
  if (fechaDesde || fechaHasta) return;

  // Usamos fecha local, no UTC, para que "hoy" coincida con la fecha del usuario.
  const hoy = fechaLocalISO();
  fechaDesde = hoy;
  fechaHasta = hoy;

  const desde = document.getElementById('fechaDesde') as HTMLInputElement | null;
  const hasta = document.getElementById('fechaHasta') as HTMLInputElement | null;
  if (desde) desde.value = hoy;
  if (hasta) hasta.value = hoy;
}

// Devuelve YYYY-MM-DD usando la fecha local del navegador.
function fechaLocalISO(): string {
  const ahora = new Date();
  const año = ahora.getFullYear();
  const mes = String(ahora.getMonth() + 1).padStart(2, '0');
  const dia = String(ahora.getDate()).padStart(2, '0');
  return `${año}-${mes}-${dia}`;
}

// Consulta solamente los registros pertenecientes al usuario autenticado.
async function cargarRegistros() {
  const user = await supabase.auth.getUser();
  const userId = user.data.user?.id;
  const body = document.getElementById('registrosBody');
  if (!userId || !body) return;

  // Solicitamos únicamente los datos necesarios para la tabla y sus relaciones.
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

  // El rango se filtra en Supabase para no descargar datos innecesarios.
  if (fechaDesde) query = query.gte('fecha', fechaDesde);
  if (fechaHasta) query = query.lte('fecha', fechaHasta);

  // El orden inicial es el solicitado: más reciente primero.
  const { data, error } = await query.order('fecha', { ascending: false });

  if (error) {
    body.innerHTML = `<tr><td colspan="6" style="color: red;">❌ Error: ${escapar(error.message)}</td></tr>`;
    return;
  }

  registros = data ?? [];
  mostrarRegistros();
}

// Aplica búsqueda y ordenamiento, y actualiza tabla y resumen.
function mostrarRegistros() {
  const body = document.getElementById('registrosBody');
  const resumen = document.getElementById('registrosResumen');
  if (!body || !resumen) return;

  const termino = busqueda.trim().toLowerCase();

  // La búsqueda recorre todas las columnas visibles, incluyendo HH:MM.
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

  // Ordenamiento local para no volver a consultar Supabase al pulsar una columna.
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

  if (!filtrados.length) {
    body.innerHTML = '<tr><td colspan="6">No hay registros para mostrar.</td></tr>';
  } else {
    // Escapamos valores de la base antes de insertarlos en HTML.
    body.innerHTML = filtrados.map((r) => `
      <tr>
        <td>${escapar(r.fecha || '')}</td>
        <td>${escapar(r.proyecto?.nombre || '—')}</td>
        <td>${escapar(r.categoria?.nombre || '—')}</td>
        <td>${escapar(r.cliente?.nombre || '—')}</td>
        <td>${formatearTiempo(r.tiempo_minutos)}</td>
        <td>${escapar(r.detalle || '')}</td>
      </tr>
    `).join('');
  }

  // El total también se expresa en HH:MM, coherente con la entrada de tiempo.
  const totalMinutos = filtrados.reduce(
    (total, r) => total + Number(r.tiempo_minutos || 0),
    0
  );

  resumen.innerHTML = `<small>${filtrados.length} registro${filtrados.length === 1 ? '' : 's'} · Total: <strong>${formatearTiempo(totalMinutos)}</strong></small>`;
}

// Obtiene el valor comparable de una columna.
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

// Escape básico de texto antes de usarlo dentro de innerHTML.
function escapar(valor: string) {
  return valor
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
