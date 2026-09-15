import { supabase } from '../lib/supabase';

// Estado local de la pantalla. Se conserva mientras la aplicación permanece abierta
// para no perder filtros y ordenamiento al volver a esta vista.
let registros: any[] = [];
let busqueda = '';
let ordenCampo = 'fecha';
let ordenAscendente = false;
let fechaDesde = '';
let fechaHasta = '';

// Renderiza la pantalla "Ver registros" y conecta todos sus controles.
export async function renderRegistros(container: HTMLElement) {
  // Construimos primero la estructura visual. Los datos se cargan después desde Supabase.
  container.innerHTML = `
    <article>
      <h2>📋 Ver registros</h2>

      <!-- Buscador y rango de fechas. El buscador trabaja en vivo sobre los registros cargados. -->
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

      <!-- La tabla se envuelve horizontalmente para conservar usabilidad en pantallas chicas. -->
      <div style="overflow-x: auto; margin-top: 1rem;">
        <table>
          <thead>
            <tr>
              <!-- Cada encabezado permite ordenar por ese campo. -->
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

      <!-- Aquí mostramos cantidad de registros y tiempo total del resultado filtrado. -->
      <div id="registrosResumen" style="margin-top: 1rem;"></div>
    </article>
  `;

  // El buscador no consulta nuevamente la base de datos: filtra en memoria para que sea inmediato.
  document.getElementById('buscarRegistros')?.addEventListener('input', (e) => {
    busqueda = (e.target as HTMLInputElement).value;
    mostrarRegistros();
  });

  // Cambiar "Desde" vuelve a consultar Supabase con el nuevo rango.
  document.getElementById('fechaDesde')?.addEventListener('change', (e) => {
    fechaDesde = (e.target as HTMLInputElement).value;
    cargarRegistros();
  });

  // Cambiar "Hasta" también vuelve a consultar Supabase con el nuevo rango.
  document.getElementById('fechaHasta')?.addEventListener('change', (e) => {
    fechaHasta = (e.target as HTMLInputElement).value;
    cargarRegistros();
  });

  // Conectamos los botones de ordenamiento de las seis columnas.
  document.querySelectorAll('.ordenar').forEach((boton) => {
    boton.addEventListener('click', () => {
      const campo = (boton as HTMLElement).dataset.campo || 'fecha';

      // Si pulsamos el mismo campo, invertimos ASC/DESC.
      // Si cambiamos de campo, comenzamos en ascendente.
      if (ordenCampo === campo) ordenAscendente = !ordenAscendente;
      else {
        ordenCampo = campo;
        ordenAscendente = true;
      }

      mostrarRegistros();
    });
  });

  // En la primera entrada a la pantalla, el período es "hoy".
  establecerPeriodoPorDefecto();

  // Finalmente consultamos los registros correspondientes al usuario autenticado.
  await cargarRegistros();
}

// Define hoy como período inicial solamente si todavía no existe un filtro guardado.
function establecerPeriodoPorDefecto() {
  if (fechaDesde || fechaHasta) return;

  // Se usa el formato YYYY-MM-DD requerido por los inputs type="date" y por Supabase.
  const hoy = new Date().toISOString().split('T')[0];
  fechaDesde = hoy;
  fechaHasta = hoy;

  const desde = document.getElementById('fechaDesde') as HTMLInputElement | null;
  const hasta = document.getElementById('fechaHasta') as HTMLInputElement | null;
  if (desde) desde.value = hoy;
  if (hasta) hasta.value = hoy;
}

// Consulta la base de datos. El filtro user_id es fundamental: cada usuario debe
// poder recuperar únicamente sus propios registros, además de las políticas RLS de Supabase.
async function cargarRegistros() {
  const user = await supabase.auth.getUser();
  const userId = user.data.user?.id;
  const body = document.getElementById('registrosBody');

  // Si no hay sesión, no intentamos consultar registros.
  if (!userId || !body) return;

  // Pedimos solamente los campos necesarios para esta pantalla.
  // Las relaciones traen los nombres de proyecto, categoría y cliente.
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

  // El rango de fechas se aplica en la base de datos, antes de traer los resultados.
  if (fechaDesde) query = query.gte('fecha', fechaDesde);
  if (fechaHasta) query = query.lte('fecha', fechaHasta);

  // El orden inicial solicitado por EÓN es el más reciente primero.
  const { data, error } = await query.order('fecha', { ascending: false });

  if (error) {
    // Mostramos el mensaje de Supabase para facilitar diagnóstico durante el desarrollo.
    body.innerHTML = `<tr><td colspan="6" style="color: red;">❌ Error: ${escapar(error.message)}</td></tr>`;
    return;
  }

  registros = data ?? [];
  mostrarRegistros();
}

// Aplica la búsqueda, ordena el resultado y actualiza tabla + resumen.
function mostrarRegistros() {
  const body = document.getElementById('registrosBody');
  const resumen = document.getElementById('registrosResumen');
  if (!body || !resumen) return;

  const termino = busqueda.trim().toLowerCase();

  // La búsqueda es deliberadamente amplia: permite encontrar texto en cualquiera
  // de las columnas visibles, incluyendo el tiempo formateado.
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

  // Ordenamiento local para evitar nuevas consultas a la base de datos al pulsar una columna.
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
    // Escapamos los textos provenientes de la base de datos antes de insertarlos como HTML.
    // Esto evita que un detalle o nombre guardado por un usuario pueda interpretarse como HTML.
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

  // El resumen se calcula sobre lo que el usuario está viendo, es decir,
  // después de aplicar búsqueda y ordenamiento.
  const totalMinutos = filtrados.reduce(
    (total, r) => total + Number(r.tiempo_minutos || 0),
    0
  );

  resumen.innerHTML = `<small>${filtrados.length} registro${filtrados.length === 1 ? '' : 's'} · Total: <strong>${formatearTiempo(totalMinutos)}</strong></small>`;
}

// Devuelve el valor comparable correspondiente a la columna seleccionada.
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

// Convierte los minutos almacenados por EÓN a una representación HH:MM:SS.
// Actualmente la base guarda minutos, por lo que los segundos normalmente serán 00.
function formatearTiempo(minutos: number) {
  const totalSegundos = Math.round(Number(minutos || 0) * 60);
  const horas = Math.floor(totalSegundos / 3600);
  const mins = Math.floor((totalSegundos % 3600) / 60);
  const segundos = totalSegundos % 60;

  return `${String(horas).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(segundos).padStart(2, '0')}`;
}

// Escapa caracteres especiales antes de insertar valores de la base de datos en innerHTML.
// Es una pequeña defensa contra XSS en el contenido mostrado por esta pantalla.
function escapar(valor: string) {
  return valor
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
