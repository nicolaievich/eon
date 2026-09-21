# EÓN ⏳

**EÓN — App de Registro de Tiempos**

EÓN es una aplicación web pequeña para registrar rápidamente en qué se utiliza el tiempo de trabajo y, posteriormente, poder analizarlo.

> **Registrar → hacer consciente → analizar → optimizar.**

La idea central es que registrar un trabajo lleve muy pocos segundos y que esos datos después puedan convertirse en información útil.

---

## Estado actual

**Versión funcional: 1.7.1 (rama beta)**

EÓN utiliza una numeración funcional simple:

- `1.0` → versión base.
- `1.1` → nueva función.
- `1.1.1` → corrección de la versión 1.1.
- `1.1.2` → otra corrección.
- `1.2` → siguiente nueva función.
- `1.3` → siguiente nueva función.
- `1.4` → siguiente nueva función.
- `1.5` → nuevas funciones de exportación e importación CSV.
- `1.5.1` → corrección de compilación de la versión 1.5.
- `1.5.2` → mejoras del formulario de registro: limpieza automática después de guardar e identificación visual de categorías por color.
- `1.5.3` → corrección del selector de categorías para mostrar correctamente los colores guardados en Supabase.
- `1.5.4` → corrección visual del selector de categorías: fondo blanco y texto negro en las opciones.
- `1.5.5` → mejora visual del resumen.
- `1.5.7` → corrección del cálculo del resumen de horas.
- `1.5.8` → eliminación del módulo de resumen duplicado basado en MutationObserver/Chart.js y consolidación del resumen en `registros.ts`, con consultas independientes para HOY, ESTA SEMANA y ESTE MES.
- `1.6.0` → edición de categorías con efecto retroactivo sobre todos los registros asociados a esa categoría.\n- `1.7.0` → buscadores dinámicos para proyectos y clientes en Registrar, Configuración y edición de registros.
- `1.7.1` → reorganización de Configuración como menú de administración: Categorías, Clientes y Proyectos pasan a pantallas independientes con explicación de uso y botón visible «← Volver a Configuración». Se conserva la lógica existente de búsqueda, presentación, alta, edición y activación/desactivación; las categorías por defecto se administran desde Categorías.

**El segundo número identifica nuevas funciones; el tercer número identifica correcciones y mejoras menores de la versión funcional.**

---


## 1.7.1 — Configuración reorganizada

La versión 1.7.1 reorganiza la experiencia de Configuración sin modificar el modelo de datos ni la lógica de los catálogos existentes.

### Estructura
- **Configuración**: pantalla principal que explica el propósito de cada área y permite entrar a Categorías, Clientes o Proyectos.
- **Categorías**: administra las categorías, incluidas las categorías por defecto de EÓN. Conserva alta y edición, incluido el efecto retroactivo del cambio sobre los registros relacionados.
- **Clientes**: administra el alta y la consulta de clientes, conservando su presentación y datos actuales.
- **Proyectos**: administra el alta y el estado activo/inactivo de los proyectos, conservando los datos históricos.
- **Valores por defecto**: permanece en la pantalla principal y conserva los buscadores dinámicos de proyecto y cliente.

Cada pantalla de catálogo incluye una explicación breve de para qué sirve y un botón visible **← Volver a Configuración**.

**Criterio de versionado:** 1.7.1 se considera una mejora menor de la funcionalidad introducida en 1.7.0: no agrega un módulo de datos nuevo, sino que reorganiza y documenta visualmente la configuración existente.
