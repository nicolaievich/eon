/**
 * ============================================================
 * EÓN — CONFIGURACIÓN (config.ts) — v1.7.1
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

// Sección actualmente abierta dentro de Configuración.
// 1.7.1 reorganiza la pantalla sin cambiar el funcionamiento de los catálogos.
let seccionActual: 'inicio' | 'categorias' | 'clientes' | 'proyectos' = 'inicio';

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
  // ----------------------------------------------------------
  // 05. CONSTRUIR INTERFAZ
  // ----------------------------------------------------------
  // La pantalla principal funciona como menú de Configuración.
  // Cada catálogo conserva su formulario, presentación y acciones
  // existentes; solamente se muestran de forma independiente y
  // ordenada para facilitar su administración.
  // ----------------------------------------------------------

  const volver = `
    <p style="margin-bottom: 1rem;">
      <button type="button" class="secondary outline volverConfig">← Volver a Configuración</button>
    </p>
  `;

  if (seccionActual === 'inicio') {
    container.innerHTML = `
      <article>
        <h2>⚙️ Configuración</h2>
        <p style="color: var(--pico-muted-color);">
          En Configuración administrás los datos que EÓN utiliza para registrar y clasificar tu tiempo.
          Elegí una sección para consultar, crear o modificar sus elementos.
        </p>

        <section style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:1rem;margin-top:1.25rem;">
          <article style="margin:0;">
            <h3>🏷️ Categorías</h3>
            <p style="min-height:3.5rem;">Administrá las categorías con las que clasificás tu tiempo. Aquí también se encuentran las categorías por defecto de EÓN.</p>
            <button type="button" data-seccion="categorias">Administrar categorías →</button>
          </article>

          <article style="margin:0;">
            <h3>👤 Clientes</h3>
            <p style="min-height:3.5rem;">Administrá los clientes que pueden asociarse a tus registros de tiempo y utilizalos para identificar para quién realizaste un trabajo.</p>
            <button type="button" data-seccion="clientes">Administrar clientes →</button>
          </article>

          <article style="margin:0;">
            <h3>📁 Proyectos</h3>
            <p style="min-height:3.5rem;">Administrá los proyectos disponibles y definí cuáles están activos para utilizarlos al registrar tiempo.</p>
            <button type="button" data-seccion="proyectos">Administrar proyectos →</button>
          </article>
        </section>

        <hr>

        <details open>
          <summary><strong>Valores por defecto</strong></summary>
          <p style="color: var(--pico-muted-color); font-size: 0.9rem;">
            Definí qué proyecto y cliente se cargarán automáticamente al registrar un nuevo tiempo.
            Son valores iniciales y pueden modificarse en cada registro.
          </p>
          <form id="formDefaults" style="display:flex; gap:0.5rem; align-items:end; flex-wrap:wrap;">
            <label style="flex:2; min-width:200px;">
              Proyecto predeterminado
              <input type="hidden" id="defaultProyecto" value="">
              <input type="search" id="defaultProyectoBuscar" list="defaultProyectosOpciones" placeholder="Buscar proyecto..." autocomplete="off">
              <datalist id="defaultProyectosOpciones">
                ${proyectos.map(p => `<option value="${escapeHtml(p.nombre)}"></option>`).join('')}
              </datalist>
            </label>
            <label style="flex:2; min-width:200px;">
              Cliente predeterminado
              <input type="hidden" id="defaultCliente" value="">
              <input type="search" id="defaultClienteBuscar" list="defaultClientesOpciones" placeholder="Buscar cliente..." autocomplete="off">
              <datalist id="defaultClientesOpciones">
                ${clientes.map(c => `<option value="${escapeHtml(c.nombre)}"></option>`).join('')}
              </datalist>
            </label>
            <button type="submit">💾 Guardar predeterminados</button>
          </form>
          <div id="defaultMensaje" style="margin-top: 0.5rem;"></div>
        </details>
      </article>
    `;

    configurarBuscadorConfig('defaultProyectoBuscar', 'defaultProyecto', proyectos, defaultProyectoId);
    configurarBuscadorConfig('defaultClienteBuscar', 'defaultCliente', clientes, defaultClienteId);
    document.getElementById('formDefaults')?.addEventListener('submit', handleDefaults);

    container.querySelectorAll('[data-seccion]').forEach(btn => {
      btn.addEventListener('click', () => {
        seccionActual = (btn as HTMLElement).dataset.seccion as typeof seccionActual;
        pintar(container);
      });
    });
    return;
  }

  if (seccionActual === 'categorias') {
    container.innerHTML = `
      <article>
        ${volver}
        <h2>🏷️ Categorías</h2>
        <p style="color: var(--pico-muted-color);">
          Las categorías sirven para clasificar en qué tipo de actividad utilizaste tu tiempo.
          Las categorías por defecto de EÓN también se administran desde esta sección.
          Al editar una categoría, el cambio de nombre/color se refleja en los registros que la utilizan.
        </p>

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

        <div style="overflow-x:auto;margin-top:1rem;">
          <table>
            <thead><tr><th>Nombre</th><th>Color</th><th>Acciones</th></tr></thead>
            <tbody>
              ${categorias.map(c => `
                <tr>
                  <td>${escapeHtml(c.nombre)}</td>
                  <td><span style="display:inline-block;width:14px;height:14px;border-radius:50%;background:${c.color ?? '#ccc'};"></span></td>
                  <td><button type="button" class="secondary editarCategoria" data-id="${c.id}">✏️ Editar</button></td>
                </tr>
              `).join('') || '<tr><td colspan="3"><em>Sin categorías todavía — necesitás al menos una para poder registrar tiempo</em></td></tr>'}
            </tbody>
          </table>
        </div>
        <div id="configMensaje" style="margin-top: 1rem;"></div>
      </article>
    `;
    conectarEventosCategoria(container);
    return;
  }

  if (seccionActual === 'clientes') {
    container.innerHTML = `
      <article>
        ${volver}
        <h2>👤 Clientes</h2>
        <p style="color: var(--pico-muted-color);">
          Aquí administrás los clientes asociados a tus registros. Un cliente permite identificar
          para quién se realizó una tarea y facilita después la búsqueda y el análisis de tiempos.
        </p>

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

        <div style="overflow-x:auto;margin-top:1rem;">
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
        </div>
        <div id="configMensaje" style="margin-top: 1rem;"></div>
      </article>
    `;
    conectarEventosCatalogo(container, 'clientes');
    return;
  }

  container.innerHTML = `
    <article>
      ${volver}
      <h2>📁 Proyectos</h2>
      <p style="color: var(--pico-muted-color);">
        Aquí administrás los proyectos disponibles para registrar tiempo. Podés activar o desactivar
        un proyecto sin eliminarlo, conservando así la información histórica de los registros.
      </p>

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

      <div style="overflow-x:auto;margin-top:1rem;">
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
      </div>
      <div id="configMensaje" style="margin-top: 1rem;"></div>
    </article>
  `;
  conectarEventosCatalogo(container, 'proyectos');
}

function conectarVolver(container: HTMLElement) {
  container.querySelectorAll('.volverConfig').forEach(btn => {
    btn.addEventListener('click', () => {
      seccionActual = 'inicio';
      pintar(container);
    });
  });
}

function conectarEventosCategoria(container: HTMLElement) {
  conectarVolver(container);
  document.getElementById('formCategoria')?.addEventListener('submit', (e) => handleAlta(e, container, 'categorias'));

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

      await cargarTodo();
      await cargarDefaults();
      pintar(container);
      const mensaje = document.getElementById('configMensaje');
      if (mensaje) mensaje.innerHTML = '<p style="color:green;">✅ Categoría actualizada. El cambio se aplica también a los registros históricos.</p>';
    });
  });
}

function conectarEventosCatalogo(container: HTMLElement, tabla: 'proyectos' | 'clientes') {
  conectarVolver(container);
  document.getElementById(tabla === 'proyectos' ? 'formProyecto' : 'formCliente')
    ?.addEventListener('submit', (e) => handleAlta(e, container, tabla));

  if (tabla === 'proyectos') {
    container.querySelectorAll('.toggleProyecto').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const target = e.currentTarget as HTMLButtonElement;
        const id = Number(target.dataset.id);
        const activo = target.dataset.activo === 'true';
        const { error } = await supabase.from('proyectos').update({ activo: !activo }).eq('id', id);
        if (error) {
          const mensaje = document.getElementById('configMensaje');
          if (mensaje) mensaje.innerHTML = `<p style="color:red;">❌ Error: ${escapeHtml(error.message)}</p>`;
          return;
        }
        await cargarTodo();
        await cargarDefaults();
        pintar(container);
      });
    });
  }
}
}