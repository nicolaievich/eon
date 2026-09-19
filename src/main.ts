/**
 * ============================================================
 * EÓN — NÚCLEO DE LA APLICACIÓN (main.ts)
 * ============================================================
 *
 * Este archivo es el ORQUESTADOR de EÓN.
 * No contiene la lógica de cada pantalla: decide qué pantalla
 * mostrar, controla la sesión y conecta la navegación.
 *
 * ÍNDICE DE FUNCIONES
 * ------------------------------------------------------------
 * 01. renderLogin()         → pantalla de inicio de sesión
 * 02. renderNuevaPassword() → cambio de contraseña
 * 03. renderApp()           → estructura principal + navegación
 * 04. handleLogin()         → iniciar sesión
 * 05. handleRegister()      → registrar usuario
 * 06. handleLogout()        → cerrar sesión
 * 07. verificarSesion()     → comprobar sesión existente
 *
 * IMPORTANTE
 * ------------------------------------------------------------
 * La aplicación es una SPA: no se recarga toda la página al
 * cambiar de sección. renderApp() reemplaza #vistaContainer
 * con la pantalla seleccionada.
 * ============================================================
 */

import '@picocss/pico/css/pico.min.css';
import { renderRegistrar } from './pages/registrar';
import { renderConfig } from './pages/config';
import { renderRegistros } from './pages/registros';
import { renderExportar } from './pages/exportar';
import { renderGrafico } from './pages/grafico';
import { iniciarSesion, registrarUsuario, cerrarSesion, obtenerSesion, enviarResetPassword, actualizarPassword } from './auth';
import { supabase } from './lib/supabase';

const app = document.getElementById('app');
let usuarioActual: any = null;
let vistaActual: 'registrar' | 'registros' | 'config' | 'exportar' | 'grafico' = 'registrar';

// ------------------------------------------------------------
// 01. PANTALLA DE LOGIN
// ------------------------------------------------------------
// Construye el formulario de acceso y registro. Los eventos se
// conectan aquí porque el DOM de esta pantalla se crea dinámicamente.
function renderLogin() {
  if (!app) return;
  app.innerHTML = `
    <main class="container" style="max-width: 400px; margin-top: 3rem;">
      <h1 style="text-align: center;"><img src="/favicon.svg?v=1.6.0" alt="" style="width:1.2em;height:1.2em;vertical-align:-0.18em;"> EÓN <small style="font-size:.45em;color:var(--pico-muted-color);font-weight:normal;">v1.6.0</small></h1><p style="text-align: center; color: var(--pico-muted-color);">Registro de tiempos</p>
      <article><h2>Iniciar sesión</h2>
        <form id="loginForm"><label>Email<input type="email" id="loginEmail" placeholder="tu@email.com" required></label>
        <label>Contraseña<input type="password" id="loginPassword" placeholder="••••••••" required></label>
        <label style="display:flex;align-items:center;gap:.5rem;"><input type="checkbox" id="mostrarLoginPassword" style="margin:0;">Ver contraseña</label>
        <button type="submit" style="width:100%;">Iniciar sesión</button></form>
        <p style="text-align:center;margin-top:.5rem;"><a href="#" id="olvideClave">¿Olvidaste tu contraseña?</a></p><hr>
        <details><summary>¿No tenés cuenta? Registrate</summary>
          <form id="registerForm"><label>Email<input type="email" id="registerEmail" placeholder="tu@email.com" required></label>
          <label>Contraseña<input type="password" id="registerPassword" minlength="6" required></label>
          <label>Repetir contraseña<input type="password" id="registerPasswordConfirm" minlength="6" required></label>
          <label style="display:flex;align-items:center;gap:.5rem;"><input type="checkbox" id="mostrarRegisterPassword" style="margin:0;">Ver contraseña</label>
          <button type="submit" style="width:100%;" class="secondary">Registrarme</button></form>
        </details><div id="authMessage" style="margin-top:1rem;"></div>
      </article>
    </main>`;
  document.getElementById('loginForm')?.addEventListener('submit', handleLogin);
  document.getElementById('registerForm')?.addEventListener('submit', handleRegister);
  document.getElementById('mostrarLoginPassword')?.addEventListener('change', e => {
    const p = document.getElementById('loginPassword') as HTMLInputElement; p.type = (e.target as HTMLInputElement).checked ? 'text' : 'password';
  });
  document.getElementById('mostrarRegisterPassword')?.addEventListener('change', e => {
    const mostrar = (e.target as HTMLInputElement).checked;
    (document.getElementById('registerPassword') as HTMLInputElement).type = mostrar ? 'text' : 'password';
    (document.getElementById('registerPasswordConfirm') as HTMLInputElement).type = mostrar ? 'text' : 'password';
  });
  document.getElementById('olvideClave')?.addEventListener('click', async e => {
    e.preventDefault(); const email = (document.getElementById('loginEmail') as HTMLInputElement).value; const message = document.getElementById('authMessage'); if (!message) return;
    if (!email) { message.innerHTML = '<p style="color:red;">❌ Escribí tu email arriba primero</p>'; return; }
    try { await enviarResetPassword(email); message.innerHTML = '<p style="color:green;">✅ Te enviamos un mail con el link para cambiar la contraseña</p>'; }
    catch (error: any) { message.innerHTML = `<p style="color:red;">❌ ${error.message}</p>`; }
  });
}

// ------------------------------------------------------------
// 02. RECUPERACIÓN DE CONTRASEÑA
// ------------------------------------------------------------
// Esta vista aparece cuando Supabase informa que el usuario llegó
// desde un enlace de recuperación.
function renderNuevaPassword() {
  if (!app) return;
  app.innerHTML = `<main class="container" style="max-width:400px;margin-top:3rem;"><h1 style="text-align:center;"><img src="/favicon.svg?v=1.6.0" alt="" style="width:1.2em;height:1.2em;vertical-align:-0.18em;"> EÓN <small style="font-size:.45em;color:var(--pico-muted-color);font-weight:normal;">v1.6.0</small></h1><article><h2>Elegí tu nueva contraseña</h2>
    <form id="nuevaPasswordForm"><label>Nueva contraseña<input type="password" id="nuevaPassword" minlength="6" required></label><label>Repetir contraseña<input type="password" id="nuevaPasswordConfirm" minlength="6" required></label>
    <label style="display:flex;align-items:center;gap:.5rem;"><input type="checkbox" id="mostrarNuevaPassword" style="margin:0;">Ver contraseña</label><button type="submit" style="width:100%;">Guardar nueva contraseña</button></form><div id="nuevaPasswordMensaje" style="margin-top:1rem;"></div></article></main>`;
  document.getElementById('mostrarNuevaPassword')?.addEventListener('change', e => { const m=(e.target as HTMLInputElement).checked; (document.getElementById('nuevaPassword') as HTMLInputElement).type=m?'text':'password'; (document.getElementById('nuevaPasswordConfirm') as HTMLInputElement).type=m?'text':'password'; });
  document.getElementById('nuevaPasswordForm')?.addEventListener('submit', async e => { e.preventDefault(); const nueva=(document.getElementById('nuevaPassword') as HTMLInputElement).value; const confirm=(document.getElementById('nuevaPasswordConfirm') as HTMLInputElement).value; const msg=document.getElementById('nuevaPasswordMensaje'); if(!msg)return; if(nueva!==confirm){msg.innerHTML='<p style="color:red;">❌ Las contraseñas no coinciden</p>';return;} try{await actualizarPassword(nueva);msg.innerHTML='<p style="color:green;">✅ Contraseña actualizada. Ya podés usar la app.</p>';setTimeout(()=>verificarSesion(),1200);}catch(error:any){msg.innerHTML=`<p style="color:red;">❌ ${error.message}</p>`;} });
}

// ------------------------------------------------------------
// 03. APLICACIÓN PRINCIPAL Y NAVEGACIÓN
// ------------------------------------------------------------
// Esta función reconstruye la estructura común y luego carga la
// pantalla elegida dentro de #vistaContainer.
function renderApp() {
  if (!app) return;
  app.innerHTML = `<main class="container"><header style="display:flex;justify-content:space-between;align-items:center;padding:1rem 0;border-bottom:1px solid var(--pico-muted-border-color);"><h1 style="margin:0;display:flex;align-items:center;gap:.35rem;"><img src="/favicon.svg?v=1.6.0" alt="" style="width:1.15em;height:1.15em;"> EÓN <small style="font-size:.42em;color:var(--pico-muted-color);font-weight:normal;">v1.6.0</small></h1><div><span style="margin-right:1rem;">👤 ${usuarioActual?.email || 'Usuario'}</span><button id="logoutBtn" class="contrast">Cerrar sesión</button></div></header>
    <nav style="margin-top:1rem;"><ul>
      <li><a href="#" id="navRegistrar" role="button" class="${vistaActual==='registrar'?'':'secondary'}">📋 Registrar</a></li>
      <li><a href="#" id="navRegistros" role="button" class="${vistaActual==='registros'?'':'secondary'}">📊 Ver registros</a></li>
      <li><a href="#" id="navConfig" role="button" class="${vistaActual==='config'?'':'secondary'}">⚙️ Configuración</a></li>
      <li><a href="#" id="navExportar" role="button" class="${vistaActual==='exportar'?'':'secondary'}">⇅ Exportar / Importar</a></li>
    </ul></nav><div id="vistaContainer" style="margin-top:1rem;"></div></main>`;
  const container=document.getElementById('vistaContainer');
  if(container){
    if(vistaActual==='registrar') renderRegistrar(container);
    else if(vistaActual==='registros') renderRegistros(container);
    else if(vistaActual==='config') renderConfig(container);
    else if(vistaActual==='exportar') renderExportar(container);
    else renderGrafico(container, periodoGrafico);
  }
  document.getElementById('logoutBtn')?.addEventListener('click',handleLogout);
  const navegar=(vista: typeof vistaActual)=>(e:Event)=>{e.preventDefault();vistaActual=vista;renderApp();};
  document.getElementById('navRegistrar')?.addEventListener('click',navegar('registrar'));
  document.getElementById('navRegistros')?.addEventListener('click',navegar('registros'));
  document.getElementById('navConfig')?.addEventListener('click',navegar('config'));
  document.getElementById('navExportar')?.addEventListener('click',navegar('exportar'));
  if (vistaActual === 'grafico') {
    document.getElementById('volverRegistros')?.addEventListener('click', () => { vistaActual = 'registros'; renderApp(); });
  }
}

// ------------------------------------------------------------
// 04. ACCESO
// ------------------------------------------------------------
async function handleLogin(e:Event){e.preventDefault();const email=(document.getElementById('loginEmail') as HTMLInputElement).value;const password=(document.getElementById('loginPassword') as HTMLInputElement).value;const message=document.getElementById('authMessage');if(!message)return;try{await iniciarSesion(email,password);message.innerHTML='<p style="color:green;">✅ Sesión iniciada</p>';verificarSesion();}catch(error:any){message.innerHTML=`<p style="color:red;">❌ ${error.message}</p>`;}}
// ------------------------------------------------------------
// 05. REGISTRO
// ------------------------------------------------------------
async function handleRegister(e:Event){e.preventDefault();const email=(document.getElementById('registerEmail') as HTMLInputElement).value;const password=(document.getElementById('registerPassword') as HTMLInputElement).value;const confirm=(document.getElementById('registerPasswordConfirm') as HTMLInputElement).value;const message=document.getElementById('authMessage');if(!message)return;if(password!==confirm){message.innerHTML='<p style="color:red;">❌ Las contraseñas no coinciden</p>';return;}try{await registrarUsuario(email,password);message.innerHTML='<p style="color:green;">✅ Registro exitoso. Ahora iniciá sesión.</p>';(document.getElementById('registerEmail') as HTMLInputElement).value='';(document.getElementById('registerPassword') as HTMLInputElement).value='';(document.getElementById('registerPasswordConfirm') as HTMLInputElement).value='';}catch(error:any){message.innerHTML=`<p style="color:red;">❌ ${error.message}</p>`;}}
async function handleLogout(){try{await cerrarSesion();usuarioActual=null;renderLogin();}catch(error:any){alert('Error al cerrar sesión: '+error.message);}}
// ------------------------------------------------------------
// 07. VERIFICACIÓN DE SESIÓN
// ------------------------------------------------------------
// Es el punto que decide si mostramos login o la aplicación.
async function verificarSesion(){if(modoRecuperacion)return;try{const session=await obtenerSesion();if(session?.session?.user){usuarioActual=session.session.user;renderApp();}else{usuarioActual=null;renderLogin();}}catch(error){console.error('Error al verificar sesión:',error);renderLogin();}}
let periodoGrafico: 'hoy' | 'semana' | 'mes' = 'hoy';
window.addEventListener('eon:ver-grafico', (e: Event) => {
  periodoGrafico = (e as CustomEvent<'hoy' | 'semana' | 'mes'>).detail;
  vistaActual = 'grafico';
  renderApp();
});
let modoRecuperacion=false;
supabase.auth.onAuthStateChange(event=>{if(event==='PASSWORD_RECOVERY'){modoRecuperacion=true;renderNuevaPassword();}});
verificarSesion();