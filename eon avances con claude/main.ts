import '@picocss/pico';
import { renderRegistrar } from './pages/registrar';
import { renderConfig } from './pages/config';
import { iniciarSesion, registrarUsuario, cerrarSesion, obtenerSesion } from './auth';

const app = document.getElementById('app');
let usuarioActual: any = null;
let vistaActual: 'registrar' | 'config' = 'registrar';

// ========== PANTALLA DE LOGIN ==========
function renderLogin() {
  if (!app) return;
  
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
          <button type="submit" style="width: 100%;">Iniciar sesión</button>
        </form>
        
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
              <input type="password" id="registerPassword" placeholder="••••••••" required>
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
}

// ========== PANTALLA PRINCIPAL ==========
function renderApp() {
  if (!app) return;

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
          <li><a href="#" id="navConfig" role="button" class="${vistaActual === 'config' ? '' : 'secondary'}">⚙️ Configuración</a></li>
        </ul>
      </nav>

      <div id="vistaContainer" style="margin-top: 1rem;"></div>
    </main>
  `;

  const container = document.getElementById('vistaContainer');
  if (container) {
    if (vistaActual === 'registrar') renderRegistrar(container);
    else renderConfig(container);
  }

  document.getElementById('logoutBtn')?.addEventListener('click', handleLogout);
  document.getElementById('navRegistrar')?.addEventListener('click', (e) => {
    e.preventDefault();
    vistaActual = 'registrar';
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
    verificarSesion(); // Recargar UI
  } catch (error: any) {
    message.innerHTML = `<p style="color: red;">❌ ${error.message}</p>`;
  }
}

async function handleRegister(e: Event) {
  e.preventDefault();
  const email = (document.getElementById('registerEmail') as HTMLInputElement).value;
  const password = (document.getElementById('registerPassword') as HTMLInputElement).value;
  const message = document.getElementById('authMessage');
  
  if (!message) return;
  
  try {
    await registrarUsuario(email, password);
    message.innerHTML = '<p style="color: green;">✅ Registro exitoso. Ahora iniciá sesión.</p>';
    (document.getElementById('registerEmail') as HTMLInputElement).value = '';
    (document.getElementById('registerPassword') as HTMLInputElement).value = '';
  } catch (error: any) {
    message.innerHTML = `<p style="color: red;">❌ ${error.message}</p>`;
  }
}

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
verificarSesion();
