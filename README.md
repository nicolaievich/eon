# EÓN ⏳

**EÓN — App de Registro de Tiempos**

EÓN es una aplicación web pequeña para registrar rápidamente en qué se utiliza el tiempo de trabajo y, posteriormente, poder analizarlo.

> **Registrar → hacer consciente → analizar → optimizar.**

La idea central es que registrar un trabajo lleve muy pocos segundos y que esos datos después puedan convertirse en información útil.

---

## Estado actual

**Versión funcional: 1.5.4**

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

**El segundo número identifica nuevas funciones; el tercer número identifica correcciones y mejoras menores de la versión funcional.**

---

## Funciones actuales

### Registrar tiempo

Permite registrar:

- Fecha.
- Proyecto.
- Categoría.
- Cliente.
- Tiempo en formato `HH:MM`.
- Detalle.

Incluye un timer integrado. El timer mide segundos internamente para mostrar actividad en vivo, pero la base de datos guarda únicamente minutos.

Después de guardar correctamente un registro, el formulario queda preparado para cargar el siguiente: se limpia categoría, tiempo y detalle, mientras se conservan la fecha actual y los valores predeterminados de proyecto y cliente.

Las categorías utilizan el color que ya está almacenado en Supabase. En `Registrar`, un selector visual propio muestra cada categoría con su indicador de color y mantiene el identificador de la categoría para guardar el registro normalmente.

### Ver registros

Permite:

- Consultar registros por período.
- Buscar por texto.
- Ordenar por fecha, proyecto, categoría, cliente, tiempo o detalle.
- Ver cantidad de registros y total de tiempo.
- Exportar a CSV.

### Editar registros

Desde la pantalla de registros se puede editar un registro existente mediante un formulario simple.

Son editables:

- Fecha.
- Proyecto.
- Categoría.
- Cliente.
- Tiempo `HH:MM`.
- Detalle.

El identificador del registro y `user_id` no se editan desde la interfaz. La actualización se filtra además por el usuario autenticado; la protección real debe estar garantizada por las políticas RLS de Supabase.

### Resumen de horas

La pantalla de registros muestra un resumen independiente de los filtros de la tabla:

- Horas registradas hoy.
- Horas registradas en la semana actual, de lunes a domingo.
- Horas registradas en el mes actual.
- Detalle del mes corriente agrupado por categoría.

El detalle por categoría se ordena de mayor a menor cantidad de minutos registrados.

### Exportar / Importar CSV

La versión 1.5 incorpora una sección específica para intercambio de datos mediante CSV.

Permite exportar e importar:

- Registros.
- Categorías.
- Proyectos.
- Clientes.

Características de la importación:

- La importación agrega datos; no sobrescribe registros existentes.
- Los catálogos duplicados por nombre se omiten sin distinguir mayúsculas y minúsculas.
- Los registros importados no se consideran duplicados: cada fila válida se agrega.
- Las líneas que comienzan con `#` son comentarios y no se importan.
- Se pueden descargar modelos CSV de cada tipo con ejemplos comentados.
- Los registros pueden exportarse por período y ordenarse antes de la exportación.

La versión `1.5.1` corrige un error de compilación provocado por una declaración de TypeScript no utilizada en el módulo de exportación/importación.

---

## Arquitectura

```text
src/
├── main.ts
├── auth.ts
├── lib/
│   └── supabase.ts
└── pages/
    ├── registrar.ts
    ├── registros.ts
    ├── exportar.ts
    └── config.ts
```

La aplicación está organizada por responsabilidades simples:

- `main.ts`: navegación.
- `auth.ts`: autenticación.
- `lib/supabase.ts`: conexión con Supabase.
- `registrar.ts`: carga y guardado de tiempos.
- `registros.ts`: consulta, resumen y edición.
- `exportar.ts`: exportación, importación y modelos CSV.
- `config.ts`: proyectos, categorías, clientes y valores predeterminados.

---

## Stack

- Vite.
- TypeScript.
- Supabase.
- Pico CSS.
- Cloudflare para despliegue.

---

## Modelo de datos

La tabla principal `registros` utiliza relaciones con:

- usuarios.
- proyectos.
- categorías.
- clientes.

Los registros contienen, conceptualmente:

```text
id
user_id
cliente_id
proyecto_id
categoria_id
fecha
tiempo_minutos
detalle
created_at
updated_at
```

El tiempo se almacena como minutos enteros para evitar ambigüedades de segundos y facilitar análisis posteriores.

---

## Seguridad

La aplicación trabaja con autenticación de Supabase y limita las consultas por usuario autenticado.

El filtro `user_id` utilizado desde el frontend no debe considerarse la frontera de seguridad. Las políticas **Row Level Security (RLS)** de Supabase deben impedir que un usuario pueda leer o modificar registros pertenecientes a otro usuario.

Nunca deben exponerse en el frontend:

- contraseñas.
- claves service-role.
- contraseñas de base de datos.
- tokens privados.

La URL de Supabase y la clave `anon/public` están diseñadas para ser utilizadas por aplicaciones cliente; la seguridad de los datos depende de la configuración de autenticación y RLS.

---

## Criterio de desarrollo

EÓN se desarrolla de forma incremental:

**Definir → inspeccionar → modificar → probar → commit → desplegar → verificar → documentar.**

Cada versión funcional debe agregar una función concreta sin convertir la aplicación en un sistema innecesariamente complejo.

La prioridad es:

1. Velocidad de registro.
2. Datos estructurados.
3. Seguridad por usuario.
4. Código comprensible.
5. Análisis posterior.

---

## Roadmap conceptual

El ciclo funcional actual es:

**Registrar → Ver → Exportar → Importar → Editar → Analizar.**

Las próximas funciones pueden enfocarse en análisis y visualización, siempre manteniendo la interfaz pequeña y orientada al trabajo cotidiano.
