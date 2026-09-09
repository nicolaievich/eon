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

export async function renderConfig(container: HTMLElement) {
  await cargarTodo();
  pintar(container);
}

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

function pintar(container: HTMLElement) {
  container.innerHTML = `
    <article>
      <h2>⚙️ Configuración</h2>

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
                <td><button type="button" class="secondary toggleProyecto" data-id="${p.id}" data-activo="${p.activo}">
                  ${p.activo ? 'Desactivar' : 'Activar'}
                </button></td>
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
          <thead><tr><th>Nombre</th><th>Color</th></tr></thead>
          <tbody>
            ${categorias.map(c => `
              <tr>
                <td>${escapeHtml(c.nombre)}</td>
                <td><span style="display:inline-block;width:14px;height:14px;border-radius:50%;background:${c.color ?? '#ccc'};"></span></td>
              </tr>
            `).join('') || '<tr><td colspan="2"><em>Sin categorías todavía — necesitás al menos una para poder registrar tiempo</em></td></tr>'}
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

  document.getElementById('formProyecto')?.addEventListener('submit', (e) => handleAlta(e, container, 'proyectos'));
  document.getElementById('formCategoria')?.addEventListener('submit', (e) => handleAlta(e, container, 'categorias'));
  document.getElementById('formCliente')?.addEventListener('submit', (e) => handleAlta(e, container, 'clientes'));

  container.querySelectorAll('.toggleProyecto').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const target = e.currentTarget as HTMLButtonElement;
      const id = Number(target.dataset.id);
      const activo = target.dataset.activo === 'true';
      await supabase.from('proyectos').update({ activo: !activo }).eq('id', id);
      await cargarTodo();
      pintar(container);
    });
  });
}

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
  pintar(container);
  const nuevoMensaje = document.getElementById('configMensaje');
  if (nuevoMensaje) nuevoMensaje.innerHTML = '<p style="color: green;">✅ Guardado</p>';
}

function escapeHtml(str: string): string {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
