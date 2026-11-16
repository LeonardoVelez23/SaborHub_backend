import { ErrorNegocio } from '../errors/ErrorNegocio.js';

/**
 * Reglas de negocio de los pedidos, sin base de datos ni HTTP (funciones
 * puras: se prueban con datos en memoria). Ver DERCAS 5.1 y 5.2.
 */

export const MODALIDADES = ['presencial', 'en línea'];

export const MAX_UNIDADES_POR_PRODUCTO = 50;

/** Diagrama de estados (RN-01). Entregado y cancelado son finales. */
export const TRANSICIONES = {
  solicitado: ['confirmado', 'en preparación', 'cancelado'],
  confirmado: ['en preparación', 'cancelado'],
  'en preparación': ['listo', 'cancelado'],
  listo: ['entregado', 'cancelado'],
  entregado: [],
  cancelado: []
};

export const ESTADOS = Object.keys(TRANSICIONES);

/** Desde confirmado en adelante el pedido necesita responsable (RN-02). */
export const ESTADOS_CON_RESPONSABLE = ['confirmado', 'en preparación', 'listo', 'entregado'];

/** Solo se eliminan pedidos en estos estados (RN-05). */
export const ESTADOS_ELIMINABLES = ['solicitado', 'cancelado'];

export const validarModalidad = (modalidad) => {
  if (!MODALIDADES.includes(modalidad)) {
    throw new ErrorNegocio('modalidad debe ser: presencial o en línea');
  }
};

/**
 * Valida las líneas del pedido y suma las cantidades de un mismo producto
 * (RN-06). Devuelve un Map producto_id → cantidad total.
 */
export const agruparDetalles = (detalles) => {
  if (!Array.isArray(detalles) || detalles.length === 0) {
    throw new ErrorNegocio('detalles debe ser un array con al menos 1 producto');
  }

  const cantidades = new Map();
  for (const item of detalles) {
    const productoId = Number(item?.producto_id);
    const { cantidad } = item ?? {};
    if (!Number.isInteger(productoId) || productoId < 1 || !Number.isInteger(cantidad) || cantidad < 1) {
      throw new ErrorNegocio('Cada detalle debe tener producto_id y una cantidad entera >= 1');
    }
    cantidades.set(productoId, (cantidades.get(productoId) ?? 0) + cantidad);
  }

  for (const [productoId, cantidad] of cantidades) {
    if (cantidad > MAX_UNIDADES_POR_PRODUCTO) {
      throw new ErrorNegocio(
        `Cantidad máxima por producto: ${MAX_UNIDADES_POR_PRODUCTO} (producto id ${productoId})`
      );
    }
  }
  return cantidades;
};

const redondear = (valor) => Math.round(valor * 100) / 100;

/**
 * Comprueba existencia, disponibilidad y stock de cada producto y calcula
 * las líneas con el precio vigente (RN-06, RN-07). `productos` es un Map
 * id → {nombre, estado, precio, cantidad_disponible}.
 */
export const calcularLineas = (cantidades, productos) => {
  const lineas = [];
  let total = 0;
  for (const [productoId, cantidad] of cantidades) {
    const producto = productos.get(productoId);
    if (!producto) {
      throw new ErrorNegocio(`El producto con id ${productoId} no existe`);
    }
    if (producto.estado === 'no disponible') {
      throw new ErrorNegocio(`El producto "${producto.nombre}" no está disponible`);
    }
    if (producto.cantidad_disponible < cantidad) {
      throw new ErrorNegocio(
        `Stock insuficiente para "${producto.nombre}". Disponible: ${producto.cantidad_disponible}`
      );
    }
    const precioUnitario = Number(producto.precio);
    const subtotal = redondear(precioUnitario * cantidad);
    total += subtotal;
    lineas.push({ producto_id: productoId, cantidad, precio_unitario: precioUnitario, subtotal });
  }
  return { lineas, total: redondear(total) };
};

/** Suma por producto las cantidades de las líneas de un pedido. */
export const cantidadesDeLineas = (detalles) => {
  const cantidades = new Map();
  for (const d of detalles) {
    cantidades.set(d.producto_id, (cantidades.get(d.producto_id) ?? 0) + d.cantidad);
  }
  return cantidades;
};

/**
 * Comprueba un cambio de estado (RN-01, RN-03). `rol` es el de quien lo
 * pide; el cocinero no cancela.
 */
export const validarTransicion = (estadoActual, nuevoEstado, rol) => {
  if (nuevoEstado === 'cancelado' && rol === 'cocinero') {
    throw new ErrorNegocio('Los cocineros no tienen permiso para cancelar pedidos', 403);
  }
  const permitidos = TRANSICIONES[estadoActual] || [];
  if (!permitidos.includes(nuevoEstado)) {
    throw new ErrorNegocio(
      `No se puede cambiar de "${estadoActual}" a "${nuevoEstado}". Transiciones válidas: ${permitidos.join(', ') || 'ninguna (estado final)'}`
    );
  }
};

/**
 * Estado del pago cuando se cancela su pedido (RN-04): el pendiente ya no
 * se cobrará y el aprobado se devuelve. null = no cambia.
 */
export const estadoPagoAlCancelar = (estadoPago) =>
  ({ pendiente: 'rechazado', aprobado: 'reembolsado' })[estadoPago] ?? null;

/** AAAA-MM-DD que exista en el calendario (RF-33). Vacío = sin filtro. */
export const esFechaValida = (valor) => {
  if (!valor) return true;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(valor)) return false;
  const fecha = new Date(valor);
  const [anio, mes, dia] = valor.split('-').map(Number);
  return (
    !Number.isNaN(fecha.getTime()) &&
    fecha.getUTCFullYear() === anio &&
    fecha.getUTCMonth() + 1 === mes &&
    fecha.getUTCDate() === dia
  );
};
