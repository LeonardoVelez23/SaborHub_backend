/**
 * Contrato de la API (OpenAPI 3.1). Se sirve en GET /api/v1/openapi.json y
 * se puede abrir en https://editor.swagger.io (File → Import URL).
 *
 * tests/openapi.test.js comprueba que cada ruta de src/routes esté aquí y
 * que aquí no haya rutas que no existen: al agregar o quitar un endpoint,
 * actualizar este archivo.
 *
 * Extensiones propias:
 * - x-roles: roles que pueden llamar al endpoint (además del token).
 * - x-reglas: reglas de negocio que aplica (ver DERCAS).
 */

const ref = (nombre) => ({ $ref: `#/components/schemas/${nombre}` });
const lista = (schema) => ({ type: 'array', items: schema });
const json = (schema) => ({ 'application/json': { schema } });

/** Respuesta `{success: true, message?, data}`. */
const ok = (descripcion, data, status = '200') => ({
  [status]: {
    description: descripcion,
    content: json({
      type: 'object',
      required: ['success'],
      properties: {
        success: { const: true },
        message: { type: 'string' },
        ...(data ? { data } : {})
      }
    })
  }
});

const error = (status, descripcion) => ({
  [status]: { description: descripcion, content: json(ref('Error')) }
});

const E400 = error('400', 'Datos inválidos o regla de negocio incumplida (el mensaje explica el motivo)');
const E401 = error('401', 'Sin token, token inválido o vencido, o usuario eliminado');
const E403 = error('403', 'El rol no tiene permiso o el recurso es de otro usuario');
const E404 = error('404', 'No encontrado');
const E429 = error('429', 'Demasiados intentos (límite de /auth)');

const protegido = (roles) => ({
  security: [{ bearer: [] }],
  ...(roles ? { 'x-roles': roles } : {})
});

const idParam = (nombre = 'id') => ({
  name: nombre,
  in: 'path',
  required: true,
  schema: { type: 'integer', minimum: 1 }
});

const cuerpo = (schema, requerido = true) => ({
  requestBody: { required: requerido, content: json(schema) }
});

const PERSONAL = ['admin', 'empleado', 'cajero', 'cocinero', 'mesero'];
const CAJA = ['admin', 'empleado', 'cajero'];

const pagina = (descripcion) => ({
  servers: [{ url: '/' }],
  responses: { 200: { description: descripcion, content: { 'text/html': {} } } }
});

export const openapi = {
  openapi: '3.1.0',
  info: {
    title: 'Sabor Politécnico API',
    version: '1.0.0',
    description: [
      'API REST de Sabor Politécnico (logrod_backend): pedidos del restaurante universitario.',
      '',
      '**Formato**: JSON. Toda respuesta trae `success` (boolean) y casi siempre `message`; los datos van en `data`.',
      'Excepción: `POST /auth/login` y `POST /auth/biometrico` devuelven `token` y `user` en la raíz.',
      '',
      '**Autenticación**: cabecera `Authorization: Bearer <JWT>`. El rol se vuelve a leer de la base en cada petición.',
      'JWT del cliente: 20 minutos fijos desde el login; del personal: 8 horas. Sin renovación.',
      '',
      '**Importes**: números con 2 decimales (`precio`, `valor_total`, `subtotal`, `valor`). Moneda USD.',
      '**Fechas**: `fecha` y `hora` del pedido en zona America/Guayaquil (`AAAA-MM-DD`, `HH:mm:ss`); el resto en ISO 8601 UTC.',
      '**Textos**: se guardan y devuelven tal cual (sin HTML escapado); cada cliente escapa al mostrar.'
    ].join('\n')
  },
  servers: [{ url: '/api/v1' }],
  components: {
    securitySchemes: {
      bearer: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' }
    },
    schemas: {
      Error: {
        type: 'object',
        required: ['success', 'message'],
        properties: { success: { const: false }, message: { type: 'string' } }
      },
      Rol: { enum: ['cliente', 'admin', 'empleado', 'cajero', 'cocinero', 'mesero'] },
      TipoCliente: { enum: ['Estudiante', 'Docente', 'Personal Administrativo', 'Persona externa'] },
      EstadoPedido: { enum: ['solicitado', 'confirmado', 'en preparación', 'listo', 'entregado', 'cancelado'] },
      Modalidad: { enum: ['presencial', 'en línea'] },
      MetodoPago: { enum: ['efectivo', 'tarjeta', 'transferencia'] },
      EstadoPago: { enum: ['pendiente', 'aprobado', 'rechazado', 'reembolsado'] },
      Contrasenia: {
        type: 'string',
        minLength: 8,
        description: 'Al menos 8 caracteres, una mayúscula, un número y un carácter especial (RNF-05).'
      },
      Categoria: {
        type: 'object',
        properties: {
          id: { type: 'integer' },
          nombre: { type: 'string', maxLength: 100 },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' }
        }
      },
      Producto: {
        type: 'object',
        properties: {
          id: { type: 'integer' },
          codigo: { type: 'string', maxLength: 50 },
          nombre: { type: 'string', maxLength: 150 },
          descripcion: { type: ['string', 'null'] },
          precio: { type: 'number', exclusiveMinimum: 0 },
          cantidad_disponible: { type: 'integer', minimum: 0 },
          estado: { enum: ['disponible', 'no disponible'] },
          categoria_id: { type: 'integer' },
          imagen_codigo: {
            type: ['string', 'null'],
            pattern: '^[a-z0-9_]{1,60}$',
            description: 'Nombre del archivo WebP en assets/images/productos/ de la app.'
          },
          categoria: { type: 'object', properties: { id: { type: 'integer' }, nombre: { type: 'string' } } },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' }
        }
      },
      ProductoEntrada: {
        type: 'object',
        properties: {
          codigo: { type: 'string' },
          nombre: { type: 'string' },
          descripcion: { type: ['string', 'null'] },
          precio: { type: 'number', exclusiveMinimum: 0 },
          cantidad_disponible: { type: 'integer', minimum: 0, default: 0 },
          estado: { enum: ['disponible', 'no disponible'], default: 'disponible' },
          categoria_id: { type: 'integer' },
          imagen_codigo: { type: ['string', 'null'], pattern: '^[a-z0-9_]{1,60}$' }
        }
      },
      Cliente: {
        type: 'object',
        description: 'Nunca incluye contrasenia ni los campos reset_password_*.',
        properties: {
          id: { type: 'integer' },
          identificacion: { type: 'string', maxLength: 20 },
          nombres: { type: 'string', maxLength: 100 },
          apellidos: { type: 'string', maxLength: 100 },
          correo_electronico: { type: 'string', format: 'email', maxLength: 150 },
          telefono: { type: ['string', 'null'], maxLength: 20 },
          tipo_cliente: ref('TipoCliente'),
          legal_version: { type: ['string', 'null'] },
          legal_aceptado_en: { type: ['string', 'null'], format: 'date-time' },
          eliminado_en: { type: ['string', 'null'], format: 'date-time' },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' }
        }
      },
      Empleado: {
        type: 'object',
        description: 'Nunca incluye contrasenia ni los campos reset_password_*. El rol sale de cargo (RF-03).',
        properties: {
          id: { type: 'integer' },
          identificacion: { type: 'string', maxLength: 20 },
          nombres: { type: 'string' },
          apellidos: { type: 'string' },
          correo_electronico: { type: 'string', format: 'email' },
          telefono: { type: ['string', 'null'] },
          cargo: {
            type: ['string', 'null'],
            description: 'admin|administrador → admin; cajero, cocinero, mesero → ese rol; otro → empleado.'
          },
          turno_trabajo: { type: ['string', 'null'], maxLength: 50 }
        }
      },
      Usuario: {
        description: 'Cliente o Empleado sin secretos, con su rol.',
        allOf: [
          { oneOf: [ref('Cliente'), ref('Empleado')] },
          { type: 'object', required: ['rol'], properties: { rol: ref('Rol') } }
        ]
      },
      Sesion: {
        type: 'object',
        required: ['success', 'token', 'user'],
        properties: {
          success: { const: true },
          message: { type: 'string' },
          token: {
            type: 'string',
            description: 'JWT HS256 con claims id, identificacion, nombres, apellidos, correo_electronico, rol, iat, exp.'
          },
          user: ref('Usuario')
        }
      },
      DetallePedido: {
        type: 'object',
        properties: {
          id: { type: 'integer' },
          pedido_id: { type: 'integer' },
          producto_id: { type: 'integer' },
          cantidad: { type: 'integer', minimum: 1, maximum: 50 },
          precio_unitario: { type: 'number' },
          subtotal: { type: 'number' },
          producto: {
            type: 'object',
            properties: {
              id: { type: 'integer' },
              codigo: { type: 'string' },
              nombre: { type: 'string' },
              precio: { type: 'number' },
              imagen_codigo: { type: ['string', 'null'] }
            }
          }
        }
      },
      Pago: {
        type: 'object',
        properties: {
          id: { type: 'integer' },
          pedido_id: { type: 'integer' },
          fecha: { type: 'string', format: 'date-time' },
          valor: { type: 'number' },
          metodo_pago: ref('MetodoPago'),
          numero_referencia: {
            type: ['string', 'null'],
            description: 'En pagos con Payphone: "Payphone <transactionId>".'
          },
          estado: ref('EstadoPago')
        }
      },
      Pedido: {
        type: 'object',
        properties: {
          id: { type: 'integer' },
          fecha: { type: 'string', format: 'date' },
          hora: { type: 'string', example: '12:30:05' },
          modalidad: ref('Modalidad'),
          estado: ref('EstadoPedido'),
          valor_total: { type: 'number' },
          cliente_id: { type: 'integer' },
          empleado_id: { type: ['integer', 'null'] },
          empleado_preparacion_id: { type: ['integer', 'null'] },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' },
          cliente: {
            type: 'object',
            description: 'id, nombres, apellidos, identificacion, correo_electronico, telefono'
          },
          empleadoResponsable: { type: ['object', 'null'], description: 'id, nombres, apellidos, cargo' },
          empleadoPreparacion: { type: ['object', 'null'], description: 'id, nombres, apellidos, cargo' },
          detalles: lista(ref('DetallePedido'))
        }
      },
      MiPedido: {
        description: 'Pedido de GET /pedidos/mios: sin cliente ni empleados, con su pago.',
        type: 'object',
        properties: {
          id: { type: 'integer' },
          fecha: { type: 'string', format: 'date' },
          hora: { type: 'string' },
          modalidad: ref('Modalidad'),
          estado: ref('EstadoPedido'),
          valor_total: { type: 'number' },
          detalles: lista(ref('DetallePedido')),
          pago: {
            oneOf: [{ type: 'null' }, ref('Pago')],
            description: 'id, fecha, valor, metodo_pago, numero_referencia, estado'
          }
        }
      },
      DocumentoLegal: {
        type: 'object',
        properties: {
          tipo: { enum: ['terminos', 'privacidad', 'eliminar-cuenta'] },
          titulo: { type: 'string' },
          version: { type: 'string', example: '2026-11-16.4' },
          secciones: lista({
            type: 'object',
            properties: { titulo: { type: 'string' }, parrafos: lista({ type: 'string' }) }
          })
        }
      },
      Carrito: {
        type: 'object',
        properties: {
          items: lista({
            type: 'object',
            properties: {
              producto_id: { type: 'integer' },
              cantidad: { type: 'integer', minimum: 1, maximum: 50 },
              producto: {
                type: 'object',
                description: 'Datos vigentes: id, nombre, precio, cantidad_disponible, estado, imagen_codigo'
              }
            }
          })
        }
      }
    }
  },
  paths: {
    '/health': {
      get: {
        tags: ['Sistema'],
        summary: 'Estado del servidor',
        responses: ok('Operando', undefined)
      }
    },

    // ---------------------------------------------------------------- Auth
    '/auth/login': {
      post: {
        tags: ['Autenticación'],
        summary: 'Iniciar sesión (RF-02)',
        description:
          'Busca primero en Clientes y luego en Empleados, por correo (sin distinguir mayúsculas) o por identificación. Límite: 10 intentos / 15 min por IP y correo.',
        ...cuerpo({
          type: 'object',
          required: ['email', 'password'],
          properties: {
            email: { type: 'string', description: 'Correo o identificación' },
            password: { type: 'string' }
          }
        }),
        responses: {
          200: { description: 'Sesión iniciada', content: json(ref('Sesion')) },
          ...E400,
          ...error('401', 'Credenciales inválidas (mismo mensaje para usuario inexistente y contraseña errónea)'),
          ...E429
        }
      }
    },
    '/auth/forgot-password': {
      post: {
        tags: ['Autenticación'],
        summary: 'Enviar código OTP por correo (RF-05)',
        description:
          'Responde lo mismo exista o no el correo, y aunque falle el envío (RNF-06). Genera un OTP de 6 dígitos que vence a los 15 min. Límite: 5 / 15 min por correo.',
        ...cuerpo({ type: 'object', required: ['email'], properties: { email: { type: 'string', format: 'email' } } }),
        responses: { ...ok('Mensaje genérico', undefined), ...E400, ...E429 }
      }
    },
    '/auth/reset-password': {
      post: {
        tags: ['Autenticación'],
        summary: 'Fijar contraseña nueva con el OTP (RF-05)',
        'x-reglas': ['RN-15', 'RNF-05'],
        ...cuerpo({
          type: 'object',
          required: ['email', 'otp', 'newPassword'],
          properties: {
            email: { type: 'string' },
            otp: { type: 'string', pattern: '^\\d{6}$' },
            newPassword: ref('Contrasenia')
          }
        }),
        responses: { ...ok('Contraseña cambiada', undefined), ...E400, ...E429 }
      }
    },
    '/auth/biometrico': {
      post: {
        tags: ['Autenticación'],
        summary: 'Iniciar sesión con la credencial del dispositivo (RF-02a)',
        description:
          'La app verifica antes la huella o el rostro en el teléfono. La credencial se rota en cada ingreso: hay que guardar la nueva. Vence a los 30 días sin uso. Límite: 20 / 15 min.',
        ...cuerpo({
          type: 'object',
          required: ['credencial'],
          properties: { credencial: { type: 'string', pattern: '^\\d{1,10}\\.[A-Za-z0-9_-]{43}$' } }
        }),
        responses: {
          200: {
            description: 'Sesión iniciada',
            content: json({
              allOf: [ref('Sesion'), { type: 'object', required: ['credencial'], properties: { credencial: { type: 'string' } } }]
            })
          },
          ...error('401', 'Credencial inválida, vencida, revocada o de una cuenta eliminada'),
          ...E429
        }
      },
      delete: {
        tags: ['Autenticación'],
        summary: 'Desactivar el ingreso con huella en este dispositivo',
        ...protegido(['cliente']),
        ...cuerpo({ type: 'object', properties: { credencial: { type: 'string' } } }, false),
        responses: { ...ok('Desactivado (también si la credencial no existía)', undefined), ...E401, ...E403 }
      }
    },
    '/auth/biometrico/activar': {
      post: {
        tags: ['Autenticación'],
        summary: 'Activar el ingreso con huella o rostro',
        description:
          'Crea una credencial `<id>.<secreto>` (el servidor guarda solo el SHA-256 del secreto). Máximo 5 por cliente: se borran las de uso más antiguo. Se revocan todas al cambiar la contraseña o eliminar la cuenta.',
        ...protegido(['cliente']),
        ...cuerpo({ type: 'object', properties: { dispositivo: { type: 'string', maxLength: 100 } } }, false),
        responses: {
          ...ok('Credencial creada', { type: 'object', properties: { credencial: { type: 'string' } } }, '201'),
          ...E401,
          ...E403
        }
      }
    },

    // --------------------------------------------------------------- Legal
    '/legal': {
      get: {
        tags: ['Legal'],
        summary: 'Versión vigente y documentos (RNF-21)',
        responses: ok('Índice', {
          type: 'object',
          properties: {
            version: { type: 'string' },
            documentos: lista({ type: 'object', properties: { tipo: { type: 'string' }, titulo: { type: 'string' } } })
          }
        })
      }
    },
    '/legal/{tipo}': {
      get: {
        tags: ['Legal'],
        summary: 'Términos o política de datos',
        parameters: [{ name: 'tipo', in: 'path', required: true, schema: { enum: ['terminos', 'privacidad'] } }],
        responses: { ...ok('Documento', ref('DocumentoLegal')), ...E404 }
      }
    },

    // ------------------------------------------------------------ Catálogo
    '/categorias': {
      get: { tags: ['Catálogo'], summary: 'Categorías ordenadas por nombre', responses: ok('Lista', lista(ref('Categoria'))) },
      post: {
        tags: ['Catálogo'],
        summary: 'Crear categoría (RF-09)',
        ...protegido(CAJA),
        ...cuerpo({ type: 'object', required: ['nombre'], properties: { nombre: { type: 'string' } } }),
        responses: { ...ok('Creada', ref('Categoria'), '201'), ...E400, ...E401, ...E403 }
      }
    },
    '/categorias/{id}': {
      parameters: [idParam()],
      get: { tags: ['Catálogo'], summary: 'Una categoría', responses: { ...ok('Categoría', ref('Categoria')), ...E404 } },
      put: {
        tags: ['Catálogo'],
        summary: 'Renombrar categoría',
        ...protegido(CAJA),
        ...cuerpo({ type: 'object', required: ['nombre'], properties: { nombre: { type: 'string' } } }),
        responses: { ...ok('Actualizada', ref('Categoria')), ...E400, ...E401, ...E403, ...E404 }
      },
      delete: {
        tags: ['Catálogo'],
        summary: 'Eliminar categoría (falla si tiene productos)',
        ...protegido(['admin']),
        responses: { ...ok('Eliminada', undefined), ...E400, ...E401, ...E403, ...E404 }
      }
    },
    '/productos': {
      get: {
        tags: ['Catálogo'],
        summary: 'Productos con su categoría, ordenados por nombre (RF-12)',
        description: 'Incluye los no disponibles y sin stock: la app los muestra deshabilitados.',
        responses: ok('Lista', lista(ref('Producto')))
      },
      post: {
        tags: ['Catálogo'],
        summary: 'Crear producto (RF-10, RF-11)',
        'x-reglas': ['RN-17'],
        ...protegido(CAJA),
        ...cuerpo({ allOf: [ref('ProductoEntrada'), { required: ['codigo', 'nombre', 'precio', 'categoria_id'] }] }),
        responses: { ...ok('Creado', ref('Producto'), '201'), ...E400, ...E401, ...E403 }
      }
    },
    '/productos/{id}': {
      parameters: [idParam()],
      get: { tags: ['Catálogo'], summary: 'Un producto', responses: { ...ok('Producto', ref('Producto')), ...E404 } },
      put: {
        tags: ['Catálogo'],
        summary: 'Editar producto (campos omitidos no cambian; imagen_codigo null o "" la quita)',
        ...protegido(CAJA),
        ...cuerpo(ref('ProductoEntrada')),
        responses: { ...ok('Actualizado', ref('Producto')), ...E400, ...E401, ...E403, ...E404 }
      },
      delete: {
        tags: ['Catálogo'],
        summary: 'Eliminar producto (falla si está en pedidos)',
        ...protegido(['admin']),
        responses: { ...ok('Eliminado', undefined), ...E400, ...E401, ...E403, ...E404 }
      }
    },

    // ------------------------------------------------------------ Usuarios
    '/clientes': {
      get: {
        tags: ['Usuarios'],
        summary: 'Clientes activos (sin eliminados), por apellido y nombre',
        ...protegido(['admin', 'empleado', 'cajero', 'mesero']),
        responses: { ...ok('Lista', lista(ref('Cliente'))), ...E401, ...E403 }
      },
      post: {
        tags: ['Usuarios'],
        summary: 'Registro de cliente (RF-01); también lo usa el personal',
        description:
          'Público. Sin token (o con token de cliente) exige `acepta_terminos: true` y `version_legal` igual a la vigente de GET /legal; guarda legal_version y legal_aceptado_en. Con token de personal no se exige (el personal no acepta por el cliente).',
        'x-reglas': ['RN-18', 'RNF-05'],
        ...cuerpo({
          type: 'object',
          required: ['identificacion', 'nombres', 'apellidos', 'correo_electronico', 'tipo_cliente', 'contrasenia'],
          properties: {
            identificacion: { type: 'string', maxLength: 20 },
            nombres: { type: 'string' },
            apellidos: { type: 'string' },
            correo_electronico: { type: 'string', format: 'email' },
            telefono: { type: ['string', 'null'] },
            tipo_cliente: ref('TipoCliente'),
            contrasenia: ref('Contrasenia'),
            acepta_terminos: { const: true },
            version_legal: { type: 'string' }
          }
        }),
        responses: {
          ...ok('Creado', ref('Cliente'), '201'),
          ...error('400', 'Datos inválidos, duplicado ("Ya existe un cliente con esa identificación o correo electrónico"), sin aceptar o con versión legal antigua ("...se actualizaron...")')
        }
      }
    },
    '/clientes/{id}': {
      parameters: [idParam()],
      get: {
        tags: ['Usuarios'],
        summary: 'Un cliente (el cliente solo el suyo)',
        ...protegido(['admin', 'cliente']),
        responses: { ...ok('Cliente', ref('Cliente')), ...E401, ...E403, ...E404 }
      },
      put: {
        tags: ['Usuarios'],
        summary: 'Editar cliente (RF-06, RN-16)',
        description:
          'Campos omitidos no cambian; telefono "" lo borra. Cambiar `contrasenia` exige `otp` (de /auth/forgot-password), salvo que lo haga el admin.',
        ...protegido(['admin', 'cliente']),
        ...cuerpo({
          type: 'object',
          properties: {
            identificacion: { type: 'string' },
            nombres: { type: 'string' },
            apellidos: { type: 'string' },
            correo_electronico: { type: 'string' },
            telefono: { type: ['string', 'null'] },
            tipo_cliente: ref('TipoCliente'),
            contrasenia: ref('Contrasenia'),
            otp: { type: 'string' }
          }
        }),
        responses: { ...ok('Actualizado', ref('Cliente')), ...E400, ...E401, ...E403, ...E404 }
      },
      delete: {
        tags: ['Usuarios'],
        summary: 'Eliminar cliente (falla si tiene pedidos)',
        ...protegido(['admin']),
        responses: { ...ok('Eliminado', undefined), ...E400, ...E401, ...E403, ...E404 }
      }
    },
    '/empleados': {
      get: {
        tags: ['Usuarios'],
        summary: 'Empleados (RF-07)',
        ...protegido(['admin']),
        responses: { ...ok('Lista', lista(ref('Empleado'))), ...E401, ...E403 }
      },
      post: {
        tags: ['Usuarios'],
        summary: 'Crear empleado',
        ...protegido(['admin']),
        ...cuerpo({
          type: 'object',
          required: ['identificacion', 'nombres', 'apellidos', 'correo_electronico', 'contrasenia'],
          properties: {
            identificacion: { type: 'string' },
            nombres: { type: 'string' },
            apellidos: { type: 'string' },
            correo_electronico: { type: 'string' },
            telefono: { type: ['string', 'null'] },
            cargo: { type: ['string', 'null'] },
            turno_trabajo: { type: ['string', 'null'] },
            contrasenia: ref('Contrasenia')
          }
        }),
        responses: { ...ok('Creado', ref('Empleado'), '201'), ...E400, ...E401, ...E403 }
      }
    },
    '/empleados/{id}': {
      parameters: [idParam()],
      get: {
        tags: ['Usuarios'],
        summary: 'Un empleado (no admin: solo el suyo)',
        ...protegido(['admin', 'empleado', 'cajero', 'mesero']),
        responses: { ...ok('Empleado', ref('Empleado')), ...E401, ...E403, ...E404 }
      },
      put: {
        tags: ['Usuarios'],
        summary: 'Editar empleado',
        description:
          'No admin: solo su perfil y sin cambiar cargo ni turno (403). Cambiar la contraseña exige `otp`, salvo el admin cambiando la de otro.',
        ...protegido(PERSONAL),
        ...cuerpo({ allOf: [ref('Empleado'), { type: 'object', properties: { contrasenia: ref('Contrasenia'), otp: { type: 'string' } } }] }),
        responses: { ...ok('Actualizado', ref('Empleado')), ...E400, ...E401, ...E403, ...E404 }
      },
      delete: {
        tags: ['Usuarios'],
        summary: 'Eliminar empleado',
        ...protegido(['admin']),
        responses: { ...ok('Eliminado', undefined), ...E400, ...E401, ...E403, ...E404 }
      }
    },

    // ------------------------------------------------------------- Pedidos
    '/pedidos': {
      get: {
        tags: ['Pedidos'],
        summary: 'Pedidos, del más reciente al más antiguo (RF-16)',
        description: 'Un cliente recibe solo los suyos. El personal puede filtrar por cliente.',
        ...protegido(['cliente', ...PERSONAL]),
        parameters: [{ name: 'cliente_id', in: 'query', schema: { type: 'integer', minimum: 1 } }],
        responses: { ...ok('Lista', lista(ref('Pedido'))), ...E400, ...E401, ...E403 }
      },
      post: {
        tags: ['Pedidos'],
        summary: 'Crear pedido (RF-14, RF-15)',
        description: [
          'En una transacción: agrupa líneas del mismo producto, bloquea las filas de producto (SELECT ... FOR UPDATE, por id ascendente),',
          'valida existencia, disponibilidad y stock, descuenta el stock, calcula precio_unitario (precio vigente), subtotal y total (redondeo a 2 decimales).',
          'Estado inicial "solicitado"; fecha y hora del servidor. Si lo crea un cliente: cliente_id = el del token, sin empleados, y se vacía su carrito.',
          'Si lo crea el personal: cliente_id obligatorio y empleado_id / empleado_preparacion_id opcionales.'
        ].join(' '),
        'x-reglas': ['RN-06', 'RN-07', 'RN-08', 'RN-19'],
        ...protegido(['cliente', 'admin', 'empleado', 'cajero', 'mesero']),
        ...cuerpo({
          type: 'object',
          required: ['modalidad', 'detalles'],
          properties: {
            modalidad: ref('Modalidad'),
            detalles: lista({
              type: 'object',
              required: ['producto_id', 'cantidad'],
              properties: { producto_id: { type: 'integer' }, cantidad: { type: 'integer', minimum: 1 } }
            }),
            cliente_id: { type: 'integer', description: 'Solo personal (obligatorio)' },
            empleado_id: { type: 'integer', description: 'Solo personal' },
            empleado_preparacion_id: { type: 'integer', description: 'Solo personal' }
          }
        }),
        responses: {
          ...ok('Creado', ref('Pedido'), '201'),
          ...error('400', 'Ej.: "Stock insuficiente para \\"X\\". Disponible: 3", "Cantidad máxima por producto: 50 (producto id N)", "El producto \\"X\\" no está disponible"'),
          ...E401,
          ...E403
        }
      }
    },
    '/pedidos/stats': {
      get: {
        tags: ['Reportes'],
        summary: 'Estadísticas del dashboard (RF-29 a RF-33)',
        'x-reglas': ['RN-13'],
        ...protegido(CAJA),
        parameters: [
          { name: 'desde', in: 'query', schema: { type: 'string', format: 'date' } },
          { name: 'hasta', in: 'query', schema: { type: 'string', format: 'date' } }
        ],
        responses: {
          ...ok('Estadísticas', {
            type: 'object',
            properties: {
              totalOrders: { type: 'integer', description: 'Pedidos del periodo (todos los estados)' },
              totalRevenue: { type: 'number', description: 'Suma de pagos aprobados de pedidos del periodo' },
              totalClients: { type: 'integer', description: 'Clientes registrados (sin filtro de fecha)' },
              orderStatusDistribution: { type: 'object', description: 'Cuenta por estado; los 6 estados siempre presentes' },
              modalityDistribution: { type: 'object', description: '{presencial, "en línea", desconocida}' },
              popularProducts: lista({
                type: 'object',
                description: 'Top 5 por unidades, sin pedidos cancelados',
                properties: { id: { type: 'integer' }, nombre: { type: 'string' }, precio: { type: 'number' }, totalVendido: { type: 'integer' } }
              })
            }
          }),
          ...error('400', 'Parámetros de fecha inválidos. Formato esperado YYYY-MM-DD'),
          ...E401,
          ...E403
        }
      }
    },
    '/pedidos/mios': {
      get: {
        tags: ['Pedidos'],
        summary: 'Mis pedidos con su pago (RF-26)',
        description: 'Del más reciente (id mayor) al más antiguo. La app consulta cada 3 s mientras haya pedidos en curso (RF-27).',
        ...protegido(['cliente']),
        responses: { ...ok('Lista', lista(ref('MiPedido'))), ...E401, ...E403 }
      }
    },
    '/pedidos/{id}': {
      parameters: [idParam()],
      get: {
        tags: ['Pedidos'],
        summary: 'Un pedido (el cliente solo los suyos)',
        ...protegido(),
        responses: { ...ok('Pedido (detalles con la categoría del producto)', ref('Pedido')), ...E401, ...E403, ...E404 }
      },
      put: {
        tags: ['Pedidos'],
        summary: 'Avanzar estado, asignar responsables, cambiar modalidad o cancelar (RF-17 a RF-19)',
        description: [
          'Transiciones válidas: solicitado → confirmado | en preparación | cancelado; confirmado → en preparación | cancelado;',
          'en preparación → listo | cancelado; listo → entregado | cancelado; entregado y cancelado son finales.',
          'Desde confirmado en adelante exige empleado_id. El cocinero no cancela (403).',
          'Cancelar devuelve el stock y pasa el pago pendiente a rechazado y el aprobado a reembolsado.'
        ].join(' '),
        'x-reglas': ['RN-01', 'RN-02', 'RN-03', 'RN-04'],
        ...protegido(['admin', 'empleado', 'cajero', 'cocinero']),
        ...cuerpo({
          type: 'object',
          properties: {
            estado: ref('EstadoPedido'),
            empleado_id: { type: ['integer', 'null'] },
            empleado_preparacion_id: { type: ['integer', 'null'] },
            modalidad: ref('Modalidad')
          }
        }),
        responses: { ...ok('Actualizado', ref('Pedido')), ...E400, ...E401, ...E403, ...E404 }
      },
      delete: {
        tags: ['Pedidos'],
        summary: 'Eliminar pedido solicitado o cancelado y sin pago (RF-20)',
        'x-reglas': ['RN-05'],
        ...protegido(['admin']),
        responses: { ...ok('Eliminado (devuelve el stock si no estaba cancelado)', undefined), ...E400, ...E401, ...E403, ...E404 }
      }
    },

    // --------------------------------------------------------------- Pagos
    '/pagos': {
      get: {
        tags: ['Pagos'],
        summary: 'Pagos con su pedido y cliente, por fecha descendente (RF-24)',
        ...protegido(CAJA),
        responses: { ...ok('Lista', lista(ref('Pago'))), ...E401, ...E403 }
      },
      post: {
        tags: ['Pagos'],
        summary: 'Registrar pago (RF-21)',
        description:
          'Un pago por pedido. El valor debe ser igual al total. Pedido confirmado o posterior, nunca cancelado. Si lo registra un cliente: solo de sus pedidos y siempre queda pendiente.',
        'x-reglas': ['RN-09', 'RN-10', 'RN-11', 'RN-12'],
        ...protegido(['cliente', 'admin', 'empleado', 'cajero', 'cocinero']),
        ...cuerpo({
          type: 'object',
          required: ['pedido_id', 'fecha', 'valor', 'metodo_pago'],
          properties: {
            pedido_id: { type: 'integer' },
            fecha: { type: 'string', format: 'date-time' },
            valor: { type: 'number' },
            metodo_pago: ref('MetodoPago'),
            numero_referencia: { type: ['string', 'null'] },
            estado: { enum: ['pendiente', 'aprobado', 'rechazado'] }
          }
        }),
        responses: { ...ok('Registrado', ref('Pago'), '201'), ...E400, ...E401, ...E403 }
      }
    },
    '/pagos/mios': {
      get: {
        tags: ['Pagos'],
        summary: 'Mis pagos registrados, del más reciente al más antiguo',
        ...protegido(['cliente']),
        responses: {
          ...ok('Lista', lista({
            allOf: [ref('Pago'), { type: 'object', properties: { pedido: { type: 'object', description: 'id, fecha, hora, estado, valor_total' } } }]
          })),
          ...E401,
          ...E403
        }
      }
    },
    '/pagos/payphone/preparar': {
      post: {
        tags: ['Pagos'],
        summary: 'Iniciar el pago con tarjeta por Payphone (RF-22)',
        description: [
          'Crea una TransaccionPayphone (client_tx_id "SP<pedido>-<12 hex>") y llama a Payphone POST /api/button/Prepare',
          '(amount = amountWithoutTax = total en centavos, currency USD, storeId opcional, reference "Pedido #N · Sabor Politécnico",',
          'responseUrl = PAYPHONE_RESPONSE_URL, cancellationUrl = la misma con clientTransactionId y cancelado=1).',
          'Devuelve la URL de la página intermedia /pagos/payphone/ir?u=<payWithCard>. Pedido del cliente, no cancelado y sin pago cerrado (solo un pago pendiente se puede reemplazar).'
        ].join(' '),
        ...protegido(['cliente']),
        ...cuerpo({ type: 'object', required: ['pedido_id'], properties: { pedido_id: { type: 'integer' } } }),
        responses: {
          ...ok('Pago iniciado', {
            type: 'object',
            properties: { url: { type: 'string', format: 'uri' }, client_transaction_id: { type: 'string' } }
          }, '201'),
          ...E400,
          ...E401,
          ...E403,
          ...E404,
          ...error('502', 'Payphone no respondió o no devolvió payWithCard'),
          ...error('503', 'Payphone no configurado (falta PAYPHONE_TOKEN o PAYPHONE_RESPONSE_URL)')
        }
      }
    },
    '/pagos/pedido/{pedidoId}': {
      parameters: [idParam('pedidoId')],
      get: {
        tags: ['Pagos'],
        summary: 'Pago de un pedido (el cliente solo de los suyos)',
        ...protegido(),
        responses: { ...ok('Pago', ref('Pago')), ...E401, ...E403, ...E404 }
      }
    },
    '/pagos/{id}': {
      parameters: [idParam()],
      get: {
        tags: ['Pagos'],
        summary: 'Un pago (el cliente solo los suyos)',
        ...protegido(),
        responses: { ...ok('Pago', ref('Pago')), ...E401, ...E403, ...E404 }
      },
      put: {
        tags: ['Pagos'],
        summary: 'Actualizar pago (RF-23)',
        description: 'No se aprueba el pago de un pedido cancelado; el valor debe seguir igual al total.',
        ...protegido(CAJA),
        ...cuerpo({
          type: 'object',
          properties: {
            fecha: { type: 'string', format: 'date-time' },
            valor: { type: 'number' },
            metodo_pago: ref('MetodoPago'),
            numero_referencia: { type: ['string', 'null'] },
            estado: { enum: ['pendiente', 'aprobado', 'rechazado'] }
          }
        }),
        responses: { ...ok('Actualizado', ref('Pago')), ...E400, ...E401, ...E403, ...E404 }
      },
      delete: {
        tags: ['Pagos'],
        summary: 'Eliminar pago (RF-25)',
        ...protegido(['admin']),
        responses: { ...ok('Eliminado', undefined), ...E401, ...E403, ...E404 }
      }
    },

    // ----------------------------------------------------- Cliente (app)
    '/perfil': {
      get: {
        tags: ['App del cliente'],
        summary: 'Mi perfil (RF-06)',
        ...protegido(['cliente']),
        responses: {
          ...ok('Perfil', {
            allOf: [ref('Cliente'), { type: 'object', properties: { foto_actualizada_en: { type: ['string', 'null'], format: 'date-time' } } }]
          }),
          ...E401,
          ...E403
        }
      },
      put: {
        tags: ['App del cliente'],
        summary: 'Editar mi perfil (mismas reglas que PUT /clientes/{id})',
        ...protegido(['cliente']),
        ...cuerpo({
          type: 'object',
          properties: {
            nombres: { type: 'string' },
            apellidos: { type: 'string' },
            telefono: { type: ['string', 'null'] },
            tipo_cliente: ref('TipoCliente'),
            contrasenia: ref('Contrasenia'),
            otp: { type: 'string' }
          }
        }),
        responses: { ...ok('Actualizado', ref('Cliente')), ...E400, ...E401, ...E403 }
      }
    },
    '/perfil/foto': {
      get: {
        tags: ['App del cliente'],
        summary: 'Mi foto de perfil',
        ...protegido(['cliente']),
        responses: {
          ...ok('Foto', {
            type: 'object',
            properties: {
              tipo: { enum: ['image/jpeg', 'image/png', 'image/webp'] },
              imagen: { type: 'string', contentEncoding: 'base64' },
              actualizada_en: { type: 'string', format: 'date-time' }
            }
          }),
          ...E401,
          ...E403,
          ...error('404', 'No tienes foto de perfil')
        }
      },
      put: {
        tags: ['App del cliente'],
        summary: 'Subir o reemplazar la foto',
        description: 'Base64 sin prefijo data:. Máx. 600 KB decodificada (cuerpo hasta 1 MB). El tipo se detecta por los bytes (JPEG, PNG o WebP).',
        ...protegido(['cliente']),
        ...cuerpo({ type: 'object', required: ['imagen'], properties: { imagen: { type: 'string', contentEncoding: 'base64' } } }),
        responses: {
          ...ok('Guardada', { type: 'object', properties: { foto_actualizada_en: { type: 'string', format: 'date-time' } } }),
          ...E400,
          ...E401,
          ...E403
        }
      },
      delete: {
        tags: ['App del cliente'],
        summary: 'Quitar la foto',
        ...protegido(['cliente']),
        responses: { ...ok('Eliminada', undefined), ...E401, ...E403 }
      }
    },
    '/carrito': {
      get: {
        tags: ['App del cliente'],
        summary: 'Mi carrito guardado en el servidor (RF-13)',
        description: 'En el orden en que se agregaron, con los datos vigentes del producto.',
        ...protegido(['cliente']),
        responses: { ...ok('Carrito', ref('Carrito')), ...E401, ...E403 }
      },
      put: {
        tags: ['App del cliente'],
        summary: 'Reemplazar el carrito completo',
        description:
          'Cantidad entera 1–50, sin productos repetidos, máximo 100 productos. Los productos inexistentes se ignoran. El stock se valida al crear el pedido. Responde el carrito guardado.',
        ...protegido(['cliente']),
        ...cuerpo({
          type: 'object',
          required: ['items'],
          properties: {
            items: lista({
              type: 'object',
              required: ['producto_id', 'cantidad'],
              properties: { producto_id: { type: 'integer', minimum: 1 }, cantidad: { type: 'integer', minimum: 1, maximum: 50 } }
            })
          }
        }),
        responses: { ...ok('Guardado', ref('Carrito')), ...E400, ...E401, ...E403 }
      }
    },
    '/privacidad/mis-datos': {
      get: {
        tags: ['App del cliente'],
        summary: 'Descargar mis datos (LOPDP: acceso y portabilidad)',
        ...protegido(['cliente']),
        responses: {
          ...ok('Datos', {
            type: 'object',
            properties: {
              generado_en: { type: 'string', format: 'date-time' },
              cliente: { type: 'object', description: 'identificacion, nombres, apellidos, correo_electronico, telefono, tipo_cliente, registrado_en, actualizado_en' },
              foto_perfil: { type: ['object', 'null'], description: 'tipo, actualizada_en, imagen_base64' },
              ingreso_biometrico: lista({ type: 'object', description: 'dispositivo, activado_en, ultimo_uso (sin la credencial)' }),
              carrito: lista({ type: 'object', description: 'producto (nombre), cantidad, agregado_en' }),
              aceptacion_legal: { type: ['object', 'null'], description: 'version, aceptado_en' },
              pedidos: lista({ type: 'object', description: 'id, fecha, hora, modalidad, estado, valor_total, productos[], pago' })
            }
          }),
          ...E401,
          ...E403
        }
      }
    },
    '/privacidad/mi-cuenta': {
      delete: {
        tags: ['App del cliente'],
        summary: 'Eliminar mi cuenta (LOPDP art. 15)',
        description: [
          'Confirma con la contraseña. No se permite con pedidos en curso (no entregados ni cancelados).',
          'Borra foto, carrito y credenciales biométricas; reemplaza identificacion por "ELIMINADO-<id>", nombres "Cliente", apellidos "eliminado",',
          'correo "eliminado-<id>@eliminado.invalid", telefono null, contraseña aleatoria, datos legales null y marca eliminado_en.',
          'La fila se conserva (los pedidos y pagos la referencian, anónimos). Las sesiones abiertas dejan de valer.'
        ].join(' '),
        ...protegido(['cliente']),
        ...cuerpo({ type: 'object', required: ['contrasenia'], properties: { contrasenia: { type: 'string' } } }),
        responses: { ...ok('Cuenta eliminada', undefined), ...E400, ...E401, ...E403, ...E404 }
      }
    },
    '/openapi.json': {
      get: { tags: ['Sistema'], summary: 'Este documento', responses: { 200: { description: 'OpenAPI 3.1' } } }
    },

    // ----------------------------------- Páginas HTML (fuera de /api/v1)
    '/legal/terminos': { get: { tags: ['Páginas públicas'], summary: 'Términos (HTML con colores de marca)', ...pagina('Página') } },
    '/legal/privacidad': { get: { tags: ['Páginas públicas'], summary: 'Política de datos (HTML); URL para las tiendas', ...pagina('Página') } },
    '/legal/eliminar-cuenta': { get: { tags: ['Páginas públicas'], summary: 'Cómo eliminar la cuenta (HTML); enlace que exige Google Play', ...pagina('Página') } },
    '/pagos/payphone/ir': {
      get: {
        tags: ['Páginas públicas'],
        summary: 'Página intermedia que abre el formulario de Payphone',
        description:
          'Payphone responde "No autorizado" si el pago no llega con el Referer del dominio registrado. Esta página (Referrer-Policy: origin, CSP con nonce) redirige a `u`, que solo puede ser https://*.payphonetodoesposible.com.',
        parameters: [{ name: 'u', in: 'query', required: true, schema: { type: 'string', format: 'uri' } }],
        ...pagina('Redirección (400 si `u` no es de Payphone)')
      }
    },
    '/pagos/payphone/retorno': {
      get: {
        tags: ['Páginas públicas'],
        summary: 'URL de respuesta de Payphone (PAYPHONE_RESPONSE_URL)',
        description: [
          'Payphone vuelve con ?id=<transactionId>&clientTransactionId=<client_tx_id> (o cancelado=1).',
          'El backend llama a POST /api/button/V2/Confirm {id, clientTxId}; si statusCode = 3 (aprobada) y coinciden clientTransactionId y amount (centavos),',
          'en una transacción marca la TransaccionPayphone aprobada y crea o actualiza el Pago: metodo tarjeta, numero_referencia "Payphone <transactionId>",',
          'estado aprobado (reembolsado si el pedido ya estaba cancelado). Idempotente. Cancelado o rechazado: la transacción pasa a cancelada y no se crea pago.',
          'La página muestra el resultado y un botón a saborpolitecnico://app/pedidos/<id>/pago.'
        ].join(' '),
        parameters: [
          { name: 'id', in: 'query', schema: { type: 'string' } },
          { name: 'clientTransactionId', in: 'query', schema: { type: 'string' } },
          { name: 'cancelado', in: 'query', schema: { type: 'string' } }
        ],
        ...pagina('Resultado del pago (404 si la transacción no existe, 502 si Payphone no confirma)')
      }
    }
  }
};
