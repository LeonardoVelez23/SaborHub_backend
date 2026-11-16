import { ErrorNegocio } from '../errors/ErrorNegocio.js';
import {
  ESTADOS,
  ESTADOS_CON_RESPONSABLE,
  ESTADOS_ELIMINABLES,
  agruparDetalles,
  calcularLineas,
  cantidadesDeLineas,
  esFechaValida,
  estadoPagoAlCancelar,
  validarModalidad,
  validarTransicion
} from './reglasPedido.js';

/**
 * Casos de uso de los pedidos (RF-14 a RF-20, RF-26, RF-29 a RF-33).
 * Recibe sus dependencias (repositorios, transacciones y reloj): se prueba
 * con implementaciones en memoria, sin base de datos.
 *
 * `usuario` es el de la sesión: {id, rol}.
 */
export const crearPedidoService = ({ pedidos, productos, pagos, personas, transacciones, reloj }) => {
  /** null/'' → sin empleado; un id → debe existir. */
  const empleadoValido = async (id, campo, t) => {
    if (id === undefined || id === null || id === '') return null;
    const empleado = await personas.empleado(id, t);
    if (!empleado) throw new ErrorNegocio(`El empleado indicado en ${campo} no existe`);
    return empleado.id;
  };

  /**
   * Bloquea los productos, valida y descuenta el stock: dos pedidos
   * simultáneos no pueden vender la misma unidad (RN-06).
   */
  const reservarStock = async (cantidades, t) => {
    const filas = await productos.bloquear(cantidades.keys(), t);
    const porId = new Map(filas.map((p) => [p.id, p]));
    const resultado = calcularLineas(cantidades, porId);
    for (const { producto_id: id, cantidad } of resultado.lineas) {
      await productos.descontar(porId.get(id), cantidad, t);
    }
    return resultado;
  };

  /** Devuelve al stock las cantidades de las líneas (RN-04, RN-05). */
  const devolverStock = async (detalles, t) => {
    const cantidades = cantidadesDeLineas(detalles);
    if (cantidades.size === 0) return;
    for (const producto of await productos.bloquear(cantidades.keys(), t)) {
      await productos.reponer(producto, cantidades.get(producto.id), t);
    }
  };

  return {
    /** El cliente ve solo los suyos; el personal puede filtrar por cliente. */
    listar: (usuario, { clienteId } = {}) => {
      if (usuario.rol === 'cliente') return pedidos.listar({ clienteId: usuario.id });
      if (clienteId === undefined) return pedidos.listar();
      const id = Number(clienteId);
      if (!Number.isInteger(id) || id <= 0) throw new ErrorNegocio('cliente_id inválido');
      return pedidos.listar({ clienteId: id });
    },

    misPedidos: (clienteId) => pedidos.listarDeCliente(clienteId),

    obtener: async (id, usuario) => {
      const pedido = await pedidos.buscarCompleto(id, { conCategoria: true });
      if (!pedido) throw new ErrorNegocio('Pedido no encontrado', 404);
      if (usuario.rol === 'cliente' && pedido.cliente_id !== usuario.id) {
        throw new ErrorNegocio('No tiene permisos para ver este pedido', 403);
      }
      return pedido;
    },

    /**
     * El cliente del pedido sale de la sesión (o de los datos, si lo
     * registra el personal), y la fecha y hora del reloj del servidor
     * (RN-19). Si lo hace el cliente, se vacía su carrito.
     */
    crear: async (usuario, { modalidad, detalles, cliente_id, empleado_id, empleado_preparacion_id }) => {
      const pedidoId = await transacciones.ejecutar(async (t) => {
        validarModalidad(modalidad);
        const cantidades = agruparDetalles(detalles);

        const esCliente = usuario.rol === 'cliente';
        const clienteId = esCliente ? usuario.id : cliente_id;
        if (!clienteId) {
          throw new ErrorNegocio('cliente_id es obligatorio para registrar un pedido a nombre de un cliente');
        }
        const cliente = await personas.cliente(clienteId, t);
        if (!cliente) throw new ErrorNegocio('El cliente indicado no existe');

        // Un cliente no asigna personal a su pedido.
        const empleadoId = esCliente ? null : await empleadoValido(empleado_id, 'empleado_id', t);
        const preparacionId = esCliente
          ? null
          : await empleadoValido(empleado_preparacion_id, 'empleado_preparacion_id', t);

        const { lineas, total } = await reservarStock(cantidades, t);
        const { fecha, hora } = reloj();

        const pedido = await pedidos.crear(
          {
            fecha,
            hora,
            modalidad,
            estado: 'solicitado',
            valor_total: total,
            cliente_id: cliente.id,
            empleado_id: empleadoId,
            empleado_preparacion_id: preparacionId
          },
          t
        );
        await pedidos.crearDetalles(pedido.id, lineas, t);
        if (esCliente) await personas.vaciarCarrito(cliente.id, t);
        return pedido.id;
      });
      return pedidos.buscarCompleto(pedidoId);
    },

    /**
     * Avanza el estado, asigna responsables, cambia la modalidad o cancela
     * (RN-01 a RN-04). El pedido se bloquea: dos cancelaciones simultáneas
     * no devuelven el stock dos veces.
     */
    actualizar: async (id, usuario, { estado, empleado_id, empleado_preparacion_id, modalidad }) => {
      await transacciones.ejecutar(async (t) => {
        const pedido = await pedidos.bloquear(id, t);
        if (!pedido) throw new ErrorNegocio('Pedido no encontrado', 404);

        if (estado) validarTransicion(pedido.estado, estado, usuario.rol?.toLowerCase());

        const nuevoEstado = estado ?? pedido.estado;
        const nuevoEmpleado = empleado_id !== undefined ? empleado_id : pedido.empleado_id;
        if (ESTADOS_CON_RESPONSABLE.includes(nuevoEstado) && !nuevoEmpleado) {
          throw new ErrorNegocio('Debe asignar un empleado responsable para este estado del pedido');
        }
        if (empleado_id) await empleadoValido(empleado_id, 'empleado_id', t);
        if (empleado_preparacion_id) {
          await empleadoValido(empleado_preparacion_id, 'empleado_preparacion_id', t);
        }
        if (modalidad) validarModalidad(modalidad);

        if (estado === 'cancelado') {
          await devolverStock(await pedidos.detalles(pedido.id, t), t);
          const pago = await pagos.bloquearDelPedido(pedido.id, t);
          const nuevoEstadoPago = pago && estadoPagoAlCancelar(pago.estado);
          if (nuevoEstadoPago) await pagos.actualizar(pago, { estado: nuevoEstadoPago }, t);
        }

        await pedidos.actualizar(
          pedido,
          {
            estado: nuevoEstado,
            empleado_id: nuevoEmpleado,
            empleado_preparacion_id:
              empleado_preparacion_id !== undefined
                ? empleado_preparacion_id || null
                : pedido.empleado_preparacion_id,
            modalidad: modalidad ?? pedido.modalidad
          },
          t
        );
      });
      return pedidos.buscarCompleto(id);
    },

    /** Solo solicitados o cancelados y sin pago; devuelve el stock (RN-05). */
    eliminar: (id) =>
      transacciones.ejecutar(async (t) => {
        const pedido = await pedidos.bloquear(id, t);
        if (!pedido) throw new ErrorNegocio('Pedido no encontrado', 404);
        if (!ESTADOS_ELIMINABLES.includes(pedido.estado)) {
          throw new ErrorNegocio('Solo se pueden eliminar pedidos en estado solicitado o cancelado');
        }
        // El pago (rechazado o reembolsado) es parte del registro contable.
        if (await pagos.contarDelPedido(pedido.id, t)) {
          throw new ErrorNegocio('No se puede eliminar un pedido que tiene un pago registrado');
        }
        // Al cancelar ya se devolvió el stock.
        if (pedido.estado !== 'cancelado') {
          await devolverStock(await pedidos.detalles(pedido.id, t), t);
        }
        await pedidos.eliminar(pedido, t);
      }),

    /** Dashboard (RF-29 a RF-33); fechas opcionales AAAA-MM-DD. */
    estadisticas: async ({ desde, hasta } = {}) => {
      if (!esFechaValida(desde) || !esFechaValida(hasta)) {
        throw new ErrorNegocio('Parámetros de fecha inválidos. Formato esperado YYYY-MM-DD');
      }
      const rango = { desde, hasta };

      const totalOrders = await pedidos.contar(rango);
      const totalRevenue = await pedidos.ingresos(rango);
      // Total global: no depende del rango de fechas.
      const totalClients = await personas.contarClientes();

      const orderStatusDistribution = Object.fromEntries(ESTADOS.map((e) => [e, 0]));
      for (const { valor, cantidad } of await pedidos.contarPorColumna('estado', rango)) {
        orderStatusDistribution[valor] = cantidad;
      }

      const modalityDistribution = { presencial: 0, 'en línea': 0, desconocida: 0 };
      for (const { valor, cantidad } of await pedidos.contarPorColumna('modalidad', rango)) {
        if (valor === 'presencial' || valor === 'en línea') modalityDistribution[valor] = cantidad;
        else modalityDistribution.desconocida += cantidad;
      }

      const popularProducts = await pedidos.masVendidos(rango, 5);

      return {
        totalOrders,
        totalRevenue,
        totalClients,
        orderStatusDistribution,
        modalityDistribution,
        popularProducts
      };
    }
  };
};
