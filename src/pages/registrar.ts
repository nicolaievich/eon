import { supabase } from '../lib/supabase';

// Estado para proyectos, categorías y clientes.
let proyectos: any[] = [];
let categorias: any[] = [];
let clientes: any[] = [];

// Valores predeterminados configurados por el usuario.
let defaultProyectoId: number | null = null;
let defaultClienteId: number | null = null;

// Valores de respaldo para instalaciones sin configuración guardada.
const DEFAULT_PROYECTO = 'Hermanos Calmels';
const DEFAULT_CLIENTE = 'Hermanos Calmels';

// EÓN trabaja con precisión de minuto para guardar y analizar.
// El timer mide segundos internamente para mostrar el avance en vivo.
let minutosTranscurridos = 0;
let segundosTimer = 0;
let timerInterval: number | null = null;
let timerCorriendo = false;
let ultimoTick = 0;

function fechaLocalISO(): string {
  const ahora = new Date();
  const año = ahora.getFullYear();
  const mes = String(ahora.getMonth() + 1).padStart(2, '0');
  const dia = String(ahora.getDate()).padStart(2, '0');
  return `${año}-${mes}-${dia}`;
}

function formatearTiempo(minutos: number): string {
  const total = Math.max(0, Math.floor(Number(minutos) || 0));
  const horas = Math.floor(total / 60);
  const mins = total % 60;
  return `${String(horas).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
}

function formatearSegundos(segundos: number): string {
  return `:${String(Math.max(0, segundos % 60)).padStart(2, '0')}`;
}

function convertirAMinutos(valor: string): number | null {
  const match = valor.trim().match(/^(\d+):(\d{2})$/);
  if (!match) return null;
  const horas = Number(match[1]);
  const minutos = Number(match[2]);
  if (!Number.isInteger(horas) || !Number.isInteger(minutos) || minutos > 59) return null;
  return horas * 60 + minutos;
}

// Los colores vienen de configuración y se leen directamente desde Supabase.
function colorCategoria(color: unknown): string {
  const valor = String(color ?? '').trim();
  return /^#[0-9a-fA-F]{3,8}$/.test(valor) ? valor : '#808080';
}

function actualizarVisualTimer() {
  const input = document.getElementById('tiempo') as HTMLInputElement | null;
  const segundos = document.getElementById('timerSegundos');
  if (!input || !segundos) return;
  input.value = formatearTiempo(minutosTranscurridos);
  segundos.textContent = timerCorriendo ? formatearSegundos(segundosTimer) : '';
}

function actualizarColorCategoria() {
  const categoria = document.getElementById('categoria') as HTMLInputElement | null;
  const indicador = document.getElementById('categoriaColor');
  const texto = document.getElementById('categoriaPickerText');
  if (!categoria || !indicador || !texto) return;
  const categoriaSeleccionada = categorias.find(c => String(c.id) === categoria.value);
  indicador.style.backgroundColor = categoriaSeleccionada ? colorCategoria(categoriaSeleccionada.color) : 'transparent';
  texto.textContent = categoriaSeleccionada ? categoriaSeleccionada.nombre : 'Seleccionar categoría';
}

function cerrarSelectorCategoria() {
  const menu = document.getElementById('categoriaPickerOptions');
  const boton = document.getElementById('categoriaPickerButton');
  if (menu) menu.hidden = true;
  if (boton) boton.setAttribute('aria-expanded', 'false');
}

function alternarSelectorCategoria() {
  const menu = document.getElementById('categoriaPickerOptions');
  const boton = document.getElementById('categoriaPickerButton');
  if (!menu || !boton) return;
  menu.hidden = !menu.hidden;
  boton.setAttribute('aria-expanded', String(!menu.hidden));
}

function seleccionarCategoria(id: string) {
  const categoria = document.getElementById('categoria') as HTMLInputElement | null;
  if (!categoria) return;
  categoria.value = id;
  actualizarColorCategoria();
  cerrarSelectorCategoria();
}

function limpiarFormularioDespuesDeGuardar() {
  const fecha = document.getElementById('fecha') as HTMLInputElement | null;
  const proyecto = document.getElementById('proyecto') as HTMLSelectElement | null;
  const categoria = document.getElementById('categoria') as HTMLInputElement | null;
  const cliente = document.getElementById('cliente') as HTMLSelectElement | null;
  const tiempo = document.getElementById('tiempo') as HTMLInputElement | null;
  const detalle = document.getElementById('detalle') as HTMLTextAreaElement | null;
  const segundos = document.getElementById('timerSegundos');
  const timerBtn = document.getElementById('timerBtn') as HTMLButtonElement | null;

  detenerTimer();
  minutosTranscurridos = 0;
  segundosTimer = 0;
  if (fecha) fecha.value = fechaLocalISO();
  if (proyecto) proyecto.value = defaultProyectoId !== null ? String(defaultProyectoId) : '';
  if (categoria) categoria.value = '';
  if (cliente) cliente.value = defaultClienteId !== null ? String(defaultClienteId) : '';
  if (tiempo) tiempo.value = '00:00';
  if (detalle) detalle.value = '';
  if (segundos) segundos.textContent = '';
  if (timerBtn) {
    timerBtn.textContent = '▶ Iniciar';
    timerBtn.className = 'secondary';
  }
  actualizarColorCategoria();
}

export async function renderRegistrar(container: HTMLElement) {
  await cargarDatos();
  await cargarDefaults();
  detenerTimer();
  minutosTranscurridos = 0;
  segundosTimer = 0;

  container.innerHTML = `
    <article>
      <h2>📋 Registrar tiempo</h2>
      <form id="registroForm">
        <label>
          Fecha *
          <input type="date" id="fecha" value="${fechaLocalISO()}" required>
        </label>

        <label>
          Proyecto
          <select id="proyecto">
            <option value="">Sin proyecto</option>
            ${proyectos.map(p => `
              <option value="${p.id}" ${defaultProyectoId === p.id ? 'selected' : ''}>
                ${escapeHtml(p.nombre)}
              </option>
            `).join('')}
          </select>
        </label>

        <label>
          Categoría *
          <div id="categoriaPicker" style="position:relative;">
            <input type="hidden" id="categoria" value="">
            <button type="button" id="categoriaPickerButton" class="secondary" aria-haspopup="listbox" aria-expanded="false" style="width:100%;display:flex;align-items:center;gap:0.5rem;text-align:left;margin:0;">
              <span id="categoriaColor" aria-hidden="true" style="display:inline-block;width:0.9rem;height:0.9rem;border-radius:50%;flex:0 0 0.9rem;border:1px solid var(--pico-muted-border-color);background:transparent;"></span>
              <span id="categoriaPickerText" style="flex:1;">Seleccionar categoría</span>
              <span aria-hidden="true">▾</span>
            </button>
            <div id="categoriaPickerOptions" role="listbox" hidden style="position:absolute;z-index:20;left:0;right:0;top:calc(100% + 0.25rem);background:white;color:black;border:1px solid var(--pico-muted-border-color);border-radius:var(--pico-border-radius);padding:0.25rem;box-shadow:var(--pico-box-shadow);max-height:16rem;overflow:auto;">
              ${categorias.map(c => `
                <button type="button" class="categoriaOpcion" data-categoria-id="${c.id}" role="option" style="width:100%;display:flex;align-items:center;gap:0.5rem;margin:0;padding:0.55rem 0.65rem;border:0;background:white;color:black;text-align:left;">
                  <span aria-hidden="true" style="display:inline-block;width:0.8rem;height:0.8rem;border-radius:50%;flex:0 0 0.8rem;background:${colorCategoria(c.color)};border:1px solid var(--pico-muted-border-color);"></span>
                  <span style="color:black;">${escapeHtml(c.nombre)}</span>
                </button>
              `).join('')}
            </div>
          </div>
        </label>

        <label>
          Cliente
          <select id="cliente">
            <option value="">Sin cliente</option>
            ${clientes.map(c => `
              <option value="${c.id}" ${defaultClienteId === c.id ? 'selected' : ''}>
                ${escapeHtml(c.nombre)}
              </option>
            `).join('')}
          </select>
        </label>

        <label>
          Tiempo * (HH:MM)
          <div style="display: flex; gap: 0.5rem; align-items: center;">
            <div style="display: flex; align-items: center; flex: 1; min-width: 0;">
              <input type="text" id="tiempo" placeholder="01:30" value="00:00" required style="flex: 1; min-width: 0;">
              <span id="timerSegundos" aria-hidden="true" style="margin-left: 0.25rem; color: var(--pico-muted-color); font-variant-numeric: tabular-nums;"></span>
            </div>
            <button type="button" id="timerBtn" class="secondary">▶ Iniciar</button>
            <button type="button" id="resetBtn" class="contrast">↺</button>
          </div>
        </label>

        <label>
          Detalle
          <textarea id="detalle" rows="3" placeholder="¿Qué hiciste? (opcional)"></textarea>
        </label>
        <button type="submit">💾 Guardar registro</button>
      </form>
      <div id="mensaje" style="margin-top: 1rem;"></div>
    </article>
  `;

  document.getElementById('registroForm')?.addEventListener('submit', handleGuardar);
  document.getElementById('timerBtn')?.addEventListener('click', handleTimer);
  document.getElementById('resetBtn')?.addEventListener('click', handleReset);
  document.getElementById('categoriaPickerButton')?.addEventListener('click', alternarSelectorCategoria);
  document.querySelectorAll('.categoriaOpcion').forEach(opcion => {
    opcion.addEventListener('click', () => seleccionarCategoria((opcion as HTMLElement).dataset.categoriaId ?? ''));
  });
  actualizarColorCategoria();
}

async function cargarDatos() {
  const user = await supabase.auth.getUser();
  const userId = user.data.user?.id;
  if (!userId) return;

  const { data: proyectosData } = await supabase.from('proyectos').select('*').eq('user_id', userId).eq('activo', true).order('nombre');
  proyectos = proyectosData ?? [];
  const { data: categoriasData } = await supabase.from('categorias').select('*').eq('user_id', userId).order('nombre');
  categorias = categoriasData ?? [];
  const { data: clientesData } = await supabase.from('clientes').select('*').eq('user_id', userId).order('nombre');
  clientes = clientesData ?? [];
}

async function cargarDefaults() {
  const user = await supabase.auth.getUser();
  const userId = user.data.user?.id;
  defaultProyectoId = null;
  defaultClienteId = null;
  if (!userId) return;

  const { data, error } = await supabase.from('configuracion').select('*').eq('user_id', userId).single();
  if (data && !error) {
    if (data.proyecto_id && proyectos.some(p => p.id === data.proyecto_id)) defaultProyectoId = data.proyecto_id;
    if (data.cliente_id && clientes.some(c => c.id === data.cliente_id)) defaultClienteId = data.cliente_id;
  } else {
    const proyectoFallback = proyectos.find(p => p.nombre === DEFAULT_PROYECTO);
    if (proyectoFallback) defaultProyectoId = proyectoFallback.id;
    const clienteFallback = clientes.find(c => c.nombre === DEFAULT_CLIENTE);
    if (clienteFallback) defaultClienteId = clienteFallback.id;
  }
}

async function handleGuardar(e: Event) {
  e.preventDefault();
  const fecha = (document.getElementById('fecha') as HTMLInputElement).value;
  const proyectoId = (document.getElementById('proyecto') as HTMLSelectElement).value;
  const categoriaId = (document.getElementById('categoria') as HTMLInputElement).value;
  const clienteId = (document.getElementById('cliente') as HTMLSelectElement).value;
  const tiempoStr = (document.getElementById('tiempo') as HTMLInputElement).value;
  const detalle = (document.getElementById('detalle') as HTMLTextAreaElement).value;
  const mensaje = document.getElementById('mensaje');
  if (!mensaje) return;
  if (!fecha) { mensaje.innerHTML = '<p style="color: red;">❌ La fecha es obligatoria</p>'; return; }
  if (!categoriaId) { mensaje.innerHTML = '<p style="color: red;">❌ La categoría es obligatoria</p>'; return; }
  const tiempoMinutos = convertirAMinutos(tiempoStr);
  if (tiempoMinutos === null) { mensaje.innerHTML = '<p style="color: red;">❌ Formato de tiempo inválido. Usá HH:MM (por ejemplo, 01:30)</p>'; return; }
  const user = await supabase.auth.getUser();
  const userId = user.data.user?.id;
  if (!userId) { mensaje.innerHTML = '<p style="color: red;">❌ No estás autenticado</p>'; return; }
  const { error } = await supabase.from('registros').insert({ fecha, proyecto_id: proyectoId || null, categoria_id: parseInt(categoriaId), cliente_id: clienteId || null, tiempo_minutos: tiempoMinutos, detalle: detalle || null, user_id: userId });
  if (error) { mensaje.innerHTML = `<p style="color: red;">❌ Error: ${escapeHtml(error.message)}</p>`; return; }
  mensaje.innerHTML = '<p style="color: green;">✅ Registro guardado correctamente</p>';
  limpiarFormularioDespuesDeGuardar();
}

function handleTimer() {
  const btn = document.getElementById('timerBtn') as HTMLButtonElement;
  const input = document.getElementById('tiempo') as HTMLInputElement;
  if (!btn || !input) return;
  if (timerCorriendo) {
    detenerTimer(); btn.textContent = '▶ Iniciar'; btn.className = 'secondary'; actualizarVisualTimer(); return;
  }
  const valorActual = convertirAMinutos(input.value);
  if (valorActual !== null) minutosTranscurridos = valorActual;
  segundosTimer = minutosTranscurridos * 60;
  ultimoTick = Date.now(); timerCorriendo = true;
  btn.textContent = '⏹ Detener'; btn.className = 'primary'; actualizarVisualTimer();
  timerInterval = window.setInterval(() => {
    const ahora = Date.now();
    const transcurridos = Math.floor((ahora - ultimoTick) / 1000);
    if (transcurridos > 0) {
      ultimoTick += transcurridos * 1000; segundosTimer += transcurridos;
      const nuevosMinutos = Math.floor(segundosTimer / 60);
      if (nuevosMinutos !== minutosTranscurridos) minutosTranscurridos = nuevosMinutos;
      actualizarVisualTimer();
    }
  }, 250);
}

function detenerTimer() {
  if (timerInterval !== null) { clearInterval(timerInterval); timerInterval = null; }
  timerCorriendo = false;
}

function handleReset() {
  const input = document.getElementById('tiempo') as HTMLInputElement;
  const btn = document.getElementById('timerBtn') as HTMLButtonElement;
  if (!input || !btn) return;
  detenerTimer(); minutosTranscurridos = 0; segundosTimer = 0; input.value = '00:00';
  const segundos = document.getElementById('timerSegundos');
  if (segundos) segundos.textContent = '';
  btn.textContent = '▶ Iniciar'; btn.className = 'secondary';
}

function escapeHtml(str: string): string {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}