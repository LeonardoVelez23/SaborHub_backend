# Logrod Backend

Backend API del proyecto Logrod, construida con Express.js y preparada para servir como punto de entrada principal de la aplicación.

## Descripción

Este proyecto proporciona una base sólida para exponer servicios REST mediante una arquitectura simple y escalable. Actualmente incluye:

- Servidor Express configurado con seguridad básica
- Middleware para manejo de errores y rutas no encontradas
- Endpoint de health check
- Configuración de entorno con variables externas

## Requisitos

- Node.js 18 o superior
- npm 9 o superior

## Instalación

1. Clona el repositorio y entra a la carpeta del proyecto.
2. Instala las dependencias:

```bash
npm install
```

3. Copia el archivo de ejemplo de variables de entorno:

```bash
copy .env.example .env
```

4. Ajusta los valores según tu entorno.

## Variables de entorno

El archivo `.env` acepta las siguientes variables:

```env
PORT=3000
NODE_ENV=development
JWT_SECRET=<cadena aleatoria larga>
DATABASE_URL=postgresql://...
CORS_ORIGIN=https://saborpolitecnico.netlify.app
APP_TIMEZONE=America/Guayaquil
```

- `PORT`: puerto donde correrá la API
- `NODE_ENV`: entorno de ejecución (`development`, `production`, etc.)
- `JWT_SECRET`: obligatorio; sin él la API no arranca
- `JWT_EXPIRES_CLIENTE` (por defecto `20m`) y `JWT_EXPIRES_PERSONAL` (por defecto `8h`): duración de la sesión, fija desde el login. Al vencer, el cliente vuelve a iniciar sesión (la app además la cierra tras unos minutos sin uso).
- `CORS_ORIGIN`: dominios web permitidos, separados por coma. Vacío: cualquiera en desarrollo y ninguno en producción. La app móvil no lo necesita.
- `APP_TIMEZONE`: zona horaria de la fecha y hora de los pedidos (por defecto `America/Guayaquil`)

Ver `.env.example` para el correo (Brevo/SMTP).

## Versiones y releases

Al fusionar un PR de `develop` en `main`, el workflow `.github/workflows/release.yml`:

1. Corre los tests contra un PostgreSQL temporal. Si fallan, no se publica nada.
2. Calcula la versión a partir de la última etiqueta `vX.Y.Z` (la primera vez usa la de `package.json`).
3. Crea la etiqueta anotada `vX.Y.Z` en el commit fusionado y un GitHub Release con las notas generadas a partir de los PRs.

El nivel del salto se elige con etiquetas (labels) en el PR:

| Label del PR | Resultado (desde v1.2.3) |
|---|---|
| (ninguna) | `v1.2.4` |
| `release:minor` | `v1.3.0` |
| `release:major` | `v2.0.0` |
| `release:skip` | No se publica |

También se puede lanzar a mano en Actions → Release → Run workflow (sobre `main`), eligiendo patch, minor o major. La versión vigente es la última etiqueta de git; el workflow no modifica `package.json` ni hace commits en `main`.

## Base de datos local (desarrollo)

Para trabajar sin Supabase hay un PostgreSQL en `compose.yaml`:

```bash
podman compose up -d        # o: docker compose up -d
```

En `.env`:

```
DATABASE_URL=postgres://logrod:logrod@localhost:5432/logrod
```

Luego crear las tablas y los datos de prueba:

```bash
npx sequelize-cli db:migrate
npm run seed
```

Usuarios del seed: `cliente@logrod.com` / `cliente123`, `admin@logrod.com` / `admin123`, empleados con `empleado123`.
Con una URL que no es de Supabase la conexión va sin SSL.

`JWT_SECRET` es **obligatorio**: sin él el servidor no arranca (ver `.env.example`). En el servidor de producción debe configurarse antes de desplegar.

## Tests

Usan una base aparte, `logrod_test`, que se recrea con las migraciones en cada ejecución:

```bash
podman exec logrod-postgres createdb -U logrod logrod_test   # solo la primera vez
npm test
```

Otra base: `TEST_DATABASE_URL=postgres://.../algo_test npm test` (el nombre debe terminar en `_test`).

## Ejecutar el proyecto

### Modo desarrollo

```bash
npm run dev
```

### Modo producción

```bash
npm start
```

## Endpoints disponibles

**Contrato completo (OpenAPI 3.1):** `src/docs/openapi.js`, servido en `GET /api/v1/openapi.json`. Para verlo, abrir https://editor.swagger.io → *File → Import URL* con `<servidor>/api/v1/openapi.json`. Incluye cuerpos, respuestas, roles (`x-roles`) y reglas de negocio (`x-reglas`). `tests/openapi.test.js` falla si una ruta de `src/routes` falta en el contrato o si el contrato tiene rutas que no existen: **al agregar o quitar un endpoint, actualizar `openapi.js`.**

### Health check

```http
GET /api/v1/health
```

Respuesta de ejemplo:

```json
{
  "success": true,
  "message": "Backend API operando correctamente",
  "timestamp": "2026-07-28T00:00:00.000Z",
  "uptime": 12.34
}
```

### Términos y política de datos (LOPDP)

```http
GET /api/v1/legal              # versión vigente y documentos
GET /api/v1/legal/terminos     # términos y condiciones
GET /api/v1/legal/privacidad   # política de protección de datos
```

Públicos, en JSON (`{tipo, titulo, version, secciones: [{titulo, parrafos}]}`); la app los muestra con sus estilos. Los textos están en `src/legal/documentos.js`: al cambiarlos, sube `VERSION_LEGAL`.

El registro (`POST /clientes` sin token de personal) exige `acepta_terminos: true` y `version_legal` igual a la vigente, y guarda `legal_version` y `legal_aceptado_en` en el cliente. Los clientes que crea el personal desde el panel no la llevan.

### Privacidad del cliente

```http
GET    /api/v1/privacidad/mis-datos   # (cliente) sus datos, aceptación legal y pedidos, para descargar
DELETE /api/v1/privacidad/mi-cuenta   # (cliente) body {contrasenia}: elimina su cuenta
```

Eliminar la cuenta reemplaza identificación, nombres, correo, teléfono y contraseña, y marca `eliminado_en`; los pedidos y pagos se conservan anónimos. No se permite con pedidos en curso. El token deja de servir en la siguiente petición.

### Ingreso con huella o rostro (app móvil)

| Método | Ruta | Acceso |
| --- | --- | --- |
| POST | `/auth/biometrico/activar` `{dispositivo}` | cliente: devuelve `data.credencial` (`<id>.<secreto>`) |
| POST | `/auth/biometrico` `{credencial}` | público (con límite): devuelve `token`, `user` y una `credencial` nueva |
| DELETE | `/auth/biometrico` `{credencial}` | cliente: desactiva ese dispositivo |

La huella la verifica el teléfono; el backend nunca la recibe. Solo se guarda el SHA-256 del secreto (`CredencialesBiometricas`), que cambia en cada ingreso. La credencial vence tras 30 días sin usarse, se revoca al cambiar la contraseña o eliminar la cuenta, y hay como máximo 5 dispositivos por cliente.

### Perfil del cliente (app móvil)

```http
GET    /api/v1/perfil          # (cliente) sus datos + foto_actualizada_en
PUT    /api/v1/perfil          # (cliente) mismas reglas que PUT /clientes/:id (contraseña con OTP)
GET    /api/v1/perfil/foto     # {tipo, imagen (base64), actualizada_en} o 404
PUT    /api/v1/perfil/foto     # body {imagen: base64} — JPEG, PNG o WebP, máx. 600 KB
DELETE /api/v1/perfil/foto
```

La foto se guarda en la tabla `FotosPerfil` (una por cliente, con RLS), se incluye en `GET /privacidad/mis-datos` y se borra al eliminar la cuenta. El tipo se detecta por los bytes, no por lo que diga el cliente.

### Carrito del cliente (app móvil, RF-13)

El carrito se guarda en el servidor (tabla `CarritoItems`): no se pierde al cerrar la app ni al cambiar de teléfono. Solo para el rol `cliente`.

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/api/v1/carrito` | `{items: [{producto_id, cantidad, producto: {id, nombre, precio, cantidad_disponible, estado, imagen_codigo}}]}` en el orden en que se agregaron |
| PUT | `/api/v1/carrito` | Reemplaza el carrito completo: `{items: [{producto_id, cantidad}]}` (cantidad entera 1–50, sin repetir productos, máx. 100). Los productos que ya no existen se ignoran |

El stock y la disponibilidad se validan al crear el pedido, no al guardar el carrito. `POST /pedidos` hecho por el cliente vacía su carrito en la misma transacción (un pedido del personal a su nombre no lo toca). El carrito aparece en `GET /privacidad/mis-datos` y se borra al eliminar la cuenta.

### Mis pagos (app móvil)

`GET /api/v1/pagos/mios` (solo cliente): sus pagos registrados, del más reciente al más antiguo, con el pedido (`id`, `fecha`, `hora`, `estado`, `valor_total`). No incluye los intentos con tarjeta cancelados o rechazados.

### Pago con tarjeta por Payphone (RF-22)

Flujo (botón de pago por redirección de Payphone, ambiente de **pruebas**: no hay cobros reales):

1. La app llama `POST /api/v1/pagos/payphone/preparar` `{pedido_id}` (solo cliente, pedido propio no cancelado y sin pago cerrado; se puede pagar desde que está `solicitado`). Responde `{url}`: el formulario de tarjeta de Payphone, que vence a los 10 minutos.
2. `url` es una página intermedia del backend (`GET /pagos/payphone/ir?u=<payWithCard>`, solo redirige a `*.payphonetodoesposible.com`): Payphone rechaza ("No autorizado") los pagos cuyo `Referer` no es el *Dominio web* registrado, así que esa página los abre desde nuestro dominio con `Referrer-Policy: origin`. La app abre `url` en una pestaña del navegador (Custom Tabs / SFSafariViewController; Payphone no permite webviews).
3. Payphone devuelve al navegador a `GET /pagos/payphone/retorno?id=&clientTransactionId=` (fuera de `/api/v1`). El backend confirma con Payphone (`/api/button/V2/Confirm`, antes de 5 minutos o Payphone lo revierte), verifica el monto y registra el `Pago` como `aprobado` (`tarjeta`, referencia `Payphone <id>`). Si el pedido se canceló mientras pagaba, queda `reembolsado`.
4. La página tiene el botón "Volver a la app" (`saborpolitecnico://app/pedidos/<id>/pago`), que abre en la app el resultado del pago: monto, referencia y estado.

Configuración (`.env`): `PAYPHONE_TOKEN` y `PAYPHONE_RESPONSE_URL` (sin ellos `preparar` responde 503) y, opcional, `PAYPHONE_STORE_ID` (sin él, Payphone usa la tienda del token). Ver `.env.example`.

En Payphone Developer: aplicación **WEB** en ambiente **PRUEBAS**, con el dominio público del backend y la URL de respuesta `<dominio>/pagos/payphone/retorno`. En desarrollo el backend local se expone con ngrok:

```bash
ngrok http --url=<tu-dominio>.ngrok-free.app 3000
```

Los intentos se guardan en `TransaccionesPayphone` (sin datos de la tarjeta ni del titular).

### Páginas públicas (para Google Play y App Store)

```http
GET /legal/terminos
GET /legal/privacidad        # URL de la política de privacidad en las tiendas
GET /legal/eliminar-cuenta   # enlace web para pedir la eliminación (Google Play)
```

HTML con los colores de marca, generado con los mismos textos de `src/legal/documentos.js`. Van fuera de `/api/v1`.

## Estructura del proyecto

```text
src/
  app.js          # Express: middlewares, rutas y manejo de errores
  index.js        # Arranque del servidor
  config/         # Variables de entorno y conexión a la base
  controllers/    # Manejo de cada petición
  legal/          # Textos legales y páginas HTML públicas
  middlewares/    # Token, roles, límites de peticiones, errores
  migrations/     # Esquema versionado (sequelize-cli)
  models/         # Modelos Sequelize y relaciones
  routes/         # Rutas y permisos por rol
  seeders/        # Datos de prueba
  services/       # Lógica reutilizable (stock, OTP, correo, sesión, Payphone)
  utils/
tests/            # Vitest + Supertest
```

## Principios SOLID

El backend separa rutas, controladores, modelos, middlewares y servicios (RNF-16), pero hoy los **controladores concentran demasiado**: leen la petición, aplican las reglas de negocio, abren transacciones y consultan Sequelize directamente (`pedidoController.js` tiene unas 450 líneas). El objetivo es esta arquitectura en capas:

```text
Ruta (permisos) → Controlador (HTTP) → Servicio (reglas de negocio) → Repositorio (base de datos)
```

| Principio | Situación actual | Objetivo |
|---|---|---|
| **S** — Responsabilidad única | El controlador valida, decide, guarda y responde. | El **controlador** solo traduce HTTP (lee `req`, responde `res`). El **servicio** aplica las reglas (RN-01 a RN-19) y maneja transacciones. El **repositorio** es el único que usa Sequelize. |
| **O** — Abierto/cerrado | Agregar otra forma de pago obliga a modificar el controlador de pagos. | Una interfaz `PasarelaPago` (`preparar`, `confirmar`). Payphone es una implementación; otra pasarela se agrega sin tocar las existentes. |
| **L** — Sustitución de Liskov | — | Cualquier pasarela o repositorio que cumpla el contrato es intercambiable (p. ej., uno en memoria para los tests). |
| **I** — Segregación de interfaces | — | Repositorios pequeños por entidad (`PedidoRepository`, `PagoRepository`, `ProductoRepository`…), no uno genérico con todo. |
| **D** — Inversión de dependencias | Los servicios importan los modelos y `config` directamente. | Las dependencias se pasan al crear cada servicio (inyección por parámetros), así se prueban sin base de datos ni red. |

Ya van en esa dirección `stockService`, `otpService`, `sesionService` y `payphoneService`.

### Plan de migración

Módulo por módulo y **sin cambiar la API** (rutas, permisos y respuestas iguales; la app y el panel web no lo notan). Los tests de integración existentes deben seguir en verde en cada paso.

1. Pedidos y pagos (lo más complejo; incluye `PasarelaPago`).
2. Productos y categorías.
3. Clientes, empleados, perfil y privacidad.

Esta separación también prepara el soporte de **varios restaurantes**: el filtro por restaurante se aplica en los repositorios, en un solo lugar.

### Reglas para el código nuevo

- Nada de reglas de negocio ni consultas Sequelize nuevas en los controladores.
- Las transacciones se abren en los servicios.
- Servicios y repositorios reciben sus dependencias; no leen `process.env` (usar `config`).
- Cada regla de negocio nueva lleva su test.

## Despliegue en Railway

El backend corre en Railway y usa la base de datos de Supabase (Supabase solo guarda los datos). `railway.json` define el arranque (`npm start`) y el health check (`/api/v1/health`).

1. En el proyecto de Railway: **New → GitHub Repo → `logrod_backend`**, rama `develop` (o `main` cuando se publique una versión).
2. **Variables** del servicio:
   - `NODE_ENV=production`
   - `DATABASE_URL`: la misma de Supabase del `.env` (pooler, puerto 5432).
   - `JWT_SECRET`: uno nuevo y largo (no el de desarrollo).
   - `CORS_ORIGIN`: dominios de la web separados por coma (la app móvil no lo necesita).
   - Correo: `BREVO_API_KEY` o `SMTP_*`, y `EMAIL_FROM`.
   - Payphone: `PAYPHONE_TOKEN`, `PAYPHONE_STORE_ID` y `PAYPHONE_RESPONSE_URL=https://<dominio-railway>/pagos/payphone/retorno`.
   - `PORT` no se configura: lo pone Railway.
3. **Settings → Networking → Generate Domain**: da `https://<nombre>.up.railway.app`.
4. Las migraciones no corren al desplegar: se aplican a Supabase desde el PC con `npx sequelize-cli db:migrate` (el `.env` apunta a Supabase).
5. La app se compila con `--dart-define=API_BASE_URL=https://<nombre>.up.railway.app/api/v1`.

## Lanzamiento recomendado

Para lanzar el backend localmente:

```bash
npm install
copy .env.example .env
npm run dev
```

Luego abre en tu navegador o cliente HTTP la siguiente URL:

```text
http://localhost:3000/api/v1/health
```

## Notas

Este README está pensado para el lanzamiento inicial del proyecto y puede ampliarse con documentación adicional de autenticación, base de datos y despliegue cuando se agreguen esos módulos.

