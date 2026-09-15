# EÓN ⏳

**EÓN — App de Registro de Tiempos**

EÓN es una aplicación web pequeña para registrar rápidamente en qué se utiliza el tiempo de trabajo y, posteriormente, poder analizarlo.

> **Registrar → hacer consciente → analizar → optimizar.**

La idea central no es agregar burocracia al trabajo, sino hacer que registrar un trabajo lleve muy pocos segundos y que esos datos después puedan convertirse en información útil.

---

## Estado actual

**Versión funcional: 1.1**

La numeración funcional de EÓN sigue esta convención:

- `1.0` → versión base.
- `1.1` → incorporación de una nueva función.
- `1.1.1` → corrección de un error de la versión 1.1.
- `1.1.2` → segunda corrección de esa misma versión.
- `1.2` → siguiente nueva función.

La regla es deliberadamente simple: **el segundo número identifica nuevas funciones; el tercer número identifica correcciones.**

> Nota: el `version` de `package.json` puede tener una numeración técnica propia (`0.0.0`). La versión funcional de EÓN se documenta en este README y en los commits.

---

## ¿Qué hace EÓN hoy?

### 1. Autenticación

EÓN utiliza autenticación de Supabase y permite:

- Crear una cuenta.
- Iniciar sesión.
- Cerrar sesión.
- Recuperar una contraseña mediante email.
- Cambiar la contraseña después de seguir el enlace de recuperación.
- Mostrar u ocultar las contraseñas durante el ingreso.
- Confirmar la contraseña durante registro y recuperación.

La aplicación trabaja con el usuario autenticado para asociar sus datos a su cuenta.

### 2. Registrar tiempo

La pantalla principal permite registrar:

| Campo | Estado | Descripción |
|---|---|---|
| Fecha | Obligatorio | Fecha a la que corresponde el trabajo. |
| Proyecto | Opcional | Proyecto relacionado. |
| Categoría | Obligatorio | Clasificación del trabajo. |
| Cliente | Opcional | Cliente relacionado. |
| Tiempo | Obligatorio | Formato `HH:MM:SS`. |
| Detalle | Opcional | Descripción breve de lo realizado. |

La fecha se propone automáticamente con la fecha actual.

El tiempo dispone de **timer integrado**:

- `▶ Iniciar` comienza a contar.
- `⏹ Detener` pausa el conteo.
- `↺` reinicia el tiempo.
- También es posible introducir manualmente `HH:MM:SS`.

Internamente, la versión actual almacena el tiempo en minutos. Los segundos introducidos manualmente se convierten a minutos y se redondean al guardar.

### 3. Configuración

La sección **Configuración** permite administrar los datos que se utilizan al registrar:

- Proyectos.
- Categorías.
- Clientes.
- Proyecto predeterminado.
- Cliente predeterminado.

Los proyectos pueden activarse o desactivarse sin eliminarlos, preservando así su utilidad histórica.

Los valores predeterminados se guardan por usuario en Supabase.

### 4. Ver registros — EÓN 1.1

La versión 1.1 incorpora la primera pantalla histórica de EÓN.

Incluye:

- Tabla de registros.
- Fecha, proyecto, categoría, cliente, tiempo y detalle.
- Carga inicial correspondiente al **día actual**.
- Registros ordenados inicialmente de **más reciente a más antiguo**.
- Búsqueda en vivo mientras se escribe.
- Filtro por fecha desde/hasta.
- Ordenamiento por cada columna.
- Alternancia ascendente/descendente al pulsar una columna.
- Cantidad de registros encontrados.
- Tiempo total del resultado filtrado.
- Consulta limitada al usuario autenticado.

La búsqueda se realiza sobre los datos ya cargados para que la respuesta sea inmediata. El rango de fechas se aplica directamente en la consulta a Supabase.

---

## Arquitectura

EÓN está construido como una aplicación web pequeña, sin framework frontend pesado.

### Stack

- **Vite** — desarrollo y build.
- **TypeScript** — lógica de aplicación.
- **Pico CSS** — estilos base minimalistas.
- **Supabase** — autenticación y base de datos.
- **Cloudflare** — despliegue/hosting de la aplicación.
- **GitHub** — repositorio y control de versiones.

Dependencias principales actuales:

- `vite` `^8.2.2`
- `typescript` `~6.0.2`
- `@picocss/pico` `^2.1.1`
- `@supabase/supabase-js` `^2.115.0`

---

## Estructura del proyecto

```text
src/
├── main.ts
├── auth.ts
├── lib/
│   └── supabase.ts
└── pages/
    ├── registrar.ts
    ├── registros.ts
    └── config.ts
```

### `src/main.ts`

Es el punto de entrada de la aplicación.

Se ocupa de:

- Inicializar la interfaz.
- Comprobar la sesión.
- Mostrar login o aplicación privada.
- Gestionar navegación entre Registrar, Ver registros y Configuración.
- Gestionar recuperación de contraseña.
- Mantener el usuario autenticado en memoria.

### `src/auth.ts`

Centraliza las operaciones de autenticación de Supabase:

- `registrarUsuario()`
- `iniciarSesion()`
- `enviarResetPassword()`
- `actualizarPassword()`
- `cerrarSesion()`
- `obtenerSesion()`

### `src/lib/supabase.ts`

Crea el cliente de Supabase utilizando variables de entorno Vite.

**No debe contener claves privadas ni secretos.**

### `src/pages/registrar.ts`

Implementa el registro de tiempo, la carga de proyectos/categorías/clientes, los valores predeterminados y el timer.

### `src/pages/registros.ts`

Implementa la función histórica introducida en EÓN 1.1:

1. Renderiza filtros y tabla.
2. Determina el período inicial.
3. Consulta registros del usuario.
4. Aplica filtro de búsqueda.
5. Ordena columnas.
6. Calcula el total de tiempo.
7. Renderiza el resultado.

### `src/pages/config.ts`

Implementa la administración de proyectos, categorías, clientes y valores predeterminados.

---

## Modelo conceptual de datos

La estructura prevista de EÓN gira alrededor de estas entidades:

```text
USUARIO
   │
   ├── CLIENTES
   │
   ├── PROYECTOS
   │
   ├── CATEGORÍAS
   │
   ├── CONFIGURACIÓN
   │
   └── REGISTROS
          │
          ├── fecha
          ├── tiempo
          ├── detalle
          ├── cliente
          ├── proyecto
          └── categoría
```

La tabla `registros` utiliza relaciones hacia proyectos, categorías y clientes.

Los registros se vinculan mediante `user_id`, de modo que la aplicación puede separar los datos de cada usuario.

La seguridad definitiva depende además de las **políticas RLS (Row Level Security) de Supabase**. El filtro `user_id` presente en el frontend es una capa adicional de control y organización, no debe considerarse un sustituto de RLS.

---

## Seguridad

### Variables de entorno

EÓN obtiene la configuración de Supabase mediante:

```text
VITE_SUPABASE_URL
VITE_SUPABASE_ANON_KEY
```

Estas variables no deberían escribirse directamente en el código fuente.

El archivo `.gitignore` excluye archivos `.env` y `.env.*` para evitar que configuraciones locales terminen en Git. fileciteturn14file0L2-L2

### ¿Hay datos sensibles expuestos?

**En la revisión realizada sobre los archivos fuente principales del repositorio, no encontré contraseñas, tokens privados, service-role keys ni credenciales de base de datos hardcodeadas.**

El cliente de Supabase toma `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` desde `import.meta.env`, en lugar de tener esos valores escritos directamente en `supabase.ts`. fileciteturn12file0L2-L2

Hay una distinción importante:

- La **Supabase URL** no es un secreto.
- La **anon/public key** está diseñada para poder estar en una aplicación frontend; su seguridad depende de las políticas RLS y de los permisos configurados en Supabase.
- Una **service_role key**, contraseña de base de datos o token privado **sí sería sensible** y nunca debería aparecer en el frontend, GitHub o variables `VITE_*`.

Por lo tanto, **no veo actualmente un secreto crítico expuesto en el código que revisé**.

### Datos personales

EÓN sí está diseñado para manejar datos que pueden ser privados para el usuario, como:

- Email de la cuenta.
- Clientes.
- Proyectos.
- Detalles de tareas.
- Registro histórico de tiempo.

Que esos datos estén protegidos depende de la configuración de autenticación y RLS de Supabase.

### Importante sobre GitHub

Aunque el código no contenga secretos, si el repositorio es público, todo lo que se escriba directamente en el código es visible públicamente.

Por eso nunca deben agregarse al repositorio:

- Contraseñas.
- Service role keys.
- Tokens de APIs privadas.
- Credenciales SMTP.
- Contraseñas de base de datos.
- Tokens de Cloudflare.
- Archivos `.env` con secretos.

---

## Principio de seguridad de EÓN

La aplicación utiliza dos niveles que deben mantenerse separados:

```text
FRONTEND
   │
   ├── sabe quién está autenticado
   ├── usa anon/public key
   └── filtra por user_id

SUPABASE
   │
   └── RLS debe decidir qué puede leer/escribir realmente cada usuario
```

**El frontend no es una frontera de seguridad.** Cualquier usuario puede inspeccionar JavaScript enviado al navegador. La protección real de los datos debe estar en Supabase mediante RLS y permisos correctamente configurados.

---

## Flujo de autenticación

```text
Usuario
   │
   ├── Registrarse ────────→ Supabase Auth
   │
   ├── Iniciar sesión ─────→ Supabase Auth
   │
   ├── Olvidé contraseña ──→ Email de recuperación
   │                              │
   │                              ↓
   │                     Nueva contraseña
   │                              │
   │                              ↓
   └──────────────────────→ Aplicación EÓN
```

El código de autenticación utiliza las funciones oficiales del cliente Supabase para registro, login, recuperación, actualización y cierre de sesión. fileciteturn13file0L2-L2

---

## Desarrollo local

Instalar dependencias:

```bash
npm install
```

Iniciar servidor de desarrollo:

```bash
npm run dev
```

Construir producción:

```bash
npm run build
```

Previsualizar el build:

```bash
npm run preview
```

La configuración de Supabase debe estar disponible mediante las variables de entorno correspondientes.

---

## Despliegue

El flujo actual previsto es:

```text
Código local
    ↓
GitHub / main
    ↓
Cloudflare
    ↓
eon.hermanoscalmels.com
    ↓
Supabase
```

La aplicación se encuentra preparada para utilizar un dominio personalizado como:

**`eon.hermanoscalmels.com`**

La URL exacta de producción y sus configuraciones de autenticación deben mantenerse alineadas con las URLs permitidas en Supabase.

---

## Metodología de desarrollo de EÓN

Para evitar convertir EÓN en un proyecto difícil de mantener, cada modificación funcional debe seguir este ciclo:

```text
Definir
   ↓
Inspeccionar código
   ↓
Modificar
   ↓
Probar
   ↓
Commit
   ↓
Deploy
   ↓
Verificar
   ↓
Documentar
```

Y, especialmente, **una función por vez**.

La intención es poder saber siempre qué se agregó, qué se corrigió y qué versión está funcionando.

---

## Historial funcional

### EÓN 1.0 — Base funcional

Incluye la aplicación inicial de registro de tiempos con:

- Autenticación.
- Registro de tiempo.
- Timer integrado.
- Configuración.
- Proyectos.
- Categorías.
- Clientes.
- Valores predeterminados.
- Persistencia en Supabase.
- Despliegue web.

### EÓN 1.1 — Ver registros

Nueva función: pantalla histórica.

- Tabla.
- Día actual por defecto.
- Más reciente primero.
- Búsqueda en vivo.
- Rango de fechas.
- Ordenamiento por columnas.
- Cantidad y total de tiempo.
- Datos limitados al usuario autenticado.

### Próxima corrección

Si aparece un problema en la función de registros, la próxima versión será:

**EÓN 1.1.1**

No se incrementará a 1.2 mientras no haya una nueva función.

---

## Hoja de ruta propuesta

### 1.x — Consolidación

- Correcciones de la versión 1.1.
- Mejoras de usabilidad.
- Edición de registros.
- Mejor manejo de fechas y estados.
- Exportación CSV.

### 2.x — Análisis

El objetivo de EÓN es que registrar tiempo sea solamente el primer paso.

Posibles funciones futuras:

- Informes por período.
- Tiempo por categoría.
- Tiempo por cliente.
- Tiempo por proyecto.
- Tiempo facturable/no facturable.
- Comparación entre períodos.
- Exportación para Sheets/Excel.
- Indicadores de productividad.
- Rentabilidad por cliente/proyecto.
- Detección de trabajo fragmentado.

### Idea central de evolución

```text
Registrar
   ↓
Ordenar
   ↓
Analizar
   ↓
Comprender dónde se va el tiempo
   ↓
Optimizar
   ↓
Mejorar rentabilidad
```

---

## Decisiones de diseño

EÓN busca ser deliberadamente pequeño.

### No hacer en la primera versión

- No agregar dashboards complejos sin necesidad.
- No llenar la interfaz de gráficos.
- No convertir cada dato en un formulario.
- No incorporar un framework grande si TypeScript vanilla resuelve el problema.
- No agregar funciones antes de validar el flujo real de trabajo.

### Sí priorizar

- Velocidad de carga.
- Pocos clics.
- Datos estructurados.
- Código entendible.
- Seguridad en Supabase.
- Funciones pequeñas y comprobables.
- Evolución incremental.

---

## Comentarios del código

El código fuente contiene comentarios explicativos especialmente alrededor de:

- Flujo de autenticación.
- Renderizado de vistas.
- Consultas a Supabase.
- Filtros.
- Ordenamiento.
- Timer.
- Conversión de tiempo.
- Escape de HTML.
- Manejo de valores predeterminados.
- Separación de datos por usuario.

El objetivo de los comentarios no es explicar sintaxis obvia, sino dejar documentadas las **decisiones y responsabilidades** de cada bloque para facilitar futuras modificaciones.

---

## Nota de seguridad sobre HTML

Las pantallas que imprimen nombres, detalles u otros valores provenientes de la base de datos deben escapar esos valores antes de insertarlos mediante `innerHTML`.

La pantalla de registros utiliza una función `escapar()` para este propósito y documenta explícitamente que se trata de una defensa contra XSS.

La configuración también utiliza `escapeHtml()` para valores que vienen de la base de datos.

---

## Próximas mejoras técnicas recomendadas

Antes de hacer crecer mucho la aplicación, conviene revisar:

1. **RLS de Supabase:** comprobar tabla por tabla que un usuario no pueda leer ni modificar datos de otro usuario.
2. **Tipos TypeScript:** reemplazar progresivamente `any` por interfaces reales.
3. **Fecha local:** evitar depender de UTC (`toISOString()`) para determinar “hoy” si el uso está vinculado a una zona horaria concreta.
4. **Tiempo:** decidir si EÓN continuará almacenando minutos o si pasará a almacenar segundos para conservar toda la precisión del timer.
5. **Mensajes de error:** evitar mostrar información técnica innecesaria en producción.
6. **Edición de registros:** incorporar modificación controlada de registros históricos.
7. **Pruebas:** agregar comprobaciones automatizadas cuando la aplicación crezca.

Estas mejoras no son necesariamente bugs actuales; son puntos de evolución técnica identificados para evitar problemas al escalar.

---

## Filosofía

EÓN no pretende ser un sistema de gestión enorme.

Pretende responder una pregunta sencilla:

> **¿En qué estoy usando realmente mi tiempo?**

Primero se registra.

Después se hace visible.

Después se analiza.

Y recién entonces se decide qué optimizar.

**EÓN: registrar para entender el tiempo.**
