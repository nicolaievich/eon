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

// EÓN trabaja con precisión de minuto. El timer mide segundos internamente,
// pero el usuario ve y guarda únicamente horas y minutos.
let minutosTranscurridos = 0;
let segundosTimer = 0;
let timerInterval: number | null = null;
let timerCorriendo = false;
let ultimoTick = 0;

// Devuelve la fecha LOCAL del navegador en formato YYYY-MM-DD.
// No usamos toISOString(), porque convierte a UTC y cerca de medianoche
// podía mostrar una fecha distinta de la fecha local de Argentina.
function fechaLocalISO(): string {
  const ahora = new Date();
  const año = ahora.getFullYear();
  const mes = String(ahora.getMonth() + 1).padStart(2, '0');
  const dia = String(ahora.getDate()).padStart(2, '0');
  return `${año}-${mes}-${dia}`;
}

// Convierte minutos enteros a HH:MM para mantener un único formato visual.
function formatearTiempo(minutos: number): string {
  const total = Math.max(0, Math.floor(Number(minutos) || 0));
  const horas = Math.floor(total / 60);
  const mins = total % 60;
  return `${String(horas).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
}

// Convierte el formato público HH:MM a minutos enteros.
function convertirAMinutos(valor: string): number | null {
  const match = valor.trim().match(/^(\d+):(\d{2})$/);
  if (!match) return null;

  const horas = Number(match[1]);
  const minutos = Number(match[2]);

  // Las horas pueden superar 99; los minutos siempre deben estar entre 00 y 59.
  if (!Number.isInteger(horas) || !Number.isInteger(minutos) || minutos > 59) return null;

  return horas * 60 + minutos;
}

// Función principal para renderizar el formulario de registro.
export async function renderRegistrar(container: HTMLElement) {
  await cargarDatos();
  await cargarDefaults();

  // Al entrar nuevamente a Registrar, empezamos con el timer detenido y en cero.
  detenerTimer();
  minutosTranscurridos = 0;
  segundosTimer = 0;

  container.innerHTML = `
    <article>
      <h2>📋 Registrar tiempo</h2>

      <form id="registroForm">
        <!-- Fecha del trabajo: utiliza la fecha LOCAL, no UTC. -->
        <label>
          Fecha *
          <input type="date" id="fecha" value="${fechaLocalISO()}" required>
        </label>

        <!-- Proyecto opcional y configurable como valor predeterminado. -->
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

        <!-- Categoría obligatoria para poder analizar el tiempo después. -->
        <label>
          Categoría *
          <select id="categoria" required>
            <option value="">Seleccionar categoría</option>
            ${categorias.map(c => `
              <option value="${c.id}">${escapeHtml(c.nombre)}</option>
            `).join('')}
          </select>
        </label>

        <!-- Cliente opcional y configurable como valor predeterminado. -->
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

        <!--
          Tiempo: desde EÓN 1.1.1 la interfaz utiliza exclusivamente HH:MM.
          El cronómetro mide segundos internamente, pero no los muestra ni los guarda.
        -->
        <label>
          Tiempo * (HH:MM)
          <div style="display: flex; gap: 0.5rem; align-items: center;">
            <input type="text" id="tiempo" placeholder="01:30" value="00:00" required style="flex: 1;">
            <button type="button" id="timerBtn" class="secondary">▶ Iniciar</button>
            <button type="button" id="resetBtn" class="contrast">↺</button>
          </div>
        </label>

        <!-- Detalle opcional de la tarea realizada. -->
        <label>
          Detalle
          <textarea id="detalle" rows="3" placeholder="¿Qué hiciste? (opcional)"></textarea>
        </label>

        <button type="submit">💾 Guardar registro</button>
      </form>

      <div id="mensaje" style="margin-top: 1rem;"></div>
    </article>
  `;

  // Conectamos los eventos del formulario y del timer después de construir el HTML.
  document.getElementById('registroForm')?.addEventListener('submit', handleGuardar);
  document.getElementById('timerBtn')?.addEventListener('click', handleTimer);
  document.getElementById('resetBtn')?.addEventListener('click', handleReset);
}

// ========== CARGAR DATOS DESDE SUPABASE ==========
async function cargarDatos() {
  const user = await supabase.auth.getUser();
  const userId = user.data.user?.id;
  if (!userId) return;

  // Solo los proyectos activos aparecen disponibles para nuevos registros.
  const { data: proyectosData } = await supabase
    .from('proyectos')
    .select('*')
    .eq('user_id', userId)
    .eq('activo', true)
    .order('nombre');
  proyectos = proyectosData ?? [];

  // Las categorías pertenecen al usuario autenticado.
  const { data: categoriasData } = await supabase
    .from('categorias')
    .select('*')
    .eq('user_id', userId)
    .order('nombre');
  categorias = categoriasData ?? [];

  // Los clientes también se limitan al usuario actual.
  const { data: clientesData } = await supabase
    .from('clientes')
    .select('*')
    .eq('user_id', userId)
    .order('nombre');
  clientes = clientesData ?? [];
}

// ========== CARGAR VALORES POR DEFECTO ==========
async function cargarDefaults() {
  const user = await supabase.auth.getUser();
  const userId = user.data.user?.id;

  defaultProyectoId = null;
  defaultClienteId = null;
  if (!userId) return;

  const { data, error } = await supabase
    .from('configuracion')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (data && !error) {
    // Solo aplicamos como predeterminado un proyecto que siga disponible.
    if (data.proyecto_id && proyectos.some(p => p.id === data.proyecto_id)) {
      defaultProyectoId = data.proyecto_id;
    }

    // Solo aplicamos como predeterminado un cliente que siga existiendo.
    if (data.cliente_id && clientes.some(c => c.id === data.cliente_id)) {
      defaultClienteId = data.cliente_id;
    }
  } else {
    // Compatibilidad con configuraciones antiguas que usaban estos nombres como fallback.
    const proyectoFallback = proyectos.find(p => p.nombre === DEFAULT_PROYECTO);
    if (proyectoFallback) defaultProyectoId = proyectoFallback.id;

    const clienteFallback = clientes.find(c => c.nombre === DEFAULT_CLIENTE);
    if (clienteFallback) defaultClienteId = clienteFallback.id;
  }
}

// ========== GUARDAR REGISTRO ==========
async function handleGuardar(e: Event) {
  e.preventDefault();

  const fecha = (document.getElementById('fecha') as HTMLInputElement).value;
  const proyectoId = (document.getElementById('proyecto') as HTMLSelectElement).value;
  const categoriaId = (document.getElementById('categoria') as HTMLSelectElement).value;
  const clienteId = (document.getElementById('cliente') as HTMLSelectElement).value;
  const tiempoStr = (document.getElementById('tiempo') as HTMLInputElement).value;
  const detalle = (document.getElementById('detalle') as HTMLTextAreaElement).value;
  const mensaje = document.getElementById('mensaje');

  if (!mensaje) return;

  if (!fecha) {
    mensaje.innerHTML = '<p style="color: red;">❌ La fecha es obligatoria</p>';
    return;
  }

  if (!categoriaId) {
    mensaje.innerHTML = '<p style="color: red;">❌ La categoría es obligatoria</p>';
    return;
  }

  // A partir de 1.1.1 solo aceptamos HH:MM.
  const tiempoMinutos = convertirAMinutos(tiempoStr);
  if (tiempoMinutos === null) {
    mensaje.innerHTML = '<p style="color: red;">❌ Formato de tiempo inválido. Usá HH:MM (por ejemplo, 01:30)</p>';
    return;
  }

  const user = await supabase.auth.getUser();
  const userId = user.data.user?.id;

  if (!userId) {
    mensaje.innerHTML = '<p style="color: red;">❌ No estás autenticado</p>';
    return;
  }

  // La base mantiene tiempo_minutos como entero: no se guardan segundos.
  const { error } = await supabase
    .from('registros')
    .insert({
      fecha,
      proyecto_id: proyectoId || null,
      categoria_id: parseInt(categoriaId),
      cliente_id: clienteId || null,
      tiempo_minutos: tiempoMinutos,
      detalle: detalle || null,
      user_id: userId
    });

  if (error) {
    mensaje.innerHTML = `<p style="color: red;">❌ Error: ${escapeHtml(error.message)}</p>`;
    return;
  }

  mensaje.innerHTML = '<p style="color: green;">✅ Registro guardado correctamente</p>';

  // Dejamos el formulario listo para registrar la siguiente actividad.
  detenerTimer();
  minutosTranscurridos = 0;
  segundosTimer = 0;
  (document.getElementById('tiempo') as HTMLInputElement).value = '00:00';
  (document.getElementById('detalle') as HTMLTextAreaElement).value = '';
}

// ========== TIMER ==========
// El timer mide segundos internamente para contar con precisión, pero la pantalla
// solo cambia cuando aparece un minuto completo. Así el usuario trabaja siempre con HH:MM.
function handleTimer() {
  const btn = document.getElementById('timerBtn') as HTMLButtonElement;
  const input = document.getElementById('tiempo') as HTMLInputElement;
  if (!btn || !input) return;

  if (timerCorriendo) {
    detenerTimer();
    btn.textContent = '▶ Iniciar';
    btn.className = 'secondary';
    return;
  }

  // Si había un HH:MM escrito manualmente, continuamos desde ese valor.
  const valorActual = convertirAMinutos(input.value);
  if (valorActual !== null) minutosTranscurridos = valorActual;

  // Date.now() evita acumular errores cuando el navegador retrasa setInterval.
  segundosTimer = minutosTranscurridos * 60;
  ultimoTick = Date.now();
  timerCorriendo = true;
  btn.textContent = '⏹ Detener';
  btn.className = 'primary';

  // Revisamos varias veces por segundo, pero solo modificamos el campo al cambiar el minuto.
  timerInterval = window.setInterval(() => {
    const ahora = Date.now();
    const transcurridos = Math.floor((ahora - ultimoTick) / 1000);

    if (transcurridos > 0) {
      ultimoTick += transcurridos * 1000;
      segundosTimer += transcurridos;

      const nuevosMinutos = Math.floor(segundosTimer / 60);
      if (nuevosMinutos !== minutosTranscurridos) {
        minutosTranscurridos = nuevosMinutos;
        input.value = formatearTiempo(minutosTranscurridos);
      }
    }
  }, 250);
}

// Detiene el intervalo sin borrar el tiempo acumulado.
function detenerTimer() {
  if (timerInterval !== null) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
  timerCorriendo = false;
}

// Reinicia el timer y el campo de tiempo a cero.
function handleReset() {
  const input = document.getElementById('tiempo') as HTMLInputElement;
  const btn = document.getElementById('timerBtn') as HTMLButtonElement;
  if (!input || !btn) return;

  detenerTimer();
  minutosTranscurridos = 0;
  segundosTimer = 0;
  input.value = '00:00';
  btn.textContent = '▶ Iniciar';
  btn.className = 'secondary';
}

// Escape básico para textos de base de datos que se insertan en HTML.
function escapeHtml(str: string): string {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
