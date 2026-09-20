# EÓN ⏳

**EÓN — App de Registro de Tiempos**

EÓN es una aplicación web pequeña para registrar rápidamente en qué se utiliza el tiempo de trabajo y, posteriormente, poder analizarlo.

> **Registrar → hacer consciente → analizar → optimizar.**

La idea central es que registrar un trabajo lleve muy pocos segundos y que esos datos después puedan convertirse en información útil.

---

## Estado actual

**Versión funcional: 1.6.0**

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
- `1.6.0` → edición de categorías con efecto retroactivo sobre todos los registros asociados a esa categoría.

**El segundo número identifica nuevas funciones; el tercer número identifica correcciones y mejoras menores de la versión funcional.**

---
