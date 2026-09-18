/**
 * ============================================================
 * EÓN — AUTENTICACIÓN (auth.ts)
 * ============================================================
 *
 * Este archivo concentra las llamadas de autenticación a
 * Supabase. Las pantallas no deberían implementar directamente
 * estas operaciones si pueden reutilizar estas funciones.
 *
 * ÍNDICE DE FUNCIONES
 * ------------------------------------------------------------
 * 01. registrarUsuario()
 * 02. iniciarSesion()
 * 03. enviarResetPassword()
 * 04. actualizarPassword()
 * 05. cerrarSesion()
 * 06. obtenerSesion()
 * ============================================================
 */

import { supabase } from './lib/supabase';

// Registrar usuario
// ------------------------------------------------------------
// 01. REGISTRAR USUARIO
// ------------------------------------------------------------
export async function registrarUsuario(email: string, password: string) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
  });
  if (error) throw error;
  return data;
}

// Iniciar sesión
// ------------------------------------------------------------
// 02. INICIAR SESIÓN
// ------------------------------------------------------------
export async function iniciarSesion(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  if (error) throw error;
  return data;
}

// Solicitar email de recuperación de contraseña
// ------------------------------------------------------------
// 03. RECUPERACIÓN DE CONTRASEÑA
// ------------------------------------------------------------
export async function enviarResetPassword(email: string) {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: window.location.origin,
  });
  if (error) throw error;
}

// Actualizar contraseña (usado tras seguir el link de recuperación)
// ------------------------------------------------------------
// 04. CAMBIO DE CONTRASEÑA
// ------------------------------------------------------------
export async function actualizarPassword(nuevaPassword: string) {
  const { error } = await supabase.auth.updateUser({ password: nuevaPassword });
  if (error) throw error;
}

// Cerrar sesión
// ------------------------------------------------------------
// 05. CERRAR SESIÓN
// ------------------------------------------------------------
export async function cerrarSesion() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

// Obtener sesión actual
// ------------------------------------------------------------
// 06. OBTENER SESIÓN
// ------------------------------------------------------------
export async function obtenerSesion() {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  return data;
}