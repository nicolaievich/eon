/**
 * ============================================================
 * EÓN — CONFIGURACIÓN (config.ts) — v1.6.0
 * ============================================================
 *
 * Administra proyectos, categorías, clientes y los valores
 * predeterminados usados al registrar tiempo.
 *
 * ÍNDICE DE FUNCIONES
 * ------------------------------------------------------------
 * 01. renderConfig() → entrada principal de esta pantalla
 * 02. cargarTodo() → carga los tres catálogos
 * 03. cargarDefaults() → lee configuración del usuario
 * 04. guardarDefaults() → guarda proyecto/cliente predeterminados
 * 05. pintar() → construye la interfaz
 * 06. handleDefaults() → procesa el formulario de defaults
 * 07. handleAlta() → alta de proyecto/categoría/cliente
 * 08. escapeHtml() → protección de HTML
 * ============================================================
 */

import { supabase } from '../lib/supabase';

// ========== TIPOS LOCALES ==========
interface Proyecto {
  id: number;
  nombre: string;
  descripcion: string | null;
  activo: boolean;
}
interface Categoria {
  id: number;
  nombre: string;
  color: string | null;
}
interface Cliente {
  id: number;
  nombre: string;
  contacto: string | null;
}

let proyectos: Proyecto[] = [];
let categorias: Categoria[] = [];
let clientes: Cliente[] = [];

// ✅ NUEVO: Estado para valores por defecto
let defaultProyectoId: number | null = null;
let defaultClienteId: number | null = null;

// ------------------------------------------------------------
// 01. ENTRADA PRINCIPAL
// ------------------------------------------------------------
export async function renderConfig(container: HTMLElement) {
  await cargarTodo();
  await cargarDefaults();
  pintar(container);
}

// ------------------------------------------------------------
// 02. CARGAR CATÁLOGOS
// ------------------------------------------------------------
async function cargarTodo() {
  const user = await supabase.auth.getUser();
  const userId = user.data.user?.id;
  if (!userId) return;

  const [{ data: p }, { data: c }, { data: cl }] = await Promise.all([
    supabase.from('proyectos').select('*').eq('user_id', userId).order('nombre'),
    supabase.from('categorias').select('*').eq('user_id', userId).order('nombre'),
    supabase.from('clientes').select('*').eq('user_id', userId).order('nombre'),
  ]);

  proyectos = p ?? [];
  categorias = c ?? [];
  clientes = cl ?? [];
}

// ✅ NUEVO: Cargar valores por defecto desde Supabase
// ------------------------------------------------------------
// 03. LEER PREDETERMINADOS
// ------------------------------------------------------------
async function cargarDefaults() {
  const user = await supabase.auth.getUser();
  const userId = user.data.user?.id;
  if (!userId) return;

  const { data, error } = await supabase
    .from('configuracion')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (data && !error) {
    defaultProyectoId = data.proyecto_id || null;
    defaultClienteId = data.cliente_id || null;
  } else {
    // Si no hay configuración, usar null
    defaultProyectoId = null;
    defaultClienteId = null;
  }
}

// ✅ NUEVO: Guardar valores por defecto
// ------------------------------------------------------------
// 04. GUARDAR PREDETERMINADOS
// ------------------------------------------------------------
async function guardarDefaults(proyectoId: number | null, clienteId: number | null) {
  const user = await supabase.auth.getUser();
  const userId = user.data.user?.id;
  if (!userId) return;

  const { error } = await supabase
    .from('configuracion')
    .upsert({
      user_id: userId,
      proyecto_id: proyectoId,
      cliente_id: clienteId,
      updated_at: new Date().toISOString()
    }, {
      onConflict: 'user_id'
    });

  if (error) {
    console.error('Error al guardar defaults:', error);
    throw error;
  }
}

// ------------------------------------------------------------
// 05. CONSTRUIR INTERFAZ
// ------------------------------------------------------------
function pintar(container: HTMLElement) {
  container.innerHTML = `
    <article>
      <h2>⚙️ Configuración</h2>

      <!-- ✅ NUEVO: Valores por defecto -->
      <details open>
        <summary><strong>Valores por defecto</strong></summary>
        <form id="formDefaults" style="display:flex; gap:0.5rem; align-items:end; flex-wrap:wrap;">
          <label style="flex:2; min-width:200px;">
            Proyecto predeterminado
            <select id="defaultProyecto">
              <option value="">Seleccionar proyecto por defecto</option>
              ${proyectos.map(p => `
                <option value="${p.id}" ${defaultProyectoId === p.id ? 'selected' : ''}>
                  ${escapeHtml(p.nombre)}
                </option>
              `).join('')}
            </select>
          </label>
          <label style="flex:2; min-width:200px;">
            Cliente predeterminado
            <select id="defaultCliente">
              <option value="">Seleccionar cliente por defecto</option>
              ${clientes.map(c => `
                <option value="${c.id}" ${defaultClienteId === c.id ? 'selected' : ''}>
                  ${escapeHtml(c.nombre)}
                </option>
              `).join('')}
            </select>
          </label>
          <button type="submit">💾 Guardar predeterminados</button>
        </form>
        <div id="defaultMensaje" style="margin-top: 0.5rem;"></div>
        <p style="color: var(--pico-muted-color); font-size: 0.8rem; margin-top: 0.5rem;">
          ℹ️ Estos valores se cargarán automáticamente al registrar tiempo.
        </p>
      </details>

      <details open>
        <summary><strong>Proyectos</strong></summary>
        <form id="formProyecto" style="display:flex; gap:0.5rem; align-items:end; flex-wrap:wrap;">
          <label style="flex:2; min-width:150px;">
            Nombre
            <input type="text" id="proyectoNombre" required>
          </label>
          <label style="flex:2; min-width:150px;">
            Descripción
            <input type="text" id="proyectoDescripcion">
          </label>
          <button type="submit">+ Agregar</button>
        </form>
        <table>
          <thead><tr><th>Nombre</th><th>Descripción</th><th>Activo</th><th></th></tr></thead>
          <tbody>
            ${proyectos.map(p => `
              <tr>
                <td>${escapeHtml(p.nombre)}</td>
                <td>${escapeHtml(p.descripcion ?? '')}</td>
                <td>${p.activo ? '✅' : '❌'}</td>
                <td>
                  <button type="button" class="secondary toggleProyecto" data-id="${p.id}" data-activo="${p.activo}">
                    ${p.activo ? 'Desactivar' : 'Activar'}
                  </button>
                </td>
              </tr>
            `).join('') || '<tr><td colspan="4"><em>Sin proyectos todavía</em></td></tr>'}
          </tbody>
        </table>
      </details>

      <details open>
        <summary><strong>Categorías</strong></summary>
        <form id="formCategoria" style="display:flex; gap:0.5rem; align-items:end; flex-wrap:wrap;">
          <label style="flex:2; min-width:150px;">
            Nombre
            <input type="text" id="categoriaNombre" required>
          </label>
          <label style="flex:1; min-width:100px;">
            Color
            <input type="color" id="categoriaColor" value="#3b82f6">
          </label>
          <button type="submit">+ Agregar</button>
        </form>
        <table>
          <thead><tr><th>Nombre</th><th>Color</th><th>Acciones</th></tr></thead>
          <tbody>
            ${categorias.map(c => `
              <tr>
                <td>${escapeHtml(c.nombre)}</td>
                <td><span style="display:inline-block;width:14px;height:14px;border-radius:50%;background:${c.color ?? '#ccc'};"></span></td>
                <td><button type="button" class="secondary editarCategoria" data-id="${c.id}">✏️ Editar</button></td>
              </tr>
            `).join('') || '<tr><td colspan="2"><em>Sin categorías todavía — necesitás al menos una para poder registrar tiempo</em></td><td></td></tr>'}
          </tbody>
        </table>
      </details>

      <details open>
        <summary><strong>Clientes</strong></summary>
        <form id="formCliente" style="display:flex; gap:0.5rem; align-items:end; flex-wrap:wrap;">
          <label style="flex:2; min-width:150px;">
            Nombre
            <input type="text" id="clienteNombre" required>
          </label>
          <label style="flex:2; min-width:150px;">
            Contacto
            <input type="text" id="clienteContacto">
          </label>
          <button type="submit">+ Agregar</button>
        </form>
        <table>
          <thead><tr><th>Nombre</th><th>Contacto</th></tr></thead>
          <tbody>
            ${clientes.map(c => `
              <tr>
                <td>${escapeHtml(c.nombre)}</td>
                <td>${escapeHtml(c.contacto ?? '')}</td>
              </tr>
            `).join('') || '<tr><td colspan="2"><em>Sin clientes todavía</em></td></tr>'}
          </tbody>
        </table>
      </details>

      <div id="configMensaje" style="margin-top: 1rem;"></div>
    </article>
  `;

  // ✅ NUEVO: Event listener para defaults
  document.getElementById('formDefaults')?.addEventListener('submit', handleDefaults);
  document.getElementById('formProyecto')?.addEventListener('submit', (e) => handleAlta(e, container, 'proyectos'));
  document.getElementById('formCategoria')?.addEventListener('submit', (e) => handleAlta(e, container, 'categorias'));
  document.getElementById('formCliente')?.addEventListener('submit', (e) => handleAlta(e, container, 'clientes'));

  container.querySelectorAll('.editarCategoria').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const id = Number((e.currentTarget as HTMLElement).dataset.id);
      const categoria = categorias.find(c => c.id === id);
      if (!categoria) return;

      const nombre = prompt('Nuevo nombre de la categoría:', categoria.nombre);
      if (nombre === null) return;
      const nombreLimpio = nombre.trim();
      if (!nombreLimpio) {
        alert('El nombre no puede quedar vacío.');
        return;
      }

      const color = prompt('Color (hexadecimal):', categoria.color ?? '#3b82f6');
      if (color === null) return;
      const colorLimpio = color.trim() || '#3b82f6';

      const user = await supabase.auth.getUser();
      const userId = user.data.user?.id;
      if (!userId) return;

      const { error } = await supabase
        .from('categorias')
        .update({ nombre: nombreLimpio, color: colorLimpio })
        .eq('id', id)
        .eq('user_id', userId);

      if (error) {
        const mensaje = document.getElementById('configMensaje');
        if (mensaje) mensaje.innerHTML = `<p style="color:red;">❌ Error: ${escapeHtml(error.message)}</p>`;
        return;
      }

      // Los registros históricos conservan categoria_id. Al cambiar
      // la categoría, sus relaciones muestran automáticamente el nuevo
      // nombre/color, por lo que el cambio es retroactivo.
      await cargarTodo();
      await cargarDefaults();
      pintar(container);
      const mensaje = document.getElementById('configMensaje');
      if (mensaje) mensaje.innerHTML = '<p style="color:green;">✅ Categoría actualizada. El cambio se aplica también a los registros históricos.</p>';
    });
  });

  container.querySelectorAll('.toggleProyecto').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const target = e.currentTarget as HTMLButtonElement;
      const id = Number(target.dataset.id);
      const activo = target.dataset.activo === 'true';
      await supabase.from('proyectos').update({ activo: !activo }).eq('id', id);
      await cargarTodo();
      await cargarDefaults();
      pintar(container);
    });
  });
}

// ✅ NUEVO: Manejador para guardar defaults
async function handleDefaults(e: Event) {
  e.preventDefault();
  const mensaje = document.getElementById('defaultMensaje');
  if (!mensaje) return;

  const proyectoId = (document.getElementById('defaultProyecto') as HTMLSelectElement).value;
  const clienteId = (document.getElementById('defaultCliente') as HTMLSelectElement).value;

  try {
    await guardarDefaults(
      proyectoId ? parseInt(proyectoId) : null,
      clienteId ? parseInt(clienteId) : null
    );
    mensaje.innerHTML = '<p style="color: green;">✅ Predeterminados guardados</p>';
    
    // Actualizar los valores en memoria
    defaultProyectoId = proyectoId ? parseInt(proyectoId) : null;
    defaultClienteId = clienteId ? parseInt(clienteId) : null;
    
    setTimeout(() => {
      mensaje.innerHTML = '';
    }, 3000);
  } catch (error: any) {
    mensaje.innerHTML = `<p style="color: red;">❌ Error: ${error.message}</p>`;
  }
}

// ------------------------------------------------------------
// 07. ALTAS
// ------------------------------------------------------------
// 'tabla' determina qué formulario se procesó y qué campos se
// envían a Supabase.
// ------------------------------------------------------------
async function handleAlta(e: Event, container: HTMLElement, tabla: 'proyectos' | 'categorias' | 'clientes') {
  e.preventDefault();
  const mensaje = document.getElementById('configMensaje');
  const user = await supabase.auth.getUser();
  const userId = user.data.user?.id;

  if (!userId || !mensaje) return;

  let payload: Record<string, unknown> = { user_id: userId };

  if (tabla === 'proyectos') {
    const nombre = (document.getElementById('proyectoNombre') as HTMLInputElement).value.trim();
    const descripcion = (document.getElementById('proyectoDescripcion') as HTMLInputElement).value.trim();
    if (!nombre) return;
    payload = { ...payload, nombre, descripcion: descripcion || null, activo: true };
  } else if (tabla === 'categorias') {
    const nombre = (document.getElementById('categoriaNombre') as HTMLInputElement).value.trim();
    const color = (document.getElementById('categoriaColor') as HTMLInputElement).value;
    if (!nombre) return;
    payload = { ...payload, nombre, color };
  } else {
    const nombre = (document.getElementById('clienteNombre') as HTMLInputElement).value.trim();
    const contacto = (document.getElementById('clienteContacto') as HTMLInputElement).value.trim();
    if (!nombre) return;
    payload = { ...payload, nombre, contacto: contacto || null };
  }

  const { error } = await supabase.from(tabla).insert(payload);

  if (error) {
    mensaje.innerHTML = `<p style="color: red;">❌ Error: ${escapeHtml(error.message)}</p>`;
    return;
  }

  await cargarTodo();
  await cargarDefaults();
  pintar(container);
  const nuevoMensaje = document.getElementById('configMensaje');
  if (nuevoMensaje) nuevoMensaje.innerHTML = '<p style="color: green;">✅ Guardado</p>';
}

function escapeHtml(str: string): string {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}