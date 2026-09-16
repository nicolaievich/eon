# EÓN ⏳

**EÓN — App de Registro de Tiempos**

EÓN es una aplicación web pequeña para registrar rápidamente en qué se utiliza el tiempo de trabajo y, posteriormente, poder analizarlo.

> **Registrar → hacer consciente → analizar → optimizar.**

La idea central es que registrar un trabajo lleve muy pocos segundos y que esos datos después puedan convertirse en información útil.

---

## Estado actual

**Versión funcional: 1.1.1**

EÓN utiliza una numeración funcional simple:

- `1.0` → versión base.
- `1.1` → nueva función.
- `1.1.1` → corrección de la versión 1.1.
- `1.1.2` → otra corrección de la versión 1.1.
- `1.2` → siguiente nueva función.

**El segundo número identifica nuevas funciones; el tercer número identifica correcciones.**

La versión funcional es independiente de la versión técnica de `package.json`.

---

## ¿Qué hace EÓN hoy?

### 1. Autenticación

EÓN utiliza Supabase Auth y permite:

- Crear cuenta.
- Iniciar sesión.
- Cerrar sesión.
- Recuperar contraseña mediante email.
- Cambiar contraseña.
- Mostrar u ocultar contraseñas.
- Confirmar contraseña durante registro y recuperación.

Los datos se asocian al usuario autenticado.

### 2. Registrar tiempo

La pantalla principal permite registrar:

| Campo | Estado | Descripción |
|---|---|---|
| Fecha | Obligatorio | Fecha a la que corresponde el trabajo. |
| Proyecto | Opcional | Proyecto relacionado. |
| Categoría | Obligatorio | Clasificación del trabajo. |
| Cliente | Opcional | Cliente relacionado. |
| Tiempo | Obligatorio | Formato `HH:MM`. |
| Detalle | Opcional | Descripción breve de lo realizado. |

La fecha se propone automáticamente utilizando la **fecha local del navegador**.

El tiempo trabaja con precisión de **minuto**. El formato visible y de entrada es `HH:MM`; por ejemplo `01:30` representa una hora y media.

El tiempo se almacena en Supabase como `tiempo_minutos`, un entero.

### Timer integrado

- `▶ Iniciar` comienza el conteo.
- `⏹ Detener` detiene el conteo conservando el tiempo acumulado.
- `↺` reinicia el tiempo.
- El timer mide segundos internamente para que el conteo sea preciso, pero la interfaz solamente muestra minutos completos.
- Los segundos no se almacenan.

### 3. Configuración

Permite administrar:

- Proyectos.
- Categorías.
- Clientes.
- Proyecto predeterminado.
- Cliente predeterminado.

Los proyectos pueden activarse/desactivarse sin eliminarse, preservando su utilidad histórica.

Los valores predeterminados se guardan por usuario en Supabase.

### 4. Ver registros — EÓN 1.1

La versión 1.1 incorporó la primera pantalla histórica:

- Tabla de registros.
- Fecha, proyecto, categoría, cliente, tiempo y detalle.
- Día actual como período inicial.
- Más reciente primero.
- Búsqueda en vivo.
- Filtro desde/hasta.
- Ordenamiento por cada columna.
- Alternancia ascendente/descendente.
- Cantidad de registros.
- Tiempo total del resultado.
- Consulta limitada al usuario autenticado.

La búsqueda se realiza sobre los registros ya cargados. El rango de fechas se aplica directamente en Supabase.

### 5. Corrección 1.1.1

La versión `1.1.1` corrige dos aspectos del flujo de tiempo:

- La entrada pasó de `HH:MM:SS` a **`HH:MM`**.
- La fecha automática dejó de depender de `toISOString()`/UTC y ahora utiliza la fecha local del navegador.

Esto evita que, cerca de medianoche, EÓN pueda tomar accidentalmente una fecha UTC diferente de la fecha local del usuario.

---

## Arquitectura

EÓN está construido como una aplicación web pequeña, sin framework frontend pesado.

### Stack

- **Vite** — desarrollo y build.
- **TypeScript** — lógica.
- **Pico CSS** — estilos minimalistas.
- **Supabase** — autenticación y base de datos.
- **Cloudflare** — despliegue/hosting.
- **GitHub** — repositorio y control de versiones.

Dependencias principales:

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

Punto de entrada de la aplicación.

Se ocupa de:

- Inicializar la interfaz.
- Comprobar la sesión.
- Mostrar login o aplicación privada.
- Navegar entre Registrar, Ver registros y Configuración.
- Gestionar recuperación de contraseña.
- Mantener el usuario autenticado en memoria.

### `src/auth.ts`

Centraliza las operaciones de autenticación:

- `registrarUsuario()`
- `iniciarSesion()`
- `enviarResetPassword()`
- `actualizarPassword()`
- `cerrarSesion()`
- `obtenerSesion()`

### `src/lib/supabase.ts`

Crea el cliente Supabase usando variables de entorno Vite.

**No debe contener claves privadas ni secretos.**

### `src/pages/registrar.ts`

Implementa el registro de tiempo, carga de proyectos/categorías/clientes, valores predeterminados y timer.

Desde EÓN 1.1.1 utiliza `HH:MM` y una función de fecha local para evitar errores por conversión UTC.

### `src/pages/registros.ts`

Implementa la pantalla histórica:

1. Renderiza filtros y tabla.
2. Determina el período inicial.
3. Consulta registros del usuario.
4. Aplica búsqueda.
5. Ordena columnas.
6. Calcula el total.
7. Renderiza el resultado.

También presenta el tiempo como `HH:MM`.

### `src/pages/config.ts`

Administra proyectos, categorías, clientes y valores predeterminados.

---

## Modelo conceptual de datos

```text
USUARIO
   │
   ├── CLIENTES
   ├── PROYECTOS
   ├── CATEGORÍAS
   ├── CONFIGURACIÓN
   └── REGISTROS
          │
          ├── fecha
          ├── tiempo_minutos
          ├── detalle
          ├── cliente
          ├── proyecto
          └── categoría
```

`registros` se relaciona con proyectos, categorías y clientes mediante sus IDs.

Los registros se vinculan con `user_id`.

La seguridad definitiva debe estar en las **políticas RLS (Row Level Security) de Supabase**. El filtro `user_id` del frontend es una capa adicional de organización y no reemplaza RLS.

---

## Seguridad

### Variables de entorno

EÓN utiliza:

```text
VITE_SUPABASE_URL
VITE_SUPABASE_ANON_KEY
```

No deben escribirse directamente en el código fuente.

`.gitignore` debe mantener fuera del repositorio los archivos `.env` y otros archivos con secretos.

### ¿Hay datos sensibles expuestos?

En la revisión realizada sobre los archivos fuente principales **no se encontraron contraseñas, tokens privados, service-role keys ni credenciales de base de datos hardcodeadas**.

La configuración de Supabase se obtiene mediante variables de entorno.

La distinción importante es:

- La URL de Supabase no es un secreto.
- La `anon/public key` está diseñada para ser utilizada por aplicaciones frontend.
- Una `service_role key`, contraseña de base de datos, token privado o credencial SMTP sí es sensible y nunca debe quedar en el frontend ni en GitHub.

### Datos privados de la aplicación

Aunque no haya secretos hardcodeados, EÓN maneja información potencialmente privada:

- Email de la cuenta.
- Clientes.
- Proyectos.
- Detalles de tareas.
- Historial de tiempo.

Por eso las políticas RLS de Supabase son una parte fundamental de la seguridad.

### Principio de seguridad

```text
FRONTEND
   │
   ├── sabe quién está autenticado
   ├── utiliza anon/public key
   └── filtra por user_id

SUPABASE
   │
   └── RLS decide qué puede leer/escribir realmente cada usuario
```

**El frontend no es una frontera de seguridad.** Todo JavaScript enviado al navegador puede ser inspeccionado por el usuario.

---

## Flujo de autenticación

```text
Usuario
   │
   ├── Registrarse ────────→ Supabase Auth
   ├── Iniciar sesión ─────→ Supabase Auth
   ├── Recuperar clave ────→ Email
   │                            │
   │                            ↓
   │                     Nueva contraseña
   │                            │
   └────────────────────────→ EÓN
```

---

## Desarrollo local

Instalar dependencias:

```bash
npm install
```

Servidor de desarrollo:

```bash
npm run dev
```

Build de producción:

```bash
npm run build
```

Previsualización:

```bash
npm run preview
```

La configuración de Supabase debe estar disponible mediante las variables de entorno correspondientes.

---

## Despliegue

Flujo actual:

```text
Código
  ↓
GitHub / main
  ↓
Cloudflare
  ↓
eon.hermanoscalmels.com
  ↓
Supabase
```

La URL de producción y las URLs de recuperación de contraseña deben mantenerse alineadas con las URLs permitidas en Supabase.

---

## Metodología de desarrollo

Cada modificación funcional debe seguir, en lo posible, este ciclo:

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

La regla práctica es **una función por vez**.

Esto permite saber qué se agregó, qué se corrigió y qué versión está funcionando.

---

## Historial funcional

### EÓN 1.0 — Base funcional

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

Nueva función histórica:

- Tabla.
- Día actual por defecto.
- Más reciente primero.
- Búsqueda en vivo.
- Rango de fechas.
- Ordenamiento por columnas.
- Cantidad y total de tiempo.
- Datos limitados al usuario autenticado.

### EÓN 1.1.1 — Corrección de tiempo y fecha

Correcciones, sin incorporar una nueva función:

- Entrada de tiempo simplificada a `HH:MM`.
- Timer adaptado al nuevo formato.
- Registros históricos mostrados como `HH:MM`.
- Fecha automática basada en hora local y no en UTC.
- Comentarios ampliados en el código para documentar estas decisiones.

---

## Hoja de ruta propuesta

### 1.x — Consolidación

- Correcciones y mejoras de usabilidad.
- Edición de registros.
- Mejor manejo de fechas y estados.
- Exportación CSV.

### 2.x — Análisis

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

### Evolución conceptual

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

### No priorizar inicialmente

- Dashboards complejos sin necesidad.
- Exceso de gráficos.
- Formularios innecesarios.
- Framework frontend pesado si TypeScript vanilla resuelve el problema.
- Funciones antes de validar el flujo real.

### Priorizar

- Velocidad.
- Pocos clics.
- Datos estructurados.
- Código entendible.
- Seguridad en Supabase.
- Funciones pequeñas y comprobables.
- Evolución incremental.

---

## Comentarios del código

El código contiene comentarios explicativos especialmente alrededor de:

- Flujo de autenticación.
- Renderizado de vistas.
- Consultas a Supabase.
- Filtros.
- Ordenamiento.
- Timer.
- Conversión de tiempo.
- Fecha local.
- Escape de HTML.
- Valores predeterminados.
- Separación de datos por usuario.

Los comentarios buscan documentar **responsabilidades y decisiones**, no repetir sintaxis obvia.

---

## Próximas mejoras técnicas

1. **RLS:** comprobar tabla por tabla que un usuario no pueda leer ni modificar datos de otro usuario.
2. **Tipos TypeScript:** reemplazar progresivamente `any` por interfaces reales.
3. **Tiempo:** mantener minutos mientras sea suficiente; si el timer necesita conservar segundos en el futuro, cambiar explícitamente el modelo de datos.
4. **Mensajes de error:** evitar información técnica innecesaria en producción.
5. **Edición:** permitir modificar registros históricos de forma controlada.
6. **Pruebas:** agregar comprobaciones automatizadas cuando EÓN crezca.

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
