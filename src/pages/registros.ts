/**
 * ============================================================
 * EÓN — REGISTROS (registros.ts)
 * ============================================================
 *
 * Pantalla de consulta, resumen, edición y exportación de
 * registros de tiempo.
 *
 * ÍNDICE DE FUNCIONES
 * ------------------------------------------------------------
 * 01. formatearTiempo()       → minutos a HH:MM
 * 02. convertirAMinutos()     → HH:MM a minutos
 * 03. formatearFecha()        → YYYY-MM-DD a DD-MM-YYYY
 * 04. fechaLocalISO()         → fecha local segura
 * 05. escapar()               → protección de HTML
 * 06. obtenerNombreRelacion() → nombre de proyecto/categoría/cliente
 * 07. renderRegistros()       → construye la pantalla
 * 08. establecerPeriodoPorDefecto()
 * 09. obtenerUsuarioId()
 * 10. cargarCatalogos()
 * 11. cargarRegistros()       → datos de la tabla
 * 12. cargarResumen()         → HOY / SEMANA / MES
 * 13. obtenerRegistrosVisibles()
 * 14. mostrarRegistros()
 * 15. valorOrden()
 * 16. abrirEditor()
 * 17. cerrarEditor()
 * 18. guardarEdicion()
 * 19. exportarCSV()
 *
 * IMPORTANTE
 * ------------------------------------------------------------
 * El resumen NO depende de los filtros de la tabla.
 * cargarResumen() realiza sus propias consultas a Supabase.
 * ============================================================
 */

import { supabase } from '../lib/supabase';

// Registros actualmente cargados para el período seleccionado.
let registros: any[] = [];
let busqueda = '';
let ordenCampo = 'fecha';
let ordenAscendente = false;
let fechaDesde = '';
let fechaHasta = '';

// Catálogos usados por el editor y también por el resumen por categoría.
let proyectos: any[] = [];
let categorias: any[] = [];
let clientes: any[] = [];

function formatearTiempo(minutos: number): string {
  const total = Math.max(0, Math.floor(Number(minutos) || 0));
  const horas = Math.floor(total / 60);
  const mins = total % 60;
  return `${String(horas).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
}

function convertirAMinutos(valor: string): number | null {
  const match = valor.trim().match(/^(\d+):(\d{2})$/);
  if (!match) return null;
  const horas = Number(match[1]);
  const minutos = Number(match[2]);
  if (!Number.isInteger(horas) || !Number.isInteger(minutos) || minutos > 59) return null;
  return horas * 60 + minutos;
}

function formatearFecha(fecha: string): string {
  if (!fecha) return '';
  const partes = fecha.split('-');
  if (partes.length !== 3) return fecha;
  return `${partes[2]}-${partes[1]}-${partes[0]}`;
}

function fechaLocalISO(fecha = new Date()): string {
  const año = fecha.getFullYear();
  const mes = String(fecha.getMonth() + 1).padStart(2, '0');
  const dia = String(fecha.getDate()).padStart(2, '0');
  return `${año}-${mes}-${dia}`;
}

function escapar(valor: string): string {
  return String(valor ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function obtenerNombreRelacion(relacion: any): string {
  if (Array.isArray(relacion)) return relacion[0]?.nombre || '';
  return relacion?.nombre || '';
}

// ------------------------------------------------------------
// 07. CONSTRUCCIÓN DE LA PANTALLA
// ------------------------------------------------------------
// Dibuja el HTML y conecta eventos. Al final carga catálogos,
// registros y resumen en ese orden.
// ------------------------------------------------------------
export async function renderRegistros(container: HTMLElement) {
  container.innerHTML = `
    <article>
      <h2>📊 Resumen y registros</h2>

      <!--
        PRUEBA DE RENDERIZADO DEL RESUMEN:
        Estos tres valores están deliberadamente FUERA del bloque
        de gráficos/detalle. Usamos IDs nuevos para comprobar si
        el problema estaba en la ubicación o en algún componente
        que pudiera estar interfiriendo con el resumen anterior.
      -->
      <section id="resumenHorasTop" aria-label="Totales de horas" style="margin:1rem 0;">
        <div style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:.75rem;">
          <div style="padding:.8rem 1rem;border:2px solid #999;border-radius:.5rem;text-align:center;">
            <strong>HOY</strong>
            <div id="totalHorasHoy" style="font-size:1.5rem;font-weight:bold;margin-top:.25rem;">CARGANDO...</div>
          </div>
          <div style="padding:.8rem 1rem;border:2px solid #999;border-radius:.5rem;text-align:center;">
            <strong>ESTA SEMANA</strong>
            <div id="totalHorasSemana" style="font-size:1.5rem;font-weight:bold;margin-top:.25rem;">CARGANDO...</div>
          </div>
          <div style="padding:.8rem 1rem;border:2px solid #999;border-radius:.5rem;text-align:center;">
            <strong>ESTE MES</strong>
            <div id="totalHorasMes" style="font-size:1.5rem;font-weight:bold;margin-top:.25rem;">CARGANDO...</div>
          </div>
        </div>
      </section>

      <section id="resumenHoras" aria-label="Resumen de horas">
        <div style="display:grid; grid-template-columns:repeat(2, minmax(0, 1fr)); gap:0.75rem;">
          <div style="grid-column:1 / -1; display:flex; justify-content:space-between; align-items:center; gap:1rem; padding:0.75rem 1rem; border:1px solid var(--pico-muted-border-color, #ccc); border-radius:var(--pico-border-radius, 0.5rem);">
            <strong>HOY</strong>
            <strong id="horasDia">—</strong>
          </div>
          <div style="display:flex; justify-content:space-between; align-items:center; gap:1rem; padding:0.75rem 1rem; border:1px solid var(--pico-muted-border-color, #ccc); border-radius:var(--pico-border-radius, 0.5rem);">
            <strong>ESTA SEMANA</strong>
            <strong id="horasSemana">—</strong>
          </div>
          <div style="display:flex; justify-content:space-between; align-items:center; gap:1rem; padding:0.75rem 1rem; border:1px solid var(--pico-muted-border-color, #ccc); border-radius:var(--pico-border-radius, 0.5rem);">
            <strong>ESTE MES</strong>
            <strong id="horasMes">—</strong>
          </div>
        </div>

        <article style="margin-top:0.75rem;">
          <h4>Detalle del mes por categoría</h4>
          <div id="detalleCategorias"><small>Cargando...</small></div>
        </article>
      </section>

      <hr>

      <div style="display: grid; grid-template-columns: minmax(180px, 1fr) auto auto; gap: 0.75rem; align-items: end;">
        <label>Buscar<input type="search" id="buscarRegistros" placeholder="Buscar..." value="${escapar(busqueda)}"></label>
        <label>Desde<input type="date" id="fechaDesde" value="${fechaDesde}"></label>
        <label>Hasta<input type="date" id="fechaHasta" value="${fechaHasta}"></label>
      </div>

      <div style="display: flex; gap: 0.5rem; flex-wrap: wrap; margin-top: 0.75rem;">
        <button type="button" id="exportarCsv" class="secondary">⇩ Exportar CSV</button>
      </div>

      <div style="overflow-x: auto; margin-top: 1rem;">
        <table>
          <thead><tr>
            <th><button type="button" class="secondary outline ordenar" data-campo="fecha">Fecha ↕</button></th>
            <th><button type="button" class="secondary outline ordenar" data-campo="proyecto">Proyecto ↕</button></th>
            <th><button type="button" class="secondary outline ordenar" data-campo="categoria">Categoría ↕</button></th>
            <th><button type="button" class="secondary outline ordenar" data-campo="cliente">Cliente ↕</button></th>
            <th><button type="button" class="secondary outline ordenar" data-campo="tiempo">Tiempo ↕</button></th>
            <th><button type="button" class="secondary outline ordenar" data-campo="detalle">Detalle ↕</button></th>
            <th>Acciones</th>
          </tr></thead>
          <tbody id="registrosBody"><tr><td colspan="7">Cargando...</td></tr></tbody>
        </table>
      </div>
      <div id="registrosResumen" style="margin-top: 1rem;"></div>
    </article>

    <dialog id="editarDialog">
      <article>
        <header><button type="button" id="cerrarEditor" aria-label="Cerrar">×</button><strong>✏️ Editar registro</strong></header>
        <form id="editarForm">
          <input type="hidden" id="editarId">
          <label>Fecha *<input type="date" id="editarFecha" required></label>
          <label>Proyecto<select id="editarProyecto"><option value="">Sin proyecto</option>${proyectos.map(p => `<option value="${escapar(String(p.id))}">${escapar(p.nombre)}</option>`).join('')}</select></label>
          <label>Categoría *<select id="editarCategoria"><option value="">Seleccionar categoría</option>${categorias.map(c => `<option value="${escapar(String(c.id))}">${escapar(c.nombre)}</option>`).join('')}</select></label>
          <label>Cliente<select id="editarCliente"><option value="">Sin cliente</option>${clientes.map(c => `<option value="${escapar(String(c.id))}">${escapar(c.nombre)}</option>`).join('')}</select></label>
          <label>Tiempo * (HH:MM)<input type="text" id="editarTiempo" placeholder="01:30" required></label>
          <label>Detalle<textarea id="editarDetalle" rows="3"></textarea></label>
          <div style="display: flex; gap: 0.5rem;"><button type="submit">💾 Guardar cambios</button><button type="button" id="cancelarEditor" class="secondary">Cancelar</button></div>
        </form>
        <div id="editarMensaje" style="margin-top: 0.75rem;"></div>
      </article>
    </dialog>
  `;

  document.getElementById('buscarRegistros')?.addEventListener('input', (e) => {
    busqueda = (e.target as HTMLInputElement).value;
    mostrarRegistros();
  });
  document.getElementById('fechaDesde')?.addEventListener('change', (e) => { fechaDesde = (e.target as HTMLInputElement).value; cargarRegistros(); });
  document.getElementById('fechaHasta')?.addEventListener('change', (e) => { fechaHasta = (e.target as HTMLInputElement).value; cargarRegistros(); });

  document.querySelectorAll('.ordenar').forEach((boton) => {
    boton.addEventListener('click', () => {
      const campo = (boton as HTMLElement).dataset.campo || 'fecha';
      if (ordenCampo === campo) ordenAscendente = !ordenAscendente;
      else { ordenCampo = campo; ordenAscendente = true; }
      mostrarRegistros();
    });
  });

  document.getElementById('exportarCsv')?.addEventListener('click', exportarCSV);
  document.getElementById('editarForm')?.addEventListener('submit', guardarEdicion);
  document.getElementById('cerrarEditor')?.addEventListener('click', cerrarEditor);
  document.getElementById('cancelarEditor')?.addEventListener('click', cerrarEditor);

  establecerPeriodoPorDefecto();
  await cargarCatalogos();
  await cargarRegistros();
  await cargarResumen();
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

async function obtenerUsuarioId(): Promise<string | null> {
  const user = await supabase.auth.getUser();
  return user.data.user?.id ?? null;
}

async function cargarCatalogos() {
  const userId = await obtenerUsuarioId();
  if (!userId) return;
  const [proyectosResult, categoriasResult, clientesResult] = await Promise.all([
    supabase.from('proyectos').select('*').eq('user_id', userId).order('nombre'),
    supabase.from('categorias').select('*').eq('user_id', userId).order('nombre'),
    supabase.from('clientes').select('*').eq('user_id', userId).order('nombre')
  ]);
  proyectos = proyectosResult.data ?? [];
  categorias = categoriasResult.data ?? [];
  clientes = clientesResult.data ?? [];
  const proyecto = document.getElementById('editarProyecto');
  const categoria = document.getElementById('editarCategoria');
  const cliente = document.getElementById('editarCliente');
  if (proyecto) proyecto.innerHTML = `<option value="">Sin proyecto</option>${proyectos.map(p => `<option value="${escapar(String(p.id))}">${escapar(p.nombre)}</option>`).join('')}`;
  if (categoria) categoria.innerHTML = `<option value="">Seleccionar categoría</option>${categorias.map(c => `<option value="${escapar(String(c.id))}">${escapar(c.nombre)}</option>`).join('')}`;
  if (cliente) cliente.innerHTML = `<option value="">Sin cliente</option>${clientes.map(c => `<option value="${escapar(String(c.id))}">${escapar(c.nombre)}</option>`).join('')}`;
}

// ------------------------------------------------------------
// 11. CARGAR REGISTROS DE LA TABLA
// ------------------------------------------------------------
// Respeta únicamente Desde/Hasta. El buscador y el ordenamiento
// se aplican después, sobre los registros ya cargados.
// ------------------------------------------------------------
async function cargarRegistros() {
  const userId = await obtenerUsuarioId();
  const body = document.getElementById('registrosBody');
  if (!userId || !body) return;
  let query = supabase.from('registros').select(`id, fecha, proyecto_id, categoria_id, cliente_id, tiempo_minutos, detalle, proyecto:proyectos(nombre), categoria:categorias(nombre), cliente:clientes(nombre)`).eq('user_id', userId);
  if (fechaDesde) query = query.gte('fecha', fechaDesde);
  if (fechaHasta) query = query.lte('fecha', fechaHasta);
  const { data, error } = await query.order('fecha', { ascending: false });
  if (error) { body.innerHTML = `<tr><td colspan="7" style="color: red;">❌ Error: ${escapar(error.message)}</td></tr>`; return; }
  registros = data ?? [];
  mostrarRegistros();
}

// Resumen independiente de los filtros de la tabla.
// ------------------------------------------------------------
// 12. RESUMEN DE HORAS
// ------------------------------------------------------------
// Calcula tres totales independientes:
//   HOY         → fecha actual
//   ESTA SEMANA → lunes hasta hoy
//   ESTE MES    → día 1 hasta hoy
//
// ATENCIÓN: estas consultas NO dependen de los filtros de la tabla.
// El objetivo es que el resumen siempre represente el período actual.
// ------------------------------------------------------------
async function cargarResumen() {
  const userId = await obtenerUsuarioId();
  if (!userId) return;

  const hoy = new Date();
  const hoyISO = fechaLocalISO(hoy);
  const mesInicio = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
  const diaSemana = hoy.getDay();
  const diasDesdeLunes = diaSemana === 0 ? 6 : diaSemana - 1;
  const semanaInicio = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() - diasDesdeLunes);
  const semanaISO = fechaLocalISO(semanaInicio);
  const mesISO = fechaLocalISO(mesInicio);

  // Tres consultas independientes: hoy, semana y mes.
  // Así el resumen no depende de los filtros ni de los registros cargados en la tabla.
  const [hoyResult, semanaResult, mesResult] = await Promise.all([
    supabase
      .from('registros')
      .select('tiempo_minutos')
      .eq('user_id', userId)
      .eq('fecha', hoyISO),
    supabase
      .from('registros')
      .select('tiempo_minutos')
      .eq('user_id', userId)
      .gte('fecha', semanaISO)
      .lte('fecha', hoyISO),
    supabase
      .from('registros')
      .select('tiempo_minutos, categoria_id')
      .eq('user_id', userId)
      .gte('fecha', mesISO)
      .lte('fecha', hoyISO)
  ]);

  const error = hoyResult.error || semanaResult.error || mesResult.error;
  if (error) {
    console.error('EÓN: error al cargar resumen:', error);
    ['horasDia', 'horasSemana', 'horasMes'].forEach(id => {
      const elemento = document.getElementById(id);
      if (elemento) elemento.textContent = '—';
    });
    const detalle = document.getElementById('detalleCategorias');
    if (detalle) detalle.innerHTML = `<small style="color: red;">❌ ${escapar(error.message)}</small>`;
    return;
  }

  const sumar = (lista: any[] | null | undefined) =>
    (lista ?? []).reduce((total, registro) => total + Number(registro.tiempo_minutos || 0), 0);

  const totalHoy = sumar(hoyResult.data);
  const totalSemana = sumar(semanaResult.data);
  const totalMes = sumar(mesResult.data);

  const horasDia = document.getElementById('horasDia');
  const horasSemana = document.getElementById('horasSemana');
  const horasMes = document.getElementById('horasMes');
  // Los nuevos campos están arriba de todo y sirven además como
  // prueba aislada de que el cálculo y el renderizado funcionan.
  const totalHorasHoy = document.getElementById('totalHorasHoy');
  const totalHorasSemana = document.getElementById('totalHorasSemana');
  const totalHorasMes = document.getElementById('totalHorasMes');
  if (totalHorasHoy) totalHorasHoy.textContent = formatearTiempo(totalHoy);
  if (totalHorasSemana) totalHorasSemana.textContent = formatearTiempo(totalSemana);
  if (totalHorasMes) totalHorasMes.textContent = formatearTiempo(totalMes);

  // Conservamos también los campos del resumen existente.
  if (horasDia) horasDia.textContent = formatearTiempo(totalHoy);
  if (horasSemana) horasSemana.textContent = formatearTiempo(totalSemana);
  if (horasMes) horasMes.textContent = formatearTiempo(totalMes);

  const detalle = document.getElementById('detalleCategorias');
  if (!detalle) return;

  const nombresCategorias = new Map(categorias.map(c => [String(c.id), String(c.nombre || '')]));
  const porCategoria = new Map<string, number>();
  (mesResult.data ?? []).forEach((registro: any) => {
    const nombre = nombresCategorias.get(String(registro.categoria_id)) || 'Sin categoría';
    porCategoria.set(nombre, (porCategoria.get(nombre) || 0) + Number(registro.tiempo_minutos || 0));
  });

  if (!porCategoria.size) {
    detalle.innerHTML = '<small>No hay horas registradas este mes.</small>';
    return;
  }

  const filas = [...porCategoria.entries()].sort((a, b) => b[1] - a[1]);
  detalle.innerHTML = `<table><thead><tr><th>Categoría</th><th>Tiempo</th></tr></thead><tbody>${filas.map(([nombre, minutos]) => `<tr><td>${escapar(nombre)}</td><td>${formatearTiempo(minutos)}</td></tr>`).join('')}</tbody></table>`;
}

// ------------------------------------------------------------
// 13. FILTRADO Y ORDENAMIENTO LOCAL
// ------------------------------------------------------------
// Trabaja sobre 'registros', que son los datos obtenidos de Supabase.
// No vuelve a consultar la base por cada búsqueda o clic de columna.
// ------------------------------------------------------------
function obtenerRegistrosVisibles(): any[] {
  const termino = busqueda.trim().toLowerCase();
  const filtrados = registros.filter((r) => {
    if (!termino) return true;
    const texto = [r.fecha, formatearFecha(r.fecha), r.proyecto?.nombre, r.categoria?.nombre, r.cliente?.nombre, formatearTiempo(r.tiempo_minutos), r.detalle].filter(Boolean).join(' ').toLowerCase();
    return texto.includes(termino);
  });
  filtrados.sort((a, b) => {
    const valorA = valorOrden(a, ordenCampo);
    const valorB = valorOrden(b, ordenCampo);
    const comparacion = typeof valorA === 'number' && typeof valorB === 'number' ? valorA - valorB : String(valorA).localeCompare(String(valorB), 'es', { numeric: true, sensitivity: 'base' });
    return ordenAscendente ? comparacion : -comparacion;
  });
  return filtrados;
}

function mostrarRegistros() {
  const body = document.getElementById('registrosBody');
  const resumen = document.getElementById('registrosResumen');
  if (!body || !resumen) return;
  const filtrados = obtenerRegistrosVisibles();
  if (!filtrados.length) body.innerHTML = '<tr><td colspan="7">No hay registros para mostrar.</td></tr>';
  else {
    body.innerHTML = filtrados.map((r) => `<tr><td>${escapar(formatearFecha(r.fecha || ''))}</td><td>${escapar(obtenerNombreRelacion(r.proyecto) || '—')}</td><td>${escapar(obtenerNombreRelacion(r.categoria) || '—')}</td><td>${escapar(obtenerNombreRelacion(r.cliente) || '—')}</td><td>${formatearTiempo(r.tiempo_minutos)}</td><td>${escapar(r.detalle || '')}</td><td><button type="button" class="secondary outline editarRegistro" data-id="${escapar(String(r.id))}">✏️ Editar</button></td></tr>`).join('');
    document.querySelectorAll('.editarRegistro').forEach((boton) => boton.addEventListener('click', () => abrirEditor((boton as HTMLElement).dataset.id || '')));
  }
  const totalMinutos = filtrados.reduce((total, r) => total + Number(r.tiempo_minutos || 0), 0);
  resumen.innerHTML = `<small>${filtrados.length} registro${filtrados.length === 1 ? '' : 's'} · Total: <strong>${formatearTiempo(totalMinutos)}</strong></small>`;
}

function valorOrden(registro: any, campo: string): string | number {
  switch (campo) {
    case 'fecha': return registro.fecha || '';
    case 'proyecto': return obtenerNombreRelacion(registro.proyecto);
    case 'categoria': return obtenerNombreRelacion(registro.categoria);
    case 'cliente': return obtenerNombreRelacion(registro.cliente);
    case 'tiempo': return Number(registro.tiempo_minutos || 0);
    case 'detalle': return registro.detalle || '';
    default: return '';
  }
}

function abrirEditor(id: string) {
  const registro = registros.find(r => String(r.id) === String(id));
  const dialog = document.getElementById('editarDialog') as HTMLDialogElement | null;
  if (!registro || !dialog) return;
  (document.getElementById('editarId') as HTMLInputElement).value = String(registro.id);
  (document.getElementById('editarFecha') as HTMLInputElement).value = registro.fecha || '';
  (document.getElementById('editarProyecto') as HTMLSelectElement).value = registro.proyecto_id ? String(registro.proyecto_id) : '';
  (document.getElementById('editarCategoria') as HTMLSelectElement).value = registro.categoria_id ? String(registro.categoria_id) : '';
  (document.getElementById('editarCliente') as HTMLSelectElement).value = registro.cliente_id ? String(registro.cliente_id) : '';
  (document.getElementById('editarTiempo') as HTMLInputElement).value = formatearTiempo(registro.tiempo_minutos);
  (document.getElementById('editarDetalle') as HTMLTextAreaElement).value = registro.detalle || '';
  const mensaje = document.getElementById('editarMensaje');
  if (mensaje) mensaje.innerHTML = '';
  dialog.showModal();
}

function cerrarEditor() {
  const dialog = document.getElementById('editarDialog') as HTMLDialogElement | null;
  if (dialog?.open) dialog.close();
}

// ------------------------------------------------------------
// 18. GUARDAR EDICIÓN
// ------------------------------------------------------------
// Actualiza un único registro y exige user_id para no modificar
// registros pertenecientes a otro usuario.
// ------------------------------------------------------------
async function guardarEdicion(e: Event) {
  e.preventDefault();
  const id = (document.getElementById('editarId') as HTMLInputElement).value;
  const fecha = (document.getElementById('editarFecha') as HTMLInputElement).value;
  const proyectoId = (document.getElementById('editarProyecto') as HTMLSelectElement).value;
  const categoriaId = (document.getElementById('editarCategoria') as HTMLSelectElement).value;
  const clienteId = (document.getElementById('editarCliente') as HTMLSelectElement).value;
  const tiempoStr = (document.getElementById('editarTiempo') as HTMLInputElement).value;
  const detalle = (document.getElementById('editarDetalle') as HTMLTextAreaElement).value;
  const mensaje = document.getElementById('editarMensaje');
  if (!mensaje) return;
  if (!fecha) { mensaje.innerHTML = '<p style="color: red;">❌ La fecha es obligatoria</p>'; return; }
  if (!categoriaId) { mensaje.innerHTML = '<p style="color: red;">❌ La categoría es obligatoria</p>'; return; }
  const tiempoMinutos = convertirAMinutos(tiempoStr);
  if (tiempoMinutos === null) { mensaje.innerHTML = '<p style="color: red;">❌ Formato de tiempo inválido. Usá HH:MM (por ejemplo, 01:30)</p>'; return; }
  const userId = await obtenerUsuarioId();
  if (!userId) { mensaje.innerHTML = '<p style="color: red;">❌ No estás autenticado</p>'; return; }
  const { error } = await supabase.from('registros').update({ fecha, proyecto_id: proyectoId || null, categoria_id: parseInt(categoriaId), cliente_id: clienteId || null, tiempo_minutos: tiempoMinutos, detalle: detalle || null }).eq('id', id).eq('user_id', userId);
  if (error) { mensaje.innerHTML = `<p style="color: red;">❌ Error: ${escapar(error.message)}</p>`; return; }
  cerrarEditor();
  await cargarRegistros();
  await cargarResumen();
}

function escaparCSV(valor: string): string {
  const texto = String(valor ?? '');
  return `"${texto.replace(/"/g, '""')}"`;
}

function exportarCSV() {
  const visibles = obtenerRegistrosVisibles();
  const encabezados = ['Fecha', 'Proyecto', 'Categoría', 'Cliente', 'Tiempo', 'Detalle'];
  const filas = visibles.map((r) => [formatearFecha(r.fecha || ''), obtenerNombreRelacion(r.proyecto), obtenerNombreRelacion(r.categoria), obtenerNombreRelacion(r.cliente), formatearTiempo(r.tiempo_minutos), r.detalle || '']);
  const csv = [encabezados, ...filas].map(fila => fila.map(escaparCSV).join(';')).join('\r\n');
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