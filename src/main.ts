import '@picocss/pico/css/pico.min.css';
import { renderRegistrar } from './pages/registrar';
import { renderConfig } from './pages/config';
import { renderRegistros } from './pages/registros';
import { iniciarSesion, registrarUsuario, cerrarSesion, obtenerSesion, enviarResetPassword, actualizarPassword } from './auth';
import { supabase } from './lib/supabase';

const app = document.getElementById('app');

// Usuario autenticado actualmente. Se utiliza para mostrar su email y controlar la vista.
let usuarioActual: any = null;

// EÓN actualmente tiene tres vistas principales: registrar, registros y configuración.
let vistaActual: 'registrar' | 'registros' | 'config' = 'registrar';

// ========== PANTALLA DE LOGIN ==========
function renderLogin() {
  if (!app) return;
  
  // Toda la pantalla de autenticación se construye dinámicamente para mantener
  // la aplicación como una SPA pequeña y sin necesidad de un framework adicional.
  app.innerHTML = `
    <main class="container" style="max-width: 400px; margin-top: 3rem;">
      <h1 style="text-align: center;">🚀 EÓN</h1>
      <p style="text-align: center; color: var(--pico-muted-color);">Registro de tiempos</p>
      
      <article>
        <h2>Iniciar sesión</h2>
        <form id="loginForm">
          <label>
            Email
            <input type="email" id="loginEmail" placeholder="tu@email.com" required>
          </label>
          <label>
            Contraseña
            <input type="password" id="loginPassword" placeholder="••••••••" required>
          </label>
          <label style="display: flex; align-items: center; gap: 0.5rem;">
            <input type="checkbox" id="mostrarLoginPassword" style="margin: 0;">
            Ver contraseña
          </label>
          <button type="submit" style="width: 100%;">Iniciar sesión</button>
        </form>

        <p style="text-align: center; margin-top: 0.5rem;">
          <a href="#" id="olvideClave">¿Olvidaste tu contraseña?</a>
        </p>

        <hr>
        
        <details>
          <summary>¿No tenés cuenta? Registrate</summary>
          <form id="registerForm">
            <label>
              Email
              <input type="email" id="registerEmail" placeholder="tu@email.com" required>
            </label>
            <label>
              Contraseña
              <input type="password" id="registerPassword" placeholder="••••••••" minlength="6" required>
            </label>
            <label>
              Repetir contraseña
              <input type="password" id="registerPasswordConfirm" placeholder="••••••••" minlength="6" required>
            </label>
            <label style="display: flex; align-items: center; gap: 0.5rem;">
              <input type="checkbox" id="mostrarRegisterPassword" style="margin: 0;">
              Ver contraseña
            </label>
            <button type="submit" style="width: 100%;" class="secondary">Registrarme</button>
          </form>
        </details>
        
        <div id="authMessage" style="margin-top: 1rem;"></div>
      </article>
    </main>
  `;
  
  document.getElementById('loginForm')?.addEventListener('submit', handleLogin);
  document.getElementById('registerForm')?.addEventListener('submit', handleRegister);

  // Permite ver/ocultar la contraseña del login sin modificar el valor ingresado.
  document.getElementById('mostrarLoginPassword')?.addEventListener('change', (e) => {
    const password = document.getElementById('loginPassword') as HTMLInputElement;
    password.type = (e.target as HTMLInputElement).checked ? 'text' : 'password';
  });

  // El mismo control sirve para las dos contraseñas del registro.
  document.getElementById('mostrarRegisterPassword')?.addEventListener('change', (e) => {
    const mostrar = (e.target as HTMLInputElement).checked;
    const password = document.getElementById('registerPassword') as HTMLInputElement;
    const confirmacion = document.getElementById('registerPasswordConfirm') as HTMLInputElement;
    password.type = mostrar ? 'text' : 'password';
    confirmacion.type = mostrar ? 'text' : 'password';
  });

  // El flujo de recuperación toma el email escrito en el formulario de login.
  document.getElementById('olvideClave')?.addEventListener('click', async (e) => {
    e.preventDefault();
    const email = (document.getElementById('loginEmail') as HTMLInputElement).value;
    const message = document.getElementById('authMessage');
    if (!message) return;
    if (!email) {
      message.innerHTML = '<p style="color: red;">❌ Escribí tu email arriba primero</p>';
      return;
    }
    try {
      await enviarResetPassword(email);
      message.innerHTML = '<p style="color: green;">✅ Te enviamos un mail con el link para cambiar la contraseña</p>';
    } catch (error: any) {
      // El mensaje se muestra al usuario; no exponemos datos de configuración local.
      message.innerHTML = `<p style="color: red;">❌ ${error.message}</p>`;
    }
  });
}

// ========== PANTALLA DE NUEVA CONTRASEÑA (tras click en el mail) ==========
function renderNuevaPassword() {
  if (!app) return;

  // Pantalla independiente para el estado PASSWORD_RECOVERY de Supabase.
  app.innerHTML = `
    <main class="container" style="max-width: 400px; margin-top: 3rem;">
      <h1 style="text-align: center;">🚀 EÓN</h1>
      <article>
        <h2>Elegí tu nueva contraseña</h2>
        <form id="nuevaPasswordForm">
          <label>
            Nueva contraseña
            <input type="password" id="nuevaPassword" placeholder="••••••••" minlength="6" required>
          </label>
          <label>
            Repetir contraseña
            <input type="password" id="nuevaPasswordConfirm" placeholder="••••••••" minlength="6" required>
          </label>
          <label style="display: flex; align-items: center; gap: 0.5rem;">
            <input type="checkbox" id="mostrarNuevaPassword" style="margin: 0;">
            Ver contraseña
          </label>
          <button type="submit" style="width: 100%;">Guardar nueva contraseña</button>
        </form>
        <div id="nuevaPasswordMensaje" style="margin-top: 1rem;"></div>
      </article>
    </main>
  `;

  // Control de visibilidad de ambas contraseñas durante la recuperación.
  document.getElementById('mostrarNuevaPassword')?.addEventListener('change', (e) => {
    const mostrar = (e.target as HTMLInputElement).checked;
    const password = document.getElementById('nuevaPassword') as HTMLInputElement;
    const confirmacion = document.getElementById('nuevaPasswordConfirm') as HTMLInputElement;
    password.type = mostrar ? 'text' : 'password';
    confirmacion.type = mostrar ? 'text' : 'password';
  });

  document.getElementById('nuevaPasswordForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const nueva = (document.getElementById('nuevaPassword') as HTMLInputElement).value;
    const confirmacion = (document.getElementById('nuevaPasswordConfirm') as HTMLInputElement).value;
    const mensaje = document.getElementById('nuevaPasswordMensaje');
    if (!mensaje) return;

    // La validación local evita una llamada innecesaria a Supabase si los valores difieren.
    if (nueva !== confirmacion) {
      mensaje.innerHTML = '<p style="color: red;">❌ Las contraseñas no coinciden</p>';
      return;
    }

    try {
      await actualizarPassword(nueva);
      mensaje.innerHTML = '<p style="color: green;">✅ Contraseña actualizada. Ya podés usar la app.</p>';
      setTimeout(() => verificarSesion(), 1200);
    } catch (error: any) {
      mensaje.innerHTML = `<p style="color: red;">❌ ${error.message}</p>`;
    }
  });
}

// ========== PANTALLA PRINCIPAL ==========
function renderApp() {
  if (!app) return;

  // Cabecera y navegación común a todas las vistas privadas de EÓN.
  app.innerHTML = `
    <main class="container">
      <header style="display: flex; justify-content: space-between; align-items: center; padding: 1rem 0; border-bottom: 1px solid var(--pico-muted-border-color);">
        <h1 style="margin: 0;">🚀 EÓN</h1>
        <div>
          <span style="margin-right: 1rem;">👤 ${usuarioActual?.email || 'Usuario'}</span>
          <button id="logoutBtn" class="contrast">Cerrar sesión</button>
        </div>
      </header>

      <nav style="margin-top: 1rem;">
        <ul>
          <li><a href="#" id="navRegistrar" role="button" class="${vistaActual === 'registrar' ? '' : 'secondary'}">📋 Registrar</a></li>
          <li><a href="#" id="navRegistros" role="button" class="${vistaActual === 'registros' ? '' : 'secondary'}">📊 Ver registros</a></li>
          <li><a href="#" id="navConfig" role="button" class="${vistaActual === 'config' ? '' : 'secondary'}">⚙️ Configuración</a></li>
        </ul>
      </nav>

      <div id="vistaContainer" style="margin-top: 1rem;"></div>
    </main>
  `;

  const container = document.getElementById('vistaContainer');
  if (container) {
    if (vistaActual === 'registrar') renderRegistrar(container);
    else if (vistaActual === 'registros') renderRegistros(container);
    else renderConfig(container);
  }

  document.getElementById('logoutBtn')?.addEventListener('click', handleLogout);

  // Cambiar de vista simplemente actualiza el estado y vuelve a renderizar el contenedor principal.
  document.getElementById('navRegistrar')?.addEventListener('click', (e) => {
    e.preventDefault();
    vistaActual = 'registrar';
    renderApp();
  });
  document.getElementById('navRegistros')?.addEventListener('click', (e) => {
    e.preventDefault();
    vistaActual = 'registros';
    renderApp();
  });
  document.getElementById('navConfig')?.addEventListener('click', (e) => {
    e.preventDefault();
    vistaActual = 'config';
    renderApp();
  });
}

// ========== MANEJADORES ==========
async function handleLogin(e: Event) {
  e.preventDefault();
  const email = (document.getElementById('loginEmail') as HTMLInputElement).value;
  const password = (document.getElementById('loginPassword') as HTMLInputElement).value;
  const message = document.getElementById('authMessage');
  
  if (!message) return;
  
  try {
    await iniciarSesion(email, password);
    message.innerHTML = '<p style="color: green;">✅ Sesión iniciada</p>';
    verificarSesion();
  } catch (error: any) {
    message.innerHTML = `<p style="color: red;">❌ ${error.message}</p>`;
  }
}

async function handleRegister(e: Event) {
  e.preventDefault();
  const email = (document.getElementById('registerEmail') as HTMLInputElement).value;
  const password = (document.getElementById('registerPassword') as HTMLInputElement).value;
  const confirmacion = (document.getElementById('registerPasswordConfirm') as HTMLInputElement).value;
  const message = document.getElementById('authMessage');
  
  if (!message) return;

  // Validación local de confirmación de contraseña.
  if (password !== confirmacion) {
    message.innerHTML = '<p style="color: red;">❌ Las contraseñas no coinciden</p>';
    return;
  }
  
  try {
    await registrarUsuario(email, password);
    message.innerHTML = '<p style="color: green;">✅ Registro exitoso. Ahora iniciá sesión.</p>';
    (document.getElementById('registerEmail') as HTMLInputElement).value = '';
    (document.getElementById('registerPassword') as HTMLInputElement).value = '';
    (document.getElementById('registerPasswordConfirm') as HTMLInputElement).value = '';
  } catch (error: any) {
    message.innerHTML = `<p style="color: red;">❌ ${error.message}</p>`;
  }
}

// Cierra la sesión en Supabase y vuelve a la pantalla pública de login.
async function handleLogout() {
  try {
    await cerrarSesion();
    usuarioActual = null;
    renderLogin();
  } catch (error: any) {
    alert('Error al cerrar sesión: ' + error.message);
  }
}

// ========== VERIFICAR SESIÓN ==========
async function verificarSesion() {
  // Durante recuperación de contraseña no reemplazamos la pantalla específica.
  if (modoRecuperacion) return;

  try {
    const session = await obtenerSesion();
    if (session?.session?.user) {
      usuarioActual = session.session.user;
      renderApp();
    } else {
      usuarioActual = null;
      renderLogin();
    }
  } catch (error) {
    console.error('Error al verificar sesión:', error);
    renderLogin();
  }
}

// ========== INICIALIZAR ==========
let modoRecuperacion = false;

// Supabase informa aquí eventos de autenticación importantes, especialmente PASSWORD_RECOVERY.
supabase.auth.onAuthStateChange((event) => {
  if (event === 'PASSWORD_RECOVERY') {
    modoRecuperacion = true;
    renderNuevaPassword();
  }
});

// Punto de entrada de la aplicación: comprobamos si existe una sesión válida.
verificarSesion();
