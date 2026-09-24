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
import { iniciarSesion, registrarUsuario, cerrarSesion, obtenerSesion, enviarResetPassword, reenviarConfirmacion, actualizarPassword } from './auth';
import { supabase } from './lib/supabase';

const app = document.getElementById('app');
let usuarioActual: any = null;
let vistaActual: 'registrar' | 'registros' | 'config' | 'exportar' | 'grafico' = 'registrar';

// ------------------------------------------------------------
// 01. PANTALLA DE LOGIN
// ------------------------------------------------------------
function renderLogin() {
  if (!app) return;
  app.innerHTML = `
    <main class="container" style="max-width: 400px; margin-top: 3rem;">
      <h1 style="text-align: center;"><img src="/favicon.svg?v=1.8.2" alt="" style="width:1.2em;height:1.2em;vertical-align:-0.18em;"> EÓN <small style="font-size:.45em;color:var(--pico-muted-color);font-weight:normal;">v1.8.2</small></h1>
      <p style="text-align: center; color: var(--pico-muted-color);">Registro de tiempos</p>
      <article>
        <h2>Iniciar sesión</h2>
        <form id="loginForm">
          <label>Email<input type="email" id="loginEmail" placeholder="tu@email.com" required></label>
          <label>Contraseña<input type="password" id="loginPassword" placeholder="••••••••" required></label>
          <label style="display:flex;align-items:center;gap:.5rem;"><input type="checkbox" id="mostrarLoginPassword" style="margin:0;">Ver contraseña</label>
          <button type="submit" style="width:100%;">Iniciar sesión</button>
        </form>
        <p style="text-align:center;margin-top:.5rem;"><a href="#" id="olvideClave">¿Olvidaste tu contraseña?</a></p>
        <p style="text-align:center;margin-top:.5rem;"><a href="#" id="noConfirme">¿No confirmaste tu correo?</a></p>
        <hr>
        <details>
          <summary>¿No tenés cuenta? Registrate</summary>
          <form id="registerForm">
            <label>Email<input type="email" id="registerEmail" placeholder="tu@email.com" required></label>
            <label>Contraseña<input type="password" id="registerPassword" minlength="6" required></label>
            <label>Repetir contraseña<input type="password" id="registerPasswordConfirm" minlength="6" required></label>
            <label style="display:flex;align-items:center;gap:.5rem;"><input type="checkbox" id="mostrarRegisterPassword" style="margin:0;">Ver contraseña</label>
            <button type="submit" style="width:100%;" class="secondary">Registrarme</button>
          </form>
        </details>
        <div id="authMessage" style="margin-top:1rem;"></div>
      </article>
    </main>`;
  document.getElementById('loginForm')?.addEventListener('submit', handleLogin);
  document.getElementById('registerForm')?.addEventListener('submit', handleRegister);

  document.getElementById('mostrarLoginPassword')?.addEventListener('change', e => {
    const p = document.getElementById('loginPassword') as HTMLInputElement;
    p.type = (e.target as HTMLInputElement).checked ? 'text' : 'password';
  });
  document.getElementById('mostrarRegisterPassword')?.addEventListener('change', e => {
    const mostrar = (e.target as HTMLInputElement).checked;
    (document.getElementById('registerPassword') as HTMLInputElement).type = mostrar ? 'text' : 'password';
    (document.getElementById('registerPasswordConfirm') as HTMLInputElement).type = mostrar ? 'text' : 'password';
  });

  document.getElementById('olvideClave')?.addEventListener('click', async e => {
    e.preventDefault();
    const email = (document.getElementById('loginEmail') as HTMLInputElement).value.trim();
    const message = document.getElementById('authMessage');
    if (!message) return;
    if (!email) { message.innerHTML = '<p style="color:var(--pico-del-color);">Escribí tu email arriba primero.</p>'; return; }
    try {
      await enviarResetPassword(email);
      message.innerHTML = '<article><strong>📩 Revisá tu correo.</strong><br>Te enviamos un enlace para cambiar tu contraseña. Si no aparece, revisá Spam o Correo no deseado.</article>';
    } catch (error: any) {
      message.innerHTML = '<p style="color:var(--pico-del-color);">No pudimos enviar el correo. Revisá el email e intentá nuevamente.</p>';
    }
  });

  document.getElementById('noConfirme')?.addEventListener('click', async e => {
    e.preventDefault();
    const email = (document.getElementById('loginEmail') as HTMLInputElement).value.trim();
    const message = document.getElementById('authMessage');
    if (!message) return;
    if (!email) {
      message.innerHTML = '<article><strong>📩 Confirmá tu correo</strong><br>Escribí arriba el email con el que te registraste y después volvé a tocar este enlace.</article>';
      return;
    }
    try {
      await reenviarConfirmacion(email);
      message.innerHTML = '<article><strong>📩 Correo de confirmación reenviado</strong><br>Revisá tu bandeja de entrada y también <strong>Spam / Correo no deseado / Promociones</strong>.<br><small>Buscá un mensaje de EÓN y tocá el botón para confirmar tu cuenta.</small></article>';
    } catch (error: any) {
      message.innerHTML = '<article><strong>No pudimos reenviar el correo.</strong><br>Comprobá que el email sea el mismo con el que te registraste e intentá nuevamente.</article>';
    }
  });
}
// ------------------------------------------------------------
// 02. RECUPERACIÓN DE CONTRASEÑA
// ------------------------------------------------------------
function renderNuevaPassword() {
  if (!app) return;
  app.innerHTML = `<main class="container" style="max-width:400px;margin-top:3rem;"><h1 style="text-align:center;"><img src="/favicon.svg?v=1.8.1" alt="" style="width:1.2em;height:1.2em;vertical-align:-0.18em;"> EÓN <small style="font-size:.45em;color:var(--pico-muted-color);font-weight:normal;">v1.8.2</small></h1><article><h2>Elegí tu nueva contraseña</h2>
    <form id="nuevaPasswordForm"><label>Nueva contraseña<input type="password" id="nuevaPassword" minlength="6" required></label><label>Repetir contraseña<input type="password" id="nuevaPasswordConfirm" minlength="6" required></label>
    <label style="display:flex;align-items:center;gap:.5rem;"><input type="checkbox" id="mostrarNuevaPassword" style="margin:0;">Ver contraseña</label><button type="submit" style="width:100%;">Guardar nueva contraseña</button></form><div id="nuevaPasswordMensaje" style="margin-top:1rem;"></div></article></main>`;
  document.getElementById('mostrarNuevaPassword')?.addEventListener('change', e => { const m=(e.target as HTMLInputElement).checked; (document.getElementById('nuevaPassword') as HTMLInputElement).type=m?'text':'password'; (document.getElementById('nuevaPasswordConfirm') as HTMLInputElement).type=m?'text':'password'; });
  document.getElementById('nuevaPasswordForm')?.addEventListener('submit', async e => { e.preventDefault(); const nueva=(document.getElementById('nuevaPassword') as HTMLInputElement).value; const confirm=(document.getElementById('nuevaPasswordConfirm') as HTMLInputElement).value; const msg=document.getElementById('nuevaPasswordMensaje'); if(!msg)return; if(nueva!==confirm){msg.innerHTML='<p style="color:red;">❌ Las contraseñas no coinciden</p>';return;} try{await actualizarPassword(nueva);msg.innerHTML='<p style="color:green;">✅ Contraseña actualizada. Ya podés usar la app.</p>';setTimeout(()=>verificarSesion(),1200);}catch(error:any){msg.innerHTML=`<p style="color:red;">❌ ${error.message}</p>`;} });
}

// ------------------------------------------------------------
// 03. APLICACIÓN PRINCIPAL Y NAVEGACIÓN
// ------------------------------------------------------------
function renderApp() {
  if (!app) return;
  app.innerHTML = `
    <style>
      /* ======================================================
       * EÓN 1.8.1 — NAVEGACIÓN RESPONSIVE
       * ======================================================
       *
       * En móviles, el enlace "⇅ Exportar / Importar" podía
       * quedar parcialmente fuera del viewport porque PicoCSS
       * intenta mantener la navegación en una sola línea.
       *
       * La solución es exclusivamente CSS:
       * - la navegación permite wrapping;
       * - cada enlace puede ocupar el ancho disponible;
       * - debajo de 480px usamos una columna para garantizar que
       *   ningún botón desborde horizontalmente.
       *
       * No se modifica la lógica ni el comportamiento SPA.
       * ====================================================== */
      .eon-header{display:flex;justify-content:space-between;align-items:center;gap:1rem;padding:1rem 0;border-bottom:1px solid var(--pico-muted-border-color);position:relative;}
      .eon-logo{margin:0;display:flex;align-items:center;gap:.35rem;min-width:0;}
      .eon-account{position:relative;margin:0;}
      .eon-account summary{list-style:none;cursor:pointer;width:2.8rem;height:2.8rem;display:grid;place-items:center;border-radius:50%;font-size:1.55rem;padding:0;margin:0;}
      .eon-account summary::-webkit-details-marker{display:none;}
      .eon-account summary:hover{background:var(--pico-secondary-background);}
      .eon-account-menu{position:absolute;right:0;top:calc(100% + .45rem);z-index:1000;min-width:250px;max-width:calc(100vw - 2rem);padding:.85rem;background:var(--pico-background-color);border:1px solid var(--pico-muted-border-color);border-radius:var(--pico-border-radius);box-shadow:var(--pico-box-shadow);}
      .eon-account-email{display:block;margin-bottom:.7rem;overflow-wrap:anywhere;font-size:.95rem;}

      /* Navegación: nunca debe generar overflow horizontal. */
      .eon-nav{margin-top:1rem;width:100%;overflow:visible;}
      .eon-nav ul{display:flex;flex-wrap:wrap;gap:.7rem;row-gap:.7rem;width:100%;margin:0;padding:0;}
      .eon-nav li{min-width:0;flex:1 1 auto;margin:0;}
      .eon-nav a{display:flex;align-items:center;justify-content:center;box-sizing:border-box;max-width:100%;white-space:normal;overflow-wrap:anywhere;text-align:center;}

      @media (max-width:480px){
        .eon-header{padding:.8rem 0;}
        .eon-logo small{font-size:.38em;}
        .eon-account-menu{right:-.25rem;min-width:220px;}
        /* En móvil, cada botón tiene una fila propia. */
        .eon-nav ul{display:grid;grid-template-columns:minmax(0,1fr);gap:.55rem;}
        .eon-nav li,.eon-nav a{width:100%;min-width:0;}
      }
    </style>
    <main class="container">
      <header class="eon-header">
        <h1 class="eon-logo"><img src="/favicon.svg?v=1.8.1" alt="" style="width:1.15em;height:1.15em;"> EÓN <small style="font-size:.42em;color:var(--pico-muted-color);font-weight:normal;">v1.8.2</small></h1>
        <details class="eon-account">
          <summary aria-label="Abrir cuenta" title="Cuenta">👤</summary>
          <div class="eon-account-menu">
            <span class="eon-account-email">${usuarioActual?.email || 'Usuario'}</span>
            <button id="logoutBtn" class="contrast">Cerrar sesión</button>
          </div>
        </details>
      </header>
    <nav class="eon-nav"><ul>
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
async function handleLogin(e:Event){
  e.preventDefault();
  const email=(document.getElementById('loginEmail') as HTMLInputElement).value.trim();
  const password=(document.getElementById('loginPassword') as HTMLInputElement).value;
  const message=document.getElementById('authMessage');
  if(!message)return;
  try{
    await iniciarSesion(email,password);
    message.innerHTML='<p style="color:green;">✅ Sesión iniciada</p>';
    verificarSesion();
  }catch(error:any){
    const texto=String(error?.message || '').toLowerCase();
    if(texto.includes('email not confirmed') || texto.includes('email_not_confirmed')){
      message.innerHTML='<article><strong>📩 Tu correo todavía no está confirmado.</strong><br>Revisá tu bandeja de entrada y también <strong>Spam / Correo no deseado / Promociones</strong>.<br><br><button type="button" id="reenviarDesdeError" class="secondary">Reenviar correo de confirmación</button></article>';
      document.getElementById('reenviarDesdeError')?.addEventListener('click', async()=>{
        try{await reenviarConfirmacion(email);message.innerHTML='<article><strong>📩 Correo reenviado.</strong><br>Revisá también Spam / Correo no deseado / Promociones.</article>';}
        catch{message.innerHTML='<article>No pudimos reenviar el correo. Verificá el email e intentá nuevamente.</article>';}
      });
    }else{
      message.innerHTML='<p style="color:var(--pico-del-color);">No pudimos iniciar sesión. Revisá tu email y contraseña.</p>';
    }
  }
}
async function handleRegister(e:Event){
  e.preventDefault();
  const email=(document.getElementById('registerEmail') as HTMLInputElement).value.trim();
  const password=(document.getElementById('registerPassword') as HTMLInputElement).value;
  const confirm=(document.getElementById('registerPasswordConfirm') as HTMLInputElement).value;
  const message=document.getElementById('authMessage');
  if(!message)return;
  if(password!==confirm){message.innerHTML='<p style="color:var(--pico-del-color);">Las contraseñas no coinciden.</p>';return;}
  try{
    const data=await registrarUsuario(email,password);
    if(data.session){
      message.innerHTML='<p style="color:green;">✅ Cuenta creada. Sesión iniciada.</p>';
      verificarSesion();
    }else{
      message.innerHTML='<article><strong>✅ Cuenta creada.</strong><br>Te enviamos un correo a <strong>'+email+'</strong> para confirmar tu cuenta.<br><br>📩 <strong>Revisá también Spam / Correo no deseado / Promociones.</strong><br><br><button type="button" id="reenviarRegistro" class="secondary">Reenviar correo de confirmación</button></article>';
      document.getElementById('reenviarRegistro')?.addEventListener('click',async()=>{
        try{await reenviarConfirmacion(email);message.innerHTML='<article><strong>📩 Correo reenviado.</strong><br>Revisá tu bandeja de entrada y también Spam / Correo no deseado / Promociones.</article>';}
        catch{message.innerHTML='<article>No pudimos reenviar el correo. Esperá unos segundos e intentá nuevamente.</article>';}
      });
    }
    (document.getElementById('registerPassword') as HTMLInputElement).value='';
    (document.getElementById('registerPasswordConfirm') as HTMLInputElement).value='';
  }catch(error:any){
    message.innerHTML='<p style="color:var(--pico-del-color);">No pudimos crear la cuenta. Si ya te registraste, probá iniciar sesión o reenviar la confirmación.</p>';
  }
}
async function handleLogout(){try{await cerrarSesion();usuarioActual=null;renderLogin();}catch(error:any){alert('Error al cerrar sesión: '+error.message);}}
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