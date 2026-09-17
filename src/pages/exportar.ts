import { supabase } from '../lib/supabase';

// ============================================================
// EÓN 1.5 — EXPORTAR / IMPORTAR CSV
//
// Regla de importación de esta versión:
// - Siempre agrega; nunca sobrescribe registros existentes.
// - Catálogos duplicados (mismo nombre, sin distinguir mayúsculas
//   y minúsculas) se omiten.
// - Las líneas que comienzan con # son comentarios y NO se importan.
// ============================================================

let registrosOrdenCampo = 'fecha';
let registrosOrdenAsc = false;
let registrosDesde = '';
let registrosHasta = '';

function fechaLocalISO(fecha = new Date()): string {
  const año = fecha.getFullYear();
  const mes = String(fecha.getMonth() + 1).padStart(2, '0');
  const dia = String(fecha.getDate()).padStart(2, '0');
  return `${año}-${mes}-${dia}`;
}

function establecerPeriodo() {
  if (registrosDesde && registrosHasta) return;
  const hoy = new Date();
  registrosDesde = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-01`;
  registrosHasta = fechaLocalISO(hoy);
}

function csvEscapar(valor: unknown): string {
  const texto = String(valor ?? '');
  return /[",\n\r]/.test(texto) ? `"${texto.replace(/"/g, '""')}"` : texto;
}

function descargar(nombre: string, contenido: string) {
  const blob = new Blob(['\ufeff' + contenido], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nombre;
  a.click();
  URL.revokeObjectURL(url);
}

// Parser CSV pequeño pero compatible con comillas, comas y saltos de línea dentro de campos.
function parseCSV(texto: string): string[][] {
  const filas: string[][] = [];
  let fila: string[] = [];
  let campo = '';
  let entreComillas = false;

  texto = texto.replace(/^\ufeff/, '');

  for (let i = 0; i < texto.length; i++) {
    const ch = texto[i];
    if (entreComillas) {
      if (ch === '"' && texto[i + 1] === '"') {
        campo += '"';
        i++;
      } else if (ch === '"') {
        entreComillas = false;
      } else {
        campo += ch;
      }
    } else if (ch === '"') {
      entreComillas = true;
    } else if (ch === ',') {
      fila.push(campo);
      campo = '';
    } else if (ch === '\n') {
      fila.push(campo.replace(/\r$/, ''));
      if (fila.some(v => v.trim() !== '')) filas.push(fila);
      fila = [];
      campo = '';
    } else {
      campo += ch;
    }
  }
  if (campo !== '' || fila.length) {
    fila.push(campo.replace(/\r$/, ''));
    if (fila.some(v => v.trim() !== '')) filas.push(fila);
  }
  return filas;
}

function normalizarNombre(valor: string): string {
  return valor.trim().toLocaleLowerCase();
}

function mostrarMensaje(elementId: string, html: string) {
  const el = document.getElementById(elementId);
  if (el) el.innerHTML = html;
}

function abrirSelectorArchivo(tipo: string) {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.csv,text/csv';
  input.addEventListener('change', async () => {
    const archivo = input.files?.[0];
    if (!archivo) return;
    try {
      const texto = await archivo.text();
      if (tipo === 'registros') await importarRegistros(texto);
      if (tipo === 'categorias') await importarCategorias(texto);
      if (tipo === 'proyectos') await importarProyectos(texto);
      if (tipo === 'clientes') await importarClientes(texto);
    } catch (error: any) {
      mostrarMensaje('importarMensaje', `<p style="color:red;">❌ ${escaparHTML(error.message || 'No se pudo importar el archivo')}</p>`);
    }
  });
  input.click();
}

function escaparHTML(valor: unknown): string {
  const div = document.createElement('div');
  div.textContent = String(valor ?? '');
  return div.innerHTML;
}

async function usuarioId(): Promise<string> {
  const { data } = await supabase.auth.getUser();
  if (!data.user?.id) throw new Error('No estás autenticado');
  return data.user.id;
}

// ---------- MODELOS CSV ----------
// Los ejemplos están comentados con # para que se puedan leer y copiar,
// pero el importador los ignora deliberadamente.
function modeloRegistros() {
  return `# MODELO CSV EÓN 1.5 — REGISTROS
# Las líneas que comienzan con # son comentarios y NO se importan.
# Ejemplo: 2026-09-17,Hermanos Calmels,Servicio Técnico,Taller,01:30,Revisión de notebook
fecha,proyecto,categoria,cliente,tiempo,detalle
`;
}
function modeloCategorias() {
  return `# MODELO CSV EÓN 1.5 — CATEGORÍAS
# Las líneas que comienzan con # son comentarios y NO se importan.
# Ejemplo: Servicio Técnico,#cc0000
nombre,color
`;
}
function modeloProyectos() {
  return `# MODELO CSV EÓN 1.5 — PROYECTOS
# Las líneas que comienzan con # son comentarios y NO se importan.
# Ejemplo: Hermanos Calmels,Proyecto general,true
nombre,descripcion,activo
`;
}
function modeloClientes() {
  return `# MODELO CSV EÓN 1.5 — CLIENTES
# Las líneas que comienzan con # son comentarios y NO se importan.
# Ejemplo: Hermanos Calmels,hola@hermanoscalmels.com
nombre,contacto
`;
}

function descargarModelo(tipo: 'registros' | 'categorias' | 'proyectos' | 'clientes') {
  const modelos = { registros: modeloRegistros, categorias: modeloCategorias, proyectos: modeloProyectos, clientes: modeloClientes };
  descargar(`eon-modelo-${tipo}.csv`, modelos[tipo]());
}

// ---------- EXPORTACIÓN ----------
async function exportarRegistros() {
  try {
    const userId = await usuarioId();
    let query = supabase.from('registros').select(`fecha, tiempo_minutos, detalle, proyecto:proyectos(nombre), categoria:categorias(nombre), cliente:clientes(nombre)`).eq('user_id', userId);
    if (registrosDesde) query = query.gte('fecha', registrosDesde);
    if (registrosHasta) query = query.lte('fecha', registrosHasta);

    const { data, error } = await query;
    if (error) throw error;
    const filas = (data ?? []).map((r: any) => ({
      fecha: r.fecha,
      proyecto: Array.isArray(r.proyecto) ? r.proyecto[0]?.nombre ?? '' : r.proyecto?.nombre ?? '',
      categoria: Array.isArray(r.categoria) ? r.categoria[0]?.nombre ?? '' : r.categoria?.nombre ?? '',
      cliente: Array.isArray(r.cliente) ? r.cliente[0]?.nombre ?? '' : r.cliente?.nombre ?? '',
      tiempo: `${String(Math.floor(Number(r.tiempo_minutos || 0) / 60)).padStart(2, '0')}:${String(Number(r.tiempo_minutos || 0) % 60).padStart(2, '0')}`,
      detalle: r.detalle ?? ''
    }));

    filas.sort((a: any, b: any) => comparar(a[registrosOrdenCampo], b[registrosOrdenCampo]) * (registrosOrdenAsc ? 1 : -1));
    const cabeceras = ['fecha', 'proyecto', 'categoria', 'cliente', 'tiempo', 'detalle'];
    const csv = cabeceras.join(',') + '\n' + filas.map((f: any) => cabeceras.map(c => csvEscapar(f[c])).join(',')).join('\n') + '\n';
    descargar(`eon-registros-${registrosDesde || 'inicio'}-${registrosHasta || 'hoy'}.csv`, csv);
    mostrarMensaje('exportarMensaje', `<p style="color:green;">✅ ${filas.length} registros exportados.</p>`);
  } catch (error: any) {
    mostrarMensaje('exportarMensaje', `<p style="color:red;">❌ ${escaparHTML(error.message)}</p>`);
  }
}

async function exportarCatalogo(tabla: 'categorias' | 'proyectos' | 'clientes') {
  try {
    const userId = await usuarioId();
    const { data, error } = await supabase.from(tabla).select('*').eq('user_id', userId).order('nombre');
    if (error) throw error;

    let cabeceras: string[];
    let filas: any[];
    if (tabla === 'categorias') {
      cabeceras = ['nombre', 'color'];
      filas = (data ?? []).map((x: any) => ({ nombre: x.nombre, color: x.color ?? '' }));
    } else if (tabla === 'proyectos') {
      cabeceras = ['nombre', 'descripcion', 'activo'];
      filas = (data ?? []).map((x: any) => ({ nombre: x.nombre, descripcion: x.descripcion ?? '', activo: x.activo ? 'true' : 'false' }));
    } else {
      cabeceras = ['nombre', 'contacto'];
      filas = (data ?? []).map((x: any) => ({ nombre: x.nombre, contacto: x.contacto ?? '' }));
    }
    const csv = cabeceras.join(',') + '\n' + filas.map(f => cabeceras.map(c => csvEscapar(f[c])).join(',')).join('\n') + '\n';
    descargar(`eon-${tabla}.csv`, csv);
    mostrarMensaje('exportarMensaje', `<p style="color:green;">✅ ${filas.length} elementos exportados.</p>`);
  } catch (error: any) {
    mostrarMensaje('exportarMensaje', `<p style="color:red;">❌ ${escaparHTML(error.message)}</p>`);
  }
}

function comparar(a: any, b: any): number {
  if (a === b) return 0;
  return String(a ?? '').localeCompare(String(b ?? ''), 'es', { numeric: true, sensitivity: 'base' });
}

// ---------- IMPORTACIÓN DE CATÁLOGOS ----------
function prepararFilas(texto: string): Record<string, string>[] {
  const filas = parseCSV(texto).filter(f => !f[0].trim().startsWith('#'));
  if (filas.length < 2) return [];
  const cabeceras = filas[0].map(h => h.trim().toLowerCase());
  return filas.slice(1).map(f => Object.fromEntries(cabeceras.map((h, i) => [h, (f[i] ?? '').trim()])));
}

async function importarCategorias(texto: string) {
  const userId = await usuarioId();
  const filas = prepararFilas(texto);
  const { data: existentes } = await supabase.from('categorias').select('nombre').eq('user_id', userId);
  const nombres = new Set((existentes ?? []).map((x: any) => normalizarNombre(x.nombre)));
  let agregados = 0, omitidos = 0, errores = 0;
  for (const f of filas) {
    if (!f.nombre) { errores++; continue; }
    if (nombres.has(normalizarNombre(f.nombre))) { omitidos++; continue; }
    const { error } = await supabase.from('categorias').insert({ user_id: userId, nombre: f.nombre, color: f.color || '#3b82f6' });
    if (error) errores++; else { agregados++; nombres.add(normalizarNombre(f.nombre)); }
  }
  resultadoImportacion(agregados, omitidos, errores);
}

async function importarProyectos(texto: string) {
  const userId = await usuarioId();
  const filas = prepararFilas(texto);
  const { data: existentes } = await supabase.from('proyectos').select('nombre').eq('user_id', userId);
  const nombres = new Set((existentes ?? []).map((x: any) => normalizarNombre(x.nombre)));
  let agregados = 0, omitidos = 0, errores = 0;
  for (const f of filas) {
    if (!f.nombre) { errores++; continue; }
    if (nombres.has(normalizarNombre(f.nombre))) { omitidos++; continue; }
    const activo = f.activo === '' ? true : f.activo.toLowerCase() !== 'false';
    const { error } = await supabase.from('proyectos').insert({ user_id: userId, nombre: f.nombre, descripcion: f.descripcion || null, activo });
    if (error) errores++; else { agregados++; nombres.add(normalizarNombre(f.nombre)); }
  }
  resultadoImportacion(agregados, omitidos, errores);
}

async function importarClientes(texto: string) {
  const userId = await usuarioId();
  const filas = prepararFilas(texto);
  const { data: existentes } = await supabase.from('clientes').select('nombre').eq('user_id', userId);
  const nombres = new Set((existentes ?? []).map((x: any) => normalizarNombre(x.nombre)));
  let agregados = 0, omitidos = 0, errores = 0;
  for (const f of filas) {
    if (!f.nombre) { errores++; continue; }
    if (nombres.has(normalizarNombre(f.nombre))) { omitidos++; continue; }
    const { error } = await supabase.from('clientes').insert({ user_id: userId, nombre: f.nombre, contacto: f.contacto || null });
    if (error) errores++; else { agregados++; nombres.add(normalizarNombre(f.nombre)); }
  }
  resultadoImportacion(agregados, omitidos, errores);
}

async function importarRegistros(texto: string) {
  const userId = await usuarioId();
  const filas = prepararFilas(texto);
  const [{ data: proyectos }, { data: categorias }, { data: clientes }] = await Promise.all([
    supabase.from('proyectos').select('id,nombre').eq('user_id', userId),
    supabase.from('categorias').select('id,nombre').eq('user_id', userId),
    supabase.from('clientes').select('id,nombre').eq('user_id', userId)
  ]);

  const mapa = (lista: any[] | null) => new Map((lista ?? []).map(x => [normalizarNombre(x.nombre), x.id]));
  const proyectosMap = mapa(proyectos);
  const categoriasMap = mapa(categorias);
  const clientesMap = mapa(clientes);
  let agregados = 0, omitidos = 0, errores = 0;

  for (const f of filas) {
    if (!f.fecha || !f.categoria || !f.tiempo) { errores++; continue; }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(f.fecha)) { errores++; continue; }
    const tiempo = f.tiempo.match(/^(\d+):(\d{2})$/);
    if (!tiempo || Number(tiempo[2]) > 59) { errores++; continue; }
    const categoriaId = categoriasMap.get(normalizarNombre(f.categoria));
    if (!categoriaId) { errores++; continue; }

    // Registros no se sobrescriben ni se consideran duplicados: cada fila válida se agrega.
    const { error } = await supabase.from('registros').insert({
      user_id: userId,
      fecha: f.fecha,
      proyecto_id: f.proyecto ? (proyectosMap.get(normalizarNombre(f.proyecto)) ?? null) : null,
      categoria_id: categoriaId,
      cliente_id: f.cliente ? (clientesMap.get(normalizarNombre(f.cliente)) ?? null) : null,
      tiempo_minutos: Number(tiempo[1]) * 60 + Number(tiempo[2]),
      detalle: f.detalle || null
    });
    if (error) errores++; else agregados++;
  }
  resultadoImportacion(agregados, omitidos, errores);
}

function resultadoImportacion(agregados: number, omitidos: number, errores: number) {
  mostrarMensaje('importarMensaje', `<p style="color:green;">✅ Importación completada: <strong>${agregados}</strong> agregados · <strong>${omitidos}</strong> omitidos por duplicado · <strong>${errores}</strong> con errores.</p>`);
}

// ---------- INTERFAZ ----------
export async function renderExportar(container: HTMLElement) {
  establecerPeriodo();
  container.innerHTML = `
    <article>
      <h2>⇅ Exportar / Importar</h2>
      <p style="color:var(--pico-muted-color);">Intercambiá datos de EÓN mediante archivos CSV.</p>

      <section>
        <header><strong>📋 Registros</strong></header>
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:.75rem;align-items:end;">
          <label>Desde<input type="date" id="exportDesde" value="${registrosDesde}"></label>
          <label>Hasta<input type="date" id="exportHasta" value="${registrosHasta}"></label>
          <label>Ordenar por
            <select id="exportOrdenCampo">
              <option value="fecha">Fecha</option><option value="proyecto">Proyecto</option><option value="categoria">Categoría</option><option value="cliente">Cliente</option><option value="tiempo">Tiempo</option><option value="detalle">Detalle</option>
            </select>
          </label>
          <label>Orden
            <select id="exportOrdenDireccion"><option value="desc">Mayor → menor</option><option value="asc">Menor → mayor</option></select>
          </label>
        </div>
        <div style="display:flex;gap:.5rem;flex-wrap:wrap;margin-top:.75rem;">
          <button type="button" id="exportRegistros">⇩ Exportar CSV</button>
          <button type="button" id="importRegistros" class="secondary">⇧ Importar CSV</button>
          <button type="button" id="modeloRegistros" class="secondary outline">↓ Descargar modelo CSV</button>
        </div>
      </section>

      <section>
        <header><strong>🏷️ Categorías</strong></header>
        <div style="display:flex;gap:.5rem;flex-wrap:wrap;">
          <button type="button" id="exportCategorias">⇩ Exportar CSV</button><button type="button" id="importCategorias" class="secondary">⇧ Importar CSV</button><button type="button" id="modeloCategorias" class="secondary outline">↓ Descargar modelo CSV</button>
        </div>
      </section>

      <section>
        <header><strong>📁 Proyectos</strong></header>
        <div style="display:flex;gap:.5rem;flex-wrap:wrap;">
          <button type="button" id="exportProyectos">⇩ Exportar CSV</button><button type="button" id="importProyectos" class="secondary">⇧ Importar CSV</button><button type="button" id="modeloProyectos" class="secondary outline">↓ Descargar modelo CSV</button>
        </div>
      </section>

      <section>
        <header><strong>👤 Clientes</strong></header>
        <div style="display:flex;gap:.5rem;flex-wrap:wrap;">
          <button type="button" id="exportClientes">⇩ Exportar CSV</button><button type="button" id="importClientes" class="secondary">⇧ Importar CSV</button><button type="button" id="modeloClientes" class="secondary outline">↓ Descargar modelo CSV</button>
        </div>
      </section>

      <div id="exportarMensaje" style="margin-top:1rem;"></div>
      <div id="importarMensaje" style="margin-top:.5rem;"></div>
    </article>
  `;

  const desde = document.getElementById('exportDesde') as HTMLInputElement;
  const hasta = document.getElementById('exportHasta') as HTMLInputElement;
  const campo = document.getElementById('exportOrdenCampo') as HTMLSelectElement;
  const direccion = document.getElementById('exportOrdenDireccion') as HTMLSelectElement;
  campo.value = registrosOrdenCampo;
  direccion.value = registrosOrdenAsc ? 'asc' : 'desc';

  desde.addEventListener('change', () => registrosDesde = desde.value);
  hasta.addEventListener('change', () => registrosHasta = hasta.value);
  campo.addEventListener('change', () => registrosOrdenCampo = campo.value);
  direccion.addEventListener('change', () => registrosOrdenAsc = direccion.value === 'asc');

  document.getElementById('exportRegistros')?.addEventListener('click', exportarRegistros);
  document.getElementById('importRegistros')?.addEventListener('click', () => abrirSelectorArchivo('registros'));
  document.getElementById('exportCategorias')?.addEventListener('click', () => exportarCatalogo('categorias'));
  document.getElementById('importCategorias')?.addEventListener('click', () => abrirSelectorArchivo('categorias'));
  document.getElementById('exportProyectos')?.addEventListener('click', () => exportarCatalogo('proyectos'));
  document.getElementById('importProyectos')?.addEventListener('click', () => abrirSelectorArchivo('proyectos'));
  document.getElementById('exportClientes')?.addEventListener('click', () => exportarCatalogo('clientes'));
  document.getElementById('importClientes')?.addEventListener('click', () => abrirSelectorArchivo('clientes'));

  (['Registros', 'Categorias', 'Proyectos', 'Clientes'] as const).forEach(nombre => {
    document.getElementById(`modelo${nombre}`)?.addEventListener('click', () => descargarModelo(nombre === 'Categorias' ? 'categorias' : nombre.toLowerCase() as any));
  });
}
