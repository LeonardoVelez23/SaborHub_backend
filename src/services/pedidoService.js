import { ErrorNegocio } from '../errors/ErrorNegocio.js';
import { SIN_FILTRO, alcanceDe, sucursalDeProductos } from './alcance.js';
import { abiertaEn } from './horario.js';
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
export const crearPedidoService = ({ pedidos, productos, pagos, personas, sucursales, afiliacion, transacciones, reloj }) => {
  const esCliente = (usuario) => usuario.rol === 'cliente';
  /** El cliente ve lo suyo (se filtra por cliente); el personal, su alcance. */
  const alcanceDel = (usuario) => (esCliente(usuario) ? SIN_FILTRO : alcanceDe(usuario));

  /** null/'' → sin empleado; un id → debe existir y ser de la sucursal del pedido. */
  const empleadoValido = async (id, campo, sucursalId, t) => {
    if (id === undefined || id === null || id === '') return null;
    const empleado = await personas.empleado(id, t);
    if (!empleado || empleado.sucursal_id !== sucursalId) {
      throw new ErrorNegocio(`El empleado indicado en ${campo} no existe`);
    }
    return empleado.id;
  };

  /**
   * La sucursal recibe pedidos: activa, con su restaurante activo y dentro de su horario (RN-22).
   * El personal solo registra pedidos de su alcance (RN-21).
   */
  const sucursalQueRecibe = async (sucursalId, usuario) => {
    const sucursal = await sucursales.buscarConRestaurante(sucursalId, alcanceDel(usuario));
    if (!sucursal) throw new ErrorNegocio('Los productos del pedido no son de tu sucursal');
    if (!sucursal.activa || sucursal.restaurante?.estado !== 'activo') {
      throw new ErrorNegocio('Esta sucursal no está recibiendo pedidos por ahora');
    }
    if (!abiertaEn(sucursal.horario, reloj())) {
      throw new ErrorNegocio('La sucursal está fuera de su horario de atención');
    }
    return sucursal;
  };

  /**
   * Bloquea los productos, valida y descuenta el stock: dos pedidos
   * simultáneos no pueden vender la misma unidad (RN-06).
   */
  const reservarStock = async (cantidades, t) => {
    const filas = await productos.bloquear(cantidades.keys(), t);
    const porId = new Map(filas.map((p) => [p.id, p]));
    const resultado = calcularLineas(cantidades, porId);
    const sucursalId = sucursalDeProductos(filas);
    for (const { producto_id: id, cantidad } of resultado.lineas) {
      await productos.descontar(porId.get(id), cantidad, t);
    }
    return { ...resultado, sucursalId };
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
    /** El cliente ve solo los suyos; el personal, los de su alcance (puede filtrar por cliente). */
    listar: (usuario, { clienteId } = {}) => {
      if (esCliente(usuario)) return pedidos.listar({ clienteId: usuario.id, alcance: SIN_FILTRO });
      const alcance = alcanceDe(usuario);
      if (clienteId === undefined) return pedidos.listar({ alcance });
      const id = Number(clienteId);
      if (!Number.isInteger(id) || id <= 0) throw new ErrorNegocio('cliente_id inválido');
      return pedidos.listar({ clienteId: id, alcance });
    },

    misPedidos: (clienteId) => pedidos.listarDeCliente(clienteId),

    /** Fuera del alcance del personal: 404, como si no existiera (CA-32). */
    obtener: async (id, usuario) => {
      const pedido = await pedidos.buscarCompleto(id, alcanceDel(usuario), { conCategoria: true });
      if (!pedido) throw new ErrorNegocio('Pedido no encontrado', 404);
      if (esCliente(usuario) && pedido.cliente_id !== usuario.id) {
        throw new ErrorNegocio('No tiene permisos para ver este pedido', 403);
      }
      return pedido;
    },

    /**
     * El cliente del pedido sale de la sesión (o de los datos, si lo
     * registra el personal), y la fecha y hora del reloj del servidor
     * (RN-19). Exige la afiliación del cliente al restaurante (RN-27). Si
     * lo hace el cliente, se vacía su carrito.
     */
    crear: async (usuario, { modalidad, detalles, cliente_id, empleado_id, empleado_preparacion_id, consentimiento_presencial }) => {
      const pedidoId = await transacciones.ejecutar(async (t) => {
        validarModalidad(modalidad);
        const cantidades = agruparDetalles(detalles);

        const deCliente = esCliente(usuario);
        const clienteId = deCliente ? usuario.id : cliente_id;
        if (!clienteId) {
          throw new ErrorNegocio('cliente_id es obligatorio para registrar un pedido a nombre de un cliente');
        }
        const cliente = await personas.cliente(clienteId, t);
        if (!cliente) throw new ErrorNegocio('El cliente indicado no existe');

        const { lineas, total, sucursalId } = await reservarStock(cantidades, t);
        const sucursal = await sucursalQueRecibe(sucursalId, usuario);
        // Afiliación activa del cliente al restaurante (RN-27).
        await afiliacion.exigirParaPedido({
          clienteId: cliente.id,
          restaurante: sucursal.restaurante,
          deCliente,
          consentimientoPresencial: consentimiento_presencial,
          t
        });

        // Un cliente no asigna personal a su pedido.
        const empleadoId = deCliente ? null : await empleadoValido(empleado_id, 'empleado_id', sucursalId, t);
        const preparacionId = deCliente
          ? null
          : await empleadoValido(empleado_preparacion_id, 'empleado_preparacion_id', sucursalId, t);

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
            empleado_preparacion_id: preparacionId,
            sucursal_id: sucursalId
          },
          t
        );
        await pedidos.crearDetalles(pedido.id, lineas, t);
        if (deCliente) await personas.vaciarCarrito(cliente.id, t);
        return pedido.id;
      });
      return pedidos.buscarCompleto(pedidoId, SIN_FILTRO);
    },

    /**
     * Avanza el estado, asigna responsables, cambia la modalidad o cancela
     * (RN-01 a RN-04). El pedido se bloquea: dos cancelaciones simultáneas
     * no devuelven el stock dos veces.
     */
    actualizar: async (id, usuario, { estado, empleado_id, empleado_preparacion_id, modalidad }) => {
      await transacciones.ejecutar(async (t) => {
        const pedido = await pedidos.bloquear(id, t, alcanceDe(usuario));
        if (!pedido) throw new ErrorNegocio('Pedido no encontrado', 404);

        if (estado) validarTransicion(pedido.estado, estado, usuario.rol?.toLowerCase());

        const nuevoEstado = estado ?? pedido.estado;
        const nuevoEmpleado = empleado_id !== undefined ? empleado_id : pedido.empleado_id;
        if (ESTADOS_CON_RESPONSABLE.includes(nuevoEstado) && !nuevoEmpleado) {
          throw new ErrorNegocio('Debe asignar un empleado responsable para este estado del pedido');
        }
        if (empleado_id) await empleadoValido(empleado_id, 'empleado_id', pedido.sucursal_id, t);
        if (empleado_preparacion_id) {
          await empleadoValido(empleado_preparacion_id, 'empleado_preparacion_id', pedido.sucursal_id, t);
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
      return pedidos.buscarCompleto(id, SIN_FILTRO);
    },

    /** Solo solicitados o cancelados y sin pago; devuelve el stock (RN-05). */
    eliminar: (id, usuario) =>
      transacciones.ejecutar(async (t) => {
        const pedido = await pedidos.bloquear(id, t, alcanceDe(usuario));
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
    /** Solo del alcance de quien las pide (RF-41). */
    estadisticas: async (usuario, { desde, hasta } = {}) => {
      if (!esFechaValida(desde) || !esFechaValida(hasta)) {
        throw new ErrorNegocio('Parámetros de fecha inválidos. Formato esperado YYYY-MM-DD');
      }
      const rango = { desde, hasta, alcance: alcanceDe(usuario) };

      const totalOrders = await pedidos.contar(rango);
      const totalRevenue = await pedidos.ingresos(rango);
      // Sin rango de fechas. El superadmin ve los clientes de la plataforma;
      // el resto, los que pidieron en su alcance (RN-21).
      const totalClients =
        rango.alcance.nivel === 'plataforma'
          ? await personas.contarClientes()
          : await pedidos.contarClientes(rango.alcance);

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
