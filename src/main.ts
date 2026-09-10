import '@picocss/pico/css/pico.min.css';
import { renderRegistrar } from './pages/registrar';
import { renderConfig } from './pages/config';
import { 
  iniciarSesion, 
  registrarUsuario, 
  cerrarSesion, 
  obtenerSesion,
  recuperarContrasena,  // ✅ NUEVA IMPORTACIÓN
  actualizarContrasena   // ✅ NUEVA IMPORTACIÓN
} from './auth';

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
            <div style="display: flex; gap: 0.5rem; align-items: center;">
              <input type="password" id="loginPassword" placeholder="••••••••" required style="flex: 1;">
              <button type="button" id="toggleLoginPassword" class="secondary" style="padding: 0.5rem;">👁️</button>
            </div>
          </label>
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
            <button type="submit" style="flex: 1; margin-right: 0.5rem;">Iniciar sesión</button>
            <button type="button" id="forgotPasswordBtn" class="contrast" style="font-size: 0.8rem;">¿Olvidaste tu contraseña?</button>
          </div>
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
              <div style="display: flex; gap: 0.5rem; align-items: center;">
                <input type="password" id="registerPassword" placeholder="••••••••" required style="flex: 1;">
                <button type="button" id="toggleRegisterPassword" class="secondary" style="padding: 0.5rem;">👁️</button>
              </div>
            </label>
            <label>
              Confirmar contraseña
              <div style="display: flex; gap: 0.5rem; align-items: center;">
                <input type="password" id="registerConfirmPassword" placeholder="••••••••" required style="flex: 1;">
                <button type="button" id="toggleRegisterConfirmPassword" class="secondary" style="padding: 0.5rem;">👁️</button>
              </div>
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
  document.getElementById('forgotPasswordBtn')?.addEventListener('click', showForgotPassword);
  
  // Botones para mostrar/ocultar contraseña
  document.getElementById('toggleLoginPassword')?.addEventListener('click', () => {
    togglePassword('loginPassword');
  });
  document.getElementById('toggleRegisterPassword')?.addEventListener('click', () => {
    togglePassword('registerPassword');
  });
  document.getElementById('toggleRegisterConfirmPassword')?.addEventListener('click', () => {
    togglePassword('registerConfirmPassword');
  });
}

// ✅ NUEVO: Mostrar formulario de recuperación de contraseña
function showForgotPassword() {
  const message = document.getElementById('authMessage');
  if (!message) return;
  
  // Ocultar los formularios de login/registro
  const loginForm = document.getElementById('loginForm');
  const registerDetails = document.querySelector('details');
  if (loginForm) loginForm.style.display = 'none';
  if (registerDetails) registerDetails.style.display = 'none';
  
  message.innerHTML = `
    <div style="margin-top: 1rem; padding: 1rem; border: 1px solid var(--pico-muted-border-color); border-radius: 8px;">
      <h3>🔑 Recuperar contraseña</h3>
      <p style="color: var(--pico-muted-color); font-size: 0.9rem;">Te enviaremos un enlace para restablecer tu contraseña.</p>
      <form id="forgotPasswordForm">
        <label>
          Email
          <input type="email" id="resetEmail" placeholder="tu@email.com" required>
        </label>
        <div style="display: flex; gap: 0.5rem;">
          <button type="submit" class="secondary" style="flex: 1;">Enviar enlace</button>
          <button type="button" id="backToLoginBtn" class="contrast">Volver</button>
        </div>
      </form>
      <div id="resetMessage" style="margin-top: 0.5rem;"></div>
    </div>
  `;
  
  document.getElementById('forgotPasswordForm')?.addEventListener('submit', handleForgotPassword);
  document.getElementById('backToLoginBtn')?.addEventListener('click', () => {
    // Restaurar la vista de login
    const loginForm = document.getElementById('loginForm');
    const registerDetails = document.querySelector('details');
    if (loginForm) loginForm.style.display = '';
    if (registerDetails) registerDetails.style.display = '';
    message.innerHTML = '';
  });
}

// ✅ NUEVO: Manejador de recuperación de contraseña
async function handleForgotPassword(e: Event) {
  e.preventDefault();
  const email = (document.getElementById('resetEmail') as HTMLInputElement).value;
  const resetMessage = document.getElementById('resetMessage');
  
  if (!resetMessage) return;
  
  try {
    await recuperarContrasena(email);
    resetMessage.innerHTML = `
      <p style="color: green;">✅ Te enviamos un enlace de recuperación.</p>
      <p style="color: var(--pico-muted-color); font-size: 0.9rem;">📧 Revisá tu bandeja de entrada (y spam) para restablecer tu contraseña.</p>
    `;
    (document.getElementById('resetEmail') as HTMLInputElement).value = '';
  } catch (error: any) {
    resetMessage.innerHTML = `<p style="color: red;">❌ ${error.message}</p>`;
  }
}

// ✅ NUEVO: Pantalla para restablecer contraseña (después del enlace)
function renderResetPassword() {
  if (!app) return;
  
  app.innerHTML = `
    <main class="container" style="max-width: 400px; margin-top: 3rem;">
      <h1 style="text-align: center;">🚀 EÓN</h1>
      <p style="text-align: center; color: var(--pico-muted-color);">Restablecer contraseña</p>
      
      <article>
        <h2>Nueva contraseña</h2>
        <form id="resetPasswordForm">
          <label>
            Nueva contraseña
            <div style="display: flex; gap: 0.5rem; align-items: center;">
              <input type="password" id="newPassword" placeholder="••••••••" required style="flex: 1;">
              <button type="button" id="toggleNewPassword" class="secondary" style="padding: 0.5rem;">👁️</button>
            </div>
          </label>
          <label>
            Confirmar contraseña
            <div style="display: flex; gap: 0.5rem; align-items: center;">
              <input type="password" id="confirmNewPassword" placeholder="••••••••" required style="flex: 1;">
              <button type="button" id="toggleConfirmNewPassword" class="secondary" style="padding: 0.5rem;">👁️</button>
            </div>
          </label>
          <button type="submit" style="width: 100%;">Actualizar contraseña</button>
        </form>
        <div id="resetPasswordMessage" style="margin-top: 1rem;"></div>
      </article>
    </main>
  `;
  
  document.getElementById('resetPasswordForm')?.addEventListener('submit', handleResetPassword);
  
  document.getElementById('toggleNewPassword')?.addEventListener('click', () => {
    togglePassword('newPassword');
  });
  document.getElementById('toggleConfirmNewPassword')?.addEventListener('click', () => {
    togglePassword('confirmNewPassword');
  });
}

// ✅ NUEVO: Manejador para actualizar contraseña
async function handleResetPassword(e: Event) {
  e.preventDefault();
  
  const newPassword = (document.getElementById('newPassword') as HTMLInputElement).value;
  const confirmNewPassword = (document.getElementById('confirmNewPassword') as HTMLInputElement).value;
  const message = document.getElementById('resetPasswordMessage');
  
  if (!message) return;
  
  if (newPassword !== confirmNewPassword) {
    message.innerHTML = '<p style="color: red;">❌ Las contraseñas no coinciden</p>';
    return;
  }
  
  if (newPassword.length < 6) {
    message.innerHTML = '<p style="color: red;">❌ La contraseña debe tener al menos 6 caracteres</p>';
    return;
  }
  
  try {
    await actualizarContrasena(newPassword);
    message.innerHTML = `
      <p style="color: green;">✅ Contraseña actualizada correctamente.</p>
      <p style="color: var(--pico-muted-color); font-size: 0.9rem;">Ahora podés iniciar sesión con tu nueva contraseña.</p>
    `;
    
    // Redirigir al login después de 3 segundos
    setTimeout(() => {
      verificarSesion();
    }, 3000);
  } catch (error: any) {
    message.innerHTML = `<p style="color: red;">❌ ${error.message}</p>`;
  }
}

// ========== FUNCIÓN PARA MOSTRAR/OCULTAR CONTRASEÑA ==========
function togglePassword(inputId: string) {
  const input = document.getElementById(inputId) as HTMLInputElement;
  if (!input) return;
  input.type = input.type === 'password' ? 'text' : 'password';
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
  const confirmPassword = (document.getElementById('registerConfirmPassword') as HTMLInputElement).value;
  const message = document.getElementById('authMessage');
  
  if (!message) return;
  
  // ✅ VALIDACIÓN: Confirmar contraseña
  if (password !== confirmPassword) {
    message.innerHTML = '<p style="color: red;">❌ Las contraseñas no coinciden</p>';
    return;
  }
  
  // Validación básica de longitud
  if (password.length < 6) {
    message.innerHTML = '<p style="color: red;">❌ La contraseña debe tener al menos 6 caracteres</p>';
    return;
  }
  
  try {
    const data = await registrarUsuario(email, password);
    
    // ✅ VERIFICAR: Si el usuario necesita confirmar email
    if (data.user?.identities?.length === 0) {
      message.innerHTML = '<p style="color: orange;">⚠️ Este email ya está registrado. Iniciá sesión.</p>';
    } else {
      // ✅ MENSAJE DE VALIDACIÓN DE MAIL
      message.innerHTML = `
        <p style="color: green;">✅ Te enviamos un correo de validación.</p>
        <p style="color: var(--pico-muted-color); font-size: 0.9rem;">📧 Revisá tu bandeja de entrada (y spam) para activar tu cuenta.</p>
      `;
      
      // Limpiar campos después del registro exitoso
      (document.getElementById('registerEmail') as HTMLInputElement).value = '';
      (document.getElementById('registerPassword') as HTMLInputElement).value = '';
      (document.getElementById('registerConfirmPassword') as HTMLInputElement).value = '';
    }
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
    
    // ✅ Verificar si estamos en modo de recuperación de contraseña
    const params = new URLSearchParams(window.location.search);
    const isResetMode = params.get('reset-password') === '';
    
    if (isResetMode) {
      renderResetPassword();
      return;
    }
    
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
