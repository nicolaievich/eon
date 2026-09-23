/**
 * ============================================================
 * EÓN — REGISTRAR TIEMPO (registrar.ts)
 * ============================================================
 *
 * Pantalla donde se carga un nuevo registro de tiempo.
 * También contiene el temporizador integrado.
 *
 * ÍNDICE DE FUNCIONES
 * ------------------------------------------------------------
 * - renderRegistrar() → dibuja el formulario
 * - cargarDatos() → carga proyectos, categorías y clientes
 * - cargarDefaults() → obtiene los valores predeterminados
 * - handleGuardar() → valida y guarda el registro
 * - handleTimer() → inicia/detiene el temporizador
 * - detenerTimer() → detiene el intervalo
 * - handleReset() → reinicia el temporizador
 * - escapeHtml() → protege mensajes HTML
 *
 * REGLA IMPORTANTE
 * ------------------------------------------------------------
 * El tiempo se almacena en Supabase como minutos (entero).
 * La interfaz lo muestra como HH:MM.
 * ============================================================
 */

import { supabase } from '../lib/supabase';

let proyectos: any[] = [];
let categorias: any[] = [];
let clientes: any[] = [];
let defaultProyectoId: number | null = null;
let defaultClienteId: number | null = null;
const DEFAULT_PROYECTO = 'Hermanos Calmels';
const DEFAULT_CLIENTE = 'Hermanos Calmels';
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

function formatearSegundos(segundos: number): string {
  return `:${String(Math.max(0, segundos % 60)).padStart(2, '0')}`;
}

function colorCategoria(color: unknown): string {
  const valor = String(color ?? '').trim();
  return /^#[0-9a-fA-F]{3,8}$/.test(valor) ? valor : '#808080';
}

/**
 * Buscador reutilizable para proyectos y clientes.
 *
 * En 1.8, al recibir el foco seleccionamos todo el contenido actual.
 * Esto permite tocar/posicionarse sobre el campo y comenzar a escribir
 * inmediatamente para reemplazar el valor anterior, sin tener que
 * borrar manualmente el texto predeterminado.
 *
 * Seguimos usando <datalist> para conservar el buscador nativo y liviano.
 * La apertura visual automática de un datalist depende del navegador,
 * especialmente en móviles; la selección automática del texto, en cambio,
 * sí queda bajo control de EÓN.
 */
function configurarBuscador(inputId: string, hiddenId: string, items: any[], valorInicial: number | null) {
  const input = document.getElementById(inputId) as HTMLInputElement | null;
  const hidden = document.getElementById(hiddenId) as HTMLInputElement | null;
  if (!input || !hidden) return;

  const inicial = items.find(item => item.id === valorInicial);
  input.value = inicial?.nombre ?? '';
  hidden.value = inicial ? String(inicial.id) : '';

  // Al enfocar, todo el texto queda seleccionado para poder reemplazarlo
  // con una sola acción de teclado/tacto.
  input.addEventListener('focus', () => {
    requestAnimationFrame(() => {
      input.focus();
      input.select();
    });
  });

  input.addEventListener('input', () => {
    const texto = input.value.trim().toLowerCase();
    const exacto = items.find(item => String(item.nombre).trim().toLowerCase() === texto);
    hidden.value = exacto ? String(exacto.id) : '';
  });

  input.addEventListener('change', () => {
    const texto = input.value.trim().toLowerCase();
    const exacto = items.find(item => String(item.nombre).trim().toLowerCase() === texto);
    hidden.value = exacto ? String(exacto.id) : '';
    if (texto && !exacto) input.value = '';
  });
}

function actualizarVisualTimer() {
  const segundos = document.getElementById('timerSegundos');
  if (!segundos) return;
  escribirTiempoEnCampos(minutosTranscurridos);
  segundos.textContent = timerCorriendo ? formatearSegundos(segundosTimer) : '';
}

function leerTiempoDesdeCampos(): number | null {
  const horas = document.getElementById('tiempoHoras') as HTMLInputElement | null;
  const minutos = document.getElementById('tiempoMinutos') as HTMLInputElement | null;
  if (!horas || !minutos) return null;
  const h = Number(horas.value);
  const m = Number(minutos.value);
  if (!Number.isInteger(h) || h < 0 || !Number.isInteger(m) || m < 0 || m > 59) return null;
  return h * 60 + m;
}

function escribirTiempoEnCampos(totalMinutos: number) {
  const total = Math.max(0, Math.floor(Number(totalMinutos) || 0));
  const horas = document.getElementById('tiempoHoras') as HTMLInputElement | null;
  const minutos = document.getElementById('tiempoMinutos') as HTMLInputElement | null;
  if (!horas || !minutos) return;
  horas.value = String(Math.floor(total / 60)).padStart(2, '0');
  minutos.value = String(total % 60).padStart(2, '0');
}

function configurarCampoTiempo() {
  const horas = document.getElementById('tiempoHoras') as HTMLInputElement | null;
  const minutos = document.getElementById('tiempoMinutos') as HTMLInputElement | null;
  if (!horas || !minutos) return;
  [horas, minutos].forEach((input) => {
    input.addEventListener('input', () => {
      input.value = input.value.replace(/\\D/g, '').slice(0, 2);
      if (input === minutos && input.value !== '') input.value = String(Math.min(Number(input.value), 59));
    });
    input.addEventListener('dblclick', () => input.select());
    input.addEventListener('blur', () => {
      if (input.value === '') input.value = '00';
      const max = input === minutos ? 59 : 99;
      input.value = String(Math.min(Number(input.value) || 0, max)).padStart(2, '0');
    });
  });
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
  const proyecto = document.getElementById('proyecto') as HTMLInputElement | null;
  const categoria = document.getElementById('categoria') as HTMLInputElement | null;
  const cliente = document.getElementById('cliente') as HTMLInputElement | null;
  const horas = document.getElementById('tiempoHoras') as HTMLInputElement | null;
  const minutos = document.getElementById('tiempoMinutos') as HTMLInputElement | null;
  const detalle = document.getElementById('detalle') as HTMLTextAreaElement | null;
  const segundos = document.getElementById('timerSegundos');
  const timerBtn = document.getElementById('timerBtn') as HTMLButtonElement | null;
  detenerTimer();
  minutosTranscurridos = 0;
  segundosTimer = 0;
  if (fecha) fecha.value = fechaLocalISO();
  if (proyecto) proyecto.value = defaultProyectoId !== null ? String(defaultProyectoId) : '';
  const proyectoBuscar = document.getElementById('proyectoBuscar') as HTMLInputElement | null;
  if (proyectoBuscar) proyectoBuscar.value = proyectos.find(p => p.id === defaultProyectoId)?.nombre ?? '';
  if (categoria) categoria.value = '';
  if (cliente) cliente.value = defaultClienteId !== null ? String(defaultClienteId) : '';
  const clienteBuscar = document.getElementById('clienteBuscar') as HTMLInputElement | null;
  if (clienteBuscar) clienteBuscar.value = clientes.find(c => c.id === defaultClienteId)?.nombre ?? '';
  if (horas) horas.value = '00';
  if (minutos) minutos.value = '00';
  if (detalle) detalle.value = '';
  if (segundos) segundos.textContent = '';
  if (timerBtn) { timerBtn.textContent = '▶ Iniciar'; timerBtn.className = 'secondary'; }
  actualizarColorCategoria();
}

export async function renderRegistrar(container: HTMLElement) {
  await cargarDatos();
  await cargarDefaults();
  detenerTimer();
  minutosTranscurridos = 0;
  segundosTimer = 0;

  container.innerHTML = `
    <style>
      /*
       * 1.8 — Corrección móvil del bloque de tiempo.
       *
       * En pantallas angostas, los botones del temporizador no deben
       * obligar al campo HH:MM a compartir una sola línea. Antes podían
       * quedar comprimidos o desbordar horizontalmente, dejando el botón
       * parcialmente fuera de la pantalla. Permitimos que el bloque se
       * reorganice y hacemos que los controles ocupen el ancho disponible.
       */
      .eon-tiempo-controles{display:flex;gap:.5rem;align-items:center;flex-wrap:wrap;width:100%;}
      .eon-tiempo-entrada{display:flex;align-items:center;flex:1 1 12rem;min-width:0;}
      .eon-tiempo-boton{flex:0 1 auto;min-width:7rem;}
      .eon-tiempo-reset{flex:0 0 auto;}
      @media (max-width:480px){
        .eon-tiempo-entrada{flex:1 1 100%;}
        .eon-tiempo-boton{flex:1 1 auto;}
        .eon-tiempo-reset{flex:0 0 3rem;}
      }
    </style>
    <article>
      <h2>📋 Registrar tiempo</h2>
      <form id="registroForm">
        <label>
          Fecha *
          <input type="date" id="fecha" value="${fechaLocalISO()}" required>
        </label>
        <label>
          Proyecto
          <input type="hidden" id="proyecto" value="">
          <input type="search" id="proyectoBuscar" list="proyectosOpciones" placeholder="Buscar proyecto..." autocomplete="off">
          <datalist id="proyectosOpciones">
            <option value="Sin proyecto"></option>
            ${proyectos.map(p => `<option value="${escapeHtml(p.nombre)}"></option>`).join('')}
          </datalist>
        </label>
        <label>
          Categoría *
          <div id="categoriaPicker" style="position:relative;">
            <input type="hidden" id="categoria" value="">
            <button type="button" id="categoriaPickerButton" class="secondary" aria-haspopup="listbox" aria-expanded="false" style="width:100%;display:flex;align-items:center;gap:0.5rem;text-align:left;margin:0;">
              <span id="categoriaColor" aria-hidden="true" style="display:inline-block;width:0.9rem;height:0.9rem;border-radius:50%;flex:0 0 0.9rem;border:1px solid var(--pico-muted-border-color);background:transparent;"></span>
              <span id="categoriaPickerText" style="flex:1;">Seleccionar categoría</span><span aria-hidden="true">▾</span>
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
          <input type="hidden" id="cliente" value="">
          <input type="search" id="clienteBuscar" list="clientesOpciones" placeholder="Buscar cliente..." autocomplete="off">
          <datalist id="clientesOpciones">
            <option value="Sin cliente"></option>
            ${clientes.map(c => `<option value="${escapeHtml(c.nombre)}"></option>`).join('')}
          </datalist>
        </label>
        <label>
          Tiempo * (HH:MM)
          <div class="eon-tiempo-controles">
            <div class="eon-tiempo-entrada">
              <div style="display:flex;align-items:center;gap:0;flex:1;min-width:0;border:1px solid var(--pico-form-element-border-color);border-radius:var(--pico-border-radius);background:var(--pico-form-element-background-color);padding:0 .65rem;">
                <input type="text" id="tiempoHoras" inputmode="numeric" maxlength="2" aria-label="Horas" value="00" required style="border:0;box-shadow:none;padding:.65rem .1rem;width:2.5rem;text-align:center;font-variant-numeric:tabular-nums;margin:0;background:transparent;">
                <span aria-hidden="true" style="font-weight:600;user-select:none;">:</span>
                <input type="text" id="tiempoMinutos" inputmode="numeric" maxlength="2" aria-label="Minutos" value="00" required style="border:0;box-shadow:none;padding:.65rem .1rem;width:2.5rem;text-align:center;font-variant-numeric:tabular-nums;margin:0;background:transparent;">
              </div>
              <span id="timerSegundos" aria-hidden="true" style="margin-left:.25rem;color:var(--pico-muted-color);font-variant-numeric:tabular-nums;"></span>
            </div>
            <button type="button" id="timerBtn" class="secondary eon-tiempo-boton">▶ Iniciar</button>
            <button type="button" id="resetBtn" class="contrast eon-tiempo-reset">↺</button>
          </div>
        </label>
        <label>
          Detalle
          <textarea id="detalle" rows="3" placeholder="¿Qué hiciste? (opcional)"></textarea>
        </label>
        <button type="submit">💾 Guardar registro</button>
      </form>
      <div id="mensaje" style="margin-top:1rem;"></div>
    </article>
  `;

  document.getElementById('registroForm')?.addEventListener('submit', handleGuardar);
  document.getElementById('timerBtn')?.addEventListener('click', handleTimer);
  document.getElementById('resetBtn')?.addEventListener('click', handleReset);
  configurarBuscador('proyectoBuscar', 'proyecto', proyectos, defaultProyectoId);
  configurarCampoTiempo();
  configurarBuscador('clienteBuscar', 'cliente', clientes, defaultClienteId);
  document.getElementById('categoriaPickerButton')?.addEventListener('click', alternarSelectorCategoria);
  document.querySelectorAll('.categoriaOpcion').forEach(opcion => opcion.addEventListener('click', () => seleccionarCategoria((opcion as HTMLElement).dataset.categoriaId ?? '')));
  actualizarColorCategoria();
}

// ------------------------------------------------------------
// 02. CARGA DE CATÁLOGOS
// ------------------------------------------------------------
async function cargarDatos() {
  const user = await supabase.auth.getUser();
  const userId = user.data.user?.id;
  if (!userId) return;

  const { data: proyectosData } = await supabase.from('proyectos').select('*').eq('user_id', userId).eq('activo', true).order('nombre');
  proyectos = proyectosData ?? [];

  const { data: categoriasData } = await supabase.from('categorias').select('*').eq('user_id', userId).order('nombre');
  categorias = categoriasData ?? [];

  /*
   * 1.8 — Orden de categorías por frecuencia de uso.
   *
   * No modificamos la tabla categorias ni su orden permanente. Solo
   * calculamos, para esta pantalla, cuántos registros históricos tiene
   * cada categoría y ordenamos la lista en memoria. Así la configuración
   * de categorías sigue siendo independiente del orden de Registrar.
   *
   * Los empates se resuelven alfabéticamente para que el selector sea
   * estable. Las categorías sin registros quedan naturalmente al final.
   */
  const { data: registrosData } = await supabase
    .from('registros')
    .select('categoria_id')
    .eq('user_id', userId);

  const frecuencia = new Map<number, number>();
  for (const registro of registrosData ?? []) {
    if (registro.categoria_id !== null && registro.categoria_id !== undefined) {
      const id = Number(registro.categoria_id);
      frecuencia.set(id, (frecuencia.get(id) ?? 0) + 1);
    }
  }

  categorias.sort((a, b) => {
    const usoA = frecuencia.get(Number(a.id)) ?? 0;
    const usoB = frecuencia.get(Number(b.id)) ?? 0;
    if (usoA !== usoB) return usoB - usoA;
    return String(a.nombre).localeCompare(String(b.nombre), 'es', { sensitivity: 'base' });
  });

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
  const proyectoId = (document.getElementById('proyecto') as HTMLInputElement).value;
  const categoriaId = (document.getElementById('categoria') as HTMLInputElement).value;
  const clienteId = (document.getElementById('cliente') as HTMLInputElement).value;
  const tiempoMinutos = leerTiempoDesdeCampos();
  const detalle = (document.getElementById('detalle') as HTMLTextAreaElement).value;
  const mensaje = document.getElementById('mensaje');
  if (!mensaje) return;
  if (!fecha) { mensaje.innerHTML = '<p style="color: red;">❌ La fecha es obligatoria</p>'; return; }
  if (!categoriaId) { mensaje.innerHTML = '<p style="color: red;">❌ La categoría es obligatoria</p>'; return; }
  if (tiempoMinutos === null) { mensaje.innerHTML = '<p style="color: red;">❌ Tiempo inválido. Los minutos deben estar entre 00 y 59.</p>'; return; }
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
  if (!btn) return;
  if (timerCorriendo) { detenerTimer(); btn.textContent = '▶ Iniciar'; btn.className = 'secondary eon-tiempo-boton'; actualizarVisualTimer(); return; }
  const valorActual = leerTiempoDesdeCampos();
  if (valorActual !== null) minutosTranscurridos = valorActual;
  segundosTimer = minutosTranscurridos * 60;
  ultimoTick = Date.now(); timerCorriendo = true;
  btn.textContent = '⏹ Detener'; btn.className = 'primary eon-tiempo-boton'; actualizarVisualTimer();
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
  const btn = document.getElementById('timerBtn') as HTMLButtonElement;
  if (!btn) return;
  detenerTimer(); minutosTranscurridos = 0; segundosTimer = 0; escribirTiempoEnCampos(0);
  const segundos = document.getElementById('timerSegundos');
  if (segundos) segundos.textContent = '';
  btn.textContent = '▶ Iniciar'; btn.className = 'secondary eon-tiempo-boton';
}

function escapeHtml(str: string): string {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}