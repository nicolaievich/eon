# EÓN ⏳

**EÓN — App de Registro de Tiempos**

EÓN es una aplicación web pequeña para registrar rápidamente en qué se utiliza el tiempo de trabajo y, posteriormente, poder analizarlo.

> **Registrar → hacer consciente → analizar → optimizar.**

La idea central es que registrar un trabajo lleve muy pocos segundos y que esos datos después puedan convertirse en información útil.

---

## Estado actual

**Versión funcional: 1.7.3 (rama de desarrollo)**

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
- `1.7.2` → mejora del ingreso de tiempo: HH:MM se presenta como dos campos independientes con `:` fijo, validación de minutos 00–59 y selección independiente de horas/minutos; el temporizador utiliza la misma estructura. Los gráficos de categorías utilizan el color guardado en la configuración de cada categoría, sin paleta automática.\n- `1.7.3` → corrección responsive de la navegación principal en dispositivos móviles: los botones se distribuyen en filas y Exportar / Importar deja de quedar cortado por overflow horizontal.

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


## 1.7.2 — Colores de categorías y campo de tiempo robusto

### Gráficos
Los gráficos por categoría consultan ahora también el campo `color` de la tabla `categorias` y lo asignan directamente a cada segmento del gráfico. De esta manera, el color configurado para una categoría se mantiene estable en los gráficos de HOY, ESTA SEMANA y ESTE MES.

Si una categoría no tiene un color hexadecimal válido, EÓN utiliza gris como respaldo para evitar que el gráfico falle.

### Ingreso de tiempo
El campo visual `HH:MM` está compuesto por dos inputs reales: horas y minutos. El separador `:` es un elemento fijo de la interfaz y no puede borrarse.

- Horas: dos dígitos, hasta 99.
- Minutos: dos dígitos, de 00 a 59.
- Doble clic/toque sobre horas: selecciona solamente las horas.
- Doble clic/toque sobre minutos: selecciona solamente los minutos.
- El temporizador actualiza los mismos campos.
- La base de datos continúa almacenando el tiempo como minutos enteros, por lo que no cambia el modelo de datos ni los registros históricos.

### Documentación técnica
La implementación está comentada directamente en `registrar.ts` y `grafico.ts`, explicando la separación de campos, la validación y el origen de los colores. El cambio se desarrolla en la rama `eon-1.7.2-tiempo-colores` para poder compilar y probar antes de integrarlo a `main`.


## 1.7.3 — Navegación móvil responsive

### Problema corregido
En pantallas móviles, la navegación principal podía superar el ancho disponible y el cuarto botón, **Exportar / Importar**, quedaba parcialmente fuera de la pantalla.

### Solución
- Se identifica la navegación con la clase `eon-nav`.
- En escritorio se mantiene una navegación flexible.
- En pantallas de hasta 600 px se utiliza una cuadrícula de dos columnas.
- Los tres primeros accesos conservan su tamaño adaptable.
- **Exportar / Importar** ocupa toda la segunda fila.
- Se elimina el desplazamiento horizontal de la navegación en móvil.
- Los botones mantienen una altura mínima y texto centrado para facilitar el uso táctil.

### Alcance
Es una corrección exclusivamente visual/responsive. No modifica la base de datos, autenticación, registros, temporizador ni lógica de las pantallas.
