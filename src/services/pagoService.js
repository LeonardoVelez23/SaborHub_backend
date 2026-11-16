import { ErrorNegocio } from '../errors/ErrorNegocio.js';

export const METODOS_PAGO = ['efectivo', 'tarjeta', 'transferencia'];

/** Estados que se asignan a mano; `reembolsado` solo lo pone el sistema. */
const ESTADOS_MANUALES = ['pendiente', 'aprobado', 'rechazado'];

const validarMetodo = (metodo) => {
  if (!METODOS_PAGO.includes(metodo)) {
    throw new ErrorNegocio('metodo_pago debe ser: efectivo, tarjeta o transferencia');
  }
};

const validarEstado = (estado) => {
  if (!ESTADOS_MANUALES.includes(estado)) {
    throw new ErrorNegocio('estado debe ser: pendiente, aprobado o rechazado');
  }
};

const validarValor = (valor, totalPedido) => {
  if (Number(valor) <= 0) throw new ErrorNegocio('El valor del pago debe ser mayor a 0');
  // RN-11: el pago cubre exactamente el pedido.
  if (totalPedido !== undefined && Number(valor) !== Number(totalPedido)) {
    throw new ErrorNegocio(
      `El valor del pago (${valor}) debe coincidir con el total del pedido (${totalPedido})`
    );
  }
};

const sinPermiso = () => new ErrorNegocio('No tiene permisos para ver este pago', 403);

/**
 * Pagos registrados en caja o por el personal (RF-21, RF-23 a RF-25,
 * RN-09 a RN-12). El pago con tarjeta en línea está en pagoTarjetaService.
 */
export const crearPagoService = ({ pagos, pedidos }) => ({
  listar: () => pagos.listar(),

  misPagos: (clienteId) => pagos.listarDeCliente(clienteId),

  obtener: async (id, usuario) => {
    const pago = await pagos.buscarDetallado(id);
    if (!pago) throw new ErrorNegocio('Pago no encontrado', 404);
    if (usuario.rol === 'cliente' && pago.pedido?.cliente_id !== usuario.id) throw sinPermiso();
    return pago;
  },

  delPedido: async (pedidoId, usuario) => {
    if (usuario.rol === 'cliente') {
      const pedido = await pedidos.buscar(pedidoId, { atributos: ['id', 'cliente_id'] });
      if (pedido && pedido.cliente_id !== usuario.id) throw sinPermiso();
    }
    const pago = await pagos.delPedido(pedidoId);
    if (!pago) throw new ErrorNegocio('No se encontró pago para este pedido', 404);
    return pago;
  },

  /**
   * Un pago por pedido, por su total exacto, con el pedido confirmado o
   * después y nunca cancelado. Un cliente no aprueba su propio pago: queda
   * pendiente hasta que el personal lo confirme.
   */
  crear: async (usuario, { pedido_id, fecha, valor, metodo_pago, numero_referencia, estado }) => {
    if (!pedido_id || !fecha || valor === undefined || !metodo_pago) {
      throw new ErrorNegocio('pedido_id, fecha, valor y metodo_pago son obligatorios');
    }
    validarValor(valor);
    validarMetodo(metodo_pago);

    const esCliente = usuario.rol === 'cliente';
    const estadoFinal = esCliente ? 'pendiente' : estado || 'pendiente';
    validarEstado(estadoFinal);

    const pedido = await pedidos.buscar(pedido_id);
    if (!pedido) throw new ErrorNegocio('El pedido indicado no existe');
    if (esCliente && pedido.cliente_id !== usuario.id) {
      throw new ErrorNegocio('No tiene permisos para pagar este pedido', 403);
    }
    if (pedido.estado === 'cancelado') {
      throw new ErrorNegocio('No se puede registrar pago: el pedido está cancelado y no requiere pago');
    }
    if (pedido.estado === 'solicitado') {
      throw new ErrorNegocio('El pedido debe estar al menos confirmado para registrar un pago');
    }
    validarValor(valor, pedido.valor_total);

    const yaPagado = new ErrorNegocio('Este pedido ya tiene un pago registrado');
    if (await pagos.existeDelPedido(pedido_id)) throw yaPagado;

    let pago;
    try {
      pago = await pagos.crear({
        pedido_id,
        fecha,
        valor,
        metodo_pago,
        numero_referencia: numero_referencia?.trim() || null,
        estado: estadoFinal
      });
    } catch (error) {
      // Otro pago se registró al mismo tiempo (pedido_id es único).
      if (error.name === 'SequelizeUniqueConstraintError') throw yaPagado;
      throw error;
    }
    return pagos.buscarConResumen(pago.id);
  },

  /** RN-12: no se aprueba el pago de un pedido cancelado. */
  actualizar: async (id, { fecha, valor, metodo_pago, numero_referencia, estado }) => {
    const pago = await pagos.buscarConPedido(id);
    if (!pago) throw new ErrorNegocio('Pago no encontrado', 404);

    if (pago.pedido?.estado === 'cancelado' && estado === 'aprobado') {
      throw new ErrorNegocio('No se puede aprobar un pago de un pedido cancelado');
    }
    if (valor !== undefined) validarValor(valor, pago.pedido?.valor_total);
    if (metodo_pago) validarMetodo(metodo_pago);
    if (estado) {
      validarEstado(estado);
      if (estado === 'aprobado') {
        const aprobado = await pagos.aprobadoDelPedido(pago.pedido_id);
        if (aprobado && aprobado.id !== pago.id) {
          throw new ErrorNegocio('Este pedido ya tiene un pago aprobado');
        }
      }
    }

    await pagos.actualizar(pago, {
      fecha: fecha ?? pago.fecha,
      valor: valor ?? pago.valor,
      metodo_pago: metodo_pago ?? pago.metodo_pago,
      numero_referencia:
        numero_referencia !== undefined ? numero_referencia?.trim() || null : pago.numero_referencia,
      estado: estado ?? pago.estado
    });
    return pagos.buscarConResumen(id);
  },

  eliminar: async (id) => {
    const pago = await pagos.buscar(id);
    if (!pago) throw new ErrorNegocio('Pago no encontrado', 404);
    await pagos.eliminar(pago);
  }
});
