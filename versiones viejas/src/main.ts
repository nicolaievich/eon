import '@picocss/pico';
import { renderRegistrar } from './pages/registrar';
import { iniciarSesion, registrarUsuario, cerrarSesion, obtenerSesion } from './auth';

const app = document.getElementById('app');
let usuarioActual: any = null;

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
      
      <div id="registrarContainer" style="margin-top: 2rem;"></div>
    </main>
  `;
  
  // Renderizar el formulario dentro del contenedor
  const container = document.getElementById('registrarContainer');
  if (container) {
    renderRegistrar(container);
  }
  
  document.getElementById('logoutBtn')?.addEventListener('click', handleLogout);
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
