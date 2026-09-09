import { supabase } from '../lib/supabase';

// Estado para proyectos, categorías y clientes
let proyectos: any[] = [];
let categorias: any[] = [];
let clientes: any[] = [];

// Estado para valores por defecto
let defaultProyectoId: number | null = null;
let defaultClienteId: number | null = null;

// Valores predeterminados (fallback si no hay configuración)
const DEFAULT_PROYECTO = 'Hermanos Calmels';
const DEFAULT_CLIENTE = 'Hermanos Calmels';

// Función principal para renderizar el formulario
export async function renderRegistrar(container: HTMLElement) {
  // ✅ PRIMERO: Cargar datos (proyectos, categorías, clientes)
  await cargarDatos();
  
  // ✅ SEGUNDO: Cargar defaults (ahora que ya tenemos los datos)
  await cargarDefaults();
  
  // ✅ TERCERO: Renderizar el HTML
  container.innerHTML = `
    <article>
      <h2>📋 Registrar tiempo</h2>
      
      <form id="registroForm">
        <!-- Fecha -->
        <label>
          Fecha *
          <input type="date" id="fecha" value="${new Date().toISOString().split('T')[0]}">
        </label>
        
        <!-- Proyecto -->
        <label>
          Proyecto
          <select id="proyecto">
            <option value="">Sin proyecto</option>
            ${proyectos.map(p => `
              <option value="${p.id}" ${defaultProyectoId === p.id ? 'selected' : ''}>
                ${p.nombre}
              </option>
            `).join('')}
          </select>
        </label>
        
        <!-- Categoría (obligatoria) -->
        <label>
          Categoría *
          <select id="categoria" required>
            <option value="">Seleccionar categoría</option>
            ${categorias.map(c => `
              <option value="${c.id}">${c.nombre}</option>
            `).join('')}
          </select>
        </label>
        
        <!-- Cliente -->
        <label>
          Cliente
          <select id="cliente">
            <option value="">Sin cliente</option>
            ${clientes.map(c => `
              <option value="${c.id}" ${defaultClienteId === c.id ? 'selected' : ''}>
                ${c.nombre}
              </option>
            `).join('')}
          </select>
        </label>
        
        <!-- Tiempo (con timer integrado) -->
        <label>
          Tiempo * (HH:MM:SS)
          <div style="display: flex; gap: 0.5rem; align-items: center;">
            <input type="text" id="tiempo" placeholder="01:30:00" value="00:00:00" required style="flex: 1;">
            <button type="button" id="timerBtn" class="secondary">▶ Iniciar</button>
            <button type="button" id="resetBtn" class="contrast">↺</button>
          </div>
        </label>
        
        <!-- Detalle -->
        <label>
          Detalle
          <textarea id="detalle" rows="3" placeholder="¿Qué hiciste? (opcional)"></textarea>
        </label>
        
        <button type="submit">💾 Guardar registro</button>
      </form>
      
      <div id="mensaje" style="margin-top: 1rem;"></div>
    </article>
  `;
  
  // Event listeners
  document.getElementById('registroForm')?.addEventListener('submit', handleGuardar);
  document.getElementById('timerBtn')?.addEventListener('click', handleTimer);
  document.getElementById('resetBtn')?.addEventListener('click', handleReset);
}

// ========== CARGAR DATOS DESDE SUPABASE ==========
async function cargarDatos() {
  const user = await supabase.auth.getUser();
  const userId = user.data.user?.id;
  
  if (!userId) return;
  
  // Cargar proyectos activos
  const { data: proyectosData } = await supabase
    .from('proyectos')
    .select('*')
    .eq('user_id', userId)
    .eq('activo', true)
    .order('nombre');
  
  proyectos = proyectosData ?? [];
  
  // Cargar categorías
  const { data: categoriasData } = await supabase
    .from('categorias')
    .select('*')
    .eq('user_id', userId)
    .order('nombre');
  
  categorias = categoriasData ?? [];
  
  // Cargar clientes
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
  
  // Resetear defaults
  defaultProyectoId = null;
  defaultClienteId = null;
  
  if (!userId) return;

  // Intentar cargar desde la tabla de configuración
  const { data, error } = await supabase
    .from('configuracion')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (data && !error) {
    // ✅ Verificar que el proyecto exista en la lista de proyectos activos
    if (data.proyecto_id) {
      const proyectoExiste = proyectos.some(p => p.id === data.proyecto_id);
      if (proyectoExiste) {
        defaultProyectoId = data.proyecto_id;
      }
    }
    
    // ✅ Verificar que el cliente exista en la lista de clientes
    if (data.cliente_id) {
      const clienteExiste = clientes.some(c => c.id === data.cliente_id);
      if (clienteExiste) {
        defaultClienteId = data.cliente_id;
      }
    }
  } else {
    // Si no hay configuración, usar los valores por nombre (fallback)
    const proyectoFallback = proyectos.find(p => p.nombre === DEFAULT_PROYECTO);
    if (proyectoFallback) {
      defaultProyectoId = proyectoFallback.id;
    }
    
    const clienteFallback = clientes.find(c => c.nombre === DEFAULT_CLIENTE);
    if (clienteFallback) {
      defaultClienteId = clienteFallback.id;
    }
  }
  
  // ✅ Debug: Mostrar en consola qué valores se están cargando
  console.log('📌 Defaults cargados:', {
    defaultProyectoId,
    defaultClienteId,
    proyectos: proyectos.map(p => ({ id: p.id, nombre: p.nombre })),
    clientes: clientes.map(c => ({ id: c.id, nombre: c.nombre }))
  });
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
  
  // Validar categoría (obligatoria)
  if (!categoriaId) {
    mensaje.innerHTML = '<p style="color: red;">❌ La categoría es obligatoria</p>';
    return;
  }
  
  // Validar tiempo (formato HH:MM:SS)
  const tiempoRegex = /^([0-9]{2}):([0-9]{2}):([0-9]{2})$/;
  const match = tiempoStr.match(tiempoRegex);
  if (!match) {
    mensaje.innerHTML = '<p style="color: red;">❌ Formato de tiempo inválido. Usá HH:MM:SS</p>';
    return;
  }
  
  // Convertir a minutos
  const horas = parseInt(match[1]);
  const minutos = parseInt(match[2]);
  const segundos = parseInt(match[3]);
  const tiempoMinutos = horas * 60 + minutos + (segundos / 60);
  
  // Obtener usuario actual
  const user = await supabase.auth.getUser();
  const userId = user.data.user?.id;
  
  if (!userId) {
    mensaje.innerHTML = '<p style="color: red;">❌ No estás autenticado</p>';
    return;
  }
  
  // Guardar en Supabase
  const { error } = await supabase
    .from('registros')
    .insert({
      fecha,
      proyecto_id: proyectoId || null,
      categoria_id: parseInt(categoriaId),
      cliente_id: clienteId || null,
      tiempo_minutos: Math.round(tiempoMinutos),
      detalle: detalle || null,
      user_id: userId
    });
  
  if (error) {
    mensaje.innerHTML = `<p style="color: red;">❌ Error: ${error.message}</p>`;
    return;
  }
  
  mensaje.innerHTML = '<p style="color: green;">✅ Registro guardado correctamente</p>';
  
  // Limpiar tiempo y detalle
  (document.getElementById('tiempo') as HTMLInputElement).value = '00:00:00';
  (document.getElementById('detalle') as HTMLTextAreaElement).value = '';
}

// ========== TIMER ==========
let timerInterval: number | null = null;
let segundos = 0;
let timerCorriendo = false;

function handleTimer() {
  const btn = document.getElementById('timerBtn') as HTMLButtonElement;
  const input = document.getElementById('tiempo') as HTMLInputElement;
  
  if (!btn || !input) return;
  
  if (timerCorriendo) {
    // Detener timer
    if (timerInterval) {
      clearInterval(timerInterval);
      timerInterval = null;
    }
    timerCorriendo = false;
    btn.textContent = '▶ Iniciar';
    btn.className = 'secondary';
  } else {
    // Iniciar timer
    const partes = input.value.split(':');
    if (partes.length === 3) {
      segundos = parseInt(partes[0]) * 3600 + parseInt(partes[1]) * 60 + parseInt(partes[2]);
    } else {
      segundos = 0;
    }
    
    timerCorriendo = true;
    btn.textContent = '⏹ Detener';
    btn.className = 'primary';
    
    timerInterval = window.setInterval(() => {
      segundos++;
      const h = String(Math.floor(segundos / 3600)).padStart(2, '0');
      const m = String(Math.floor((segundos % 3600) / 60)).padStart(2, '0');
      const s = String(segundos % 60).padStart(2, '0');
      input.value = `${h}:${m}:${s}`;
    }, 1000);
  }
}

function handleReset() {
  const input = document.getElementById('tiempo') as HTMLInputElement;
  const btn = document.getElementById('timerBtn') as HTMLButtonElement;
  
  if (!input || !btn) return;
  
  // Detener timer si está corriendo
  if (timerCorriendo) {
    if (timerInterval) {
      clearInterval(timerInterval);
      timerInterval = null;
    }
    timerCorriendo = false;
    btn.textContent = '▶ Iniciar';
    btn.className = 'secondary';
  }
  
  input.value = '00:00:00';
  segundos = 0;
}
