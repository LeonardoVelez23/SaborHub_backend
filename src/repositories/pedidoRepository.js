import { Op } from 'sequelize';

const ATRIBUTOS_CLIENTE = ['id', 'nombres', 'apellidos', 'identificacion', 'correo_electronico', 'telefono'];
const ATRIBUTOS_EMPLEADO = ['id', 'nombres', 'apellidos', 'cargo'];
const ATRIBUTOS_PRODUCTO = ['id', 'codigo', 'nombre', 'precio', 'imagen_codigo'];
const ATRIBUTOS_PAGO = ['id', 'fecha', 'valor', 'metodo_pago', 'numero_referencia', 'estado'];

/** Filtro por fecha del pedido: {desde?, hasta?} en AAAA-MM-DD. */
const filtroFechas = ({ desde, hasta } = {}) => {
  if (desde && hasta) return { fecha: { [Op.between]: [desde, hasta] } };
  if (desde) return { fecha: { [Op.gte]: desde } };
  if (hasta) return { fecha: { [Op.lte]: hasta } };
  return undefined;
};

/**
 * Acceso a Pedidos y DetallePedidos. Único lugar que conoce sus consultas:
 * aquí irá el filtro por restaurante y sucursal (DERCAS 12).
 */
export const crearPedidoRepository = (m) => {
  const includeCompleto = ({ conCategoria = false } = {}) => [
    { model: m.Cliente, as: 'cliente', attributes: ATRIBUTOS_CLIENTE },
    { model: m.Empleado, as: 'empleadoResponsable', attributes: ATRIBUTOS_EMPLEADO },
    { model: m.Empleado, as: 'empleadoPreparacion', attributes: ATRIBUTOS_EMPLEADO },
    {
      model: m.DetallePedido,
      as: 'detalles',
      include: {
        model: m.Producto,
        as: 'producto',
        attributes: ATRIBUTOS_PRODUCTO,
        ...(conCategoria && {
          include: { model: m.Categoria, as: 'categoria', attributes: ['id', 'nombre'] }
        })
      }
    }
  ];

  const contarPor = (columna, where) =>
    m.Pedido.findAll({
      attributes: [columna, [m.sequelize.fn('COUNT', m.sequelize.col('id')), 'count']],
      where,
      group: [columna]
    });

  return {
    /** Con cliente, empleados y detalles; del más reciente al más antiguo. */
    listar: ({ clienteId } = {}) =>
      m.Pedido.findAll({
        where: clienteId ? { cliente_id: clienteId } : {},
        include: includeCompleto(),
        order: [['createdAt', 'DESC']]
      }),

    /** Pedidos de un cliente con detalles y pago (GET /pedidos/mios). */
    listarDeCliente: (clienteId) =>
      m.Pedido.findAll({
        where: { cliente_id: clienteId },
        include: [
          {
            model: m.DetallePedido,
            as: 'detalles',
            include: { model: m.Producto, as: 'producto', attributes: ATRIBUTOS_PRODUCTO }
          },
          { model: m.Pago, as: 'pago', attributes: ATRIBUTOS_PAGO }
        ],
        order: [['id', 'DESC']]
      }),

    buscarCompleto: (id, { conCategoria = false } = {}) =>
      m.Pedido.findByPk(id, { include: includeCompleto({ conCategoria }) }),

    buscar: (id, { atributos } = {}) =>
      m.Pedido.findByPk(id, atributos ? { attributes: atributos } : undefined),

    /** Pedido con su pago (o null), sin bloquear. */
    buscarConPago: (id) => m.Pedido.findByPk(id, { include: { model: m.Pago, as: 'pago' } }),

    /** SELECT ... FOR UPDATE: nadie más lo cambia hasta terminar `t`. */
    bloquear: (id, t) => m.Pedido.findByPk(id, { lock: t.LOCK.UPDATE, transaction: t }),

    crear: (datos, t) => m.Pedido.create(datos, { transaction: t }),

    actualizar: (pedido, datos, t) => pedido.update(datos, { transaction: t }),

    eliminar: async (pedido, t) => {
      await m.DetallePedido.destroy({ where: { pedido_id: pedido.id }, transaction: t });
      await pedido.destroy({ transaction: t });
    },

    crearDetalles: (pedidoId, lineas, t) =>
      m.DetallePedido.bulkCreate(
        lineas.map((linea) => ({ ...linea, pedido_id: pedidoId })),
        { transaction: t }
      ),

    detalles: (pedidoId, t) => m.DetallePedido.findAll({ where: { pedido_id: pedidoId }, transaction: t }),

    // ------------------------------------------------ Estadísticas (RF-29+)

    contar: (rango) => {
      const where = filtroFechas(rango);
      return m.Pedido.count(where ? { where } : undefined);
    },

    /** Suma de pagos aprobados de los pedidos del rango (RN-13). */
    ingresos: async (rango) => {
      const where = filtroFechas(rango);
      if (!where) return Number((await m.Pago.sum('valor', { where: { estado: 'aprobado' } })) || 0);
      const ids = (await m.Pedido.findAll({ where, attributes: ['id'] })).map((p) => p.id);
      if (ids.length === 0) return 0;
      const suma = await m.Pago.sum('valor', { where: { estado: 'aprobado', pedido_id: { [Op.in]: ids } } });
      return Number(suma || 0);
    },

    /** [{valor, cantidad}] por estado o por modalidad. */
    contarPorColumna: async (columna, rango) =>
      (await contarPor(columna, filtroFechas(rango))).map((fila) => ({
        valor: fila[columna],
        cantidad: Number(fila.getDataValue('count'))
      })),

    /** Los más vendidos por unidades, sin pedidos cancelados. */
    masVendidos: async (rango, limite) => {
      const filas = await m.DetallePedido.findAll({
        attributes: ['producto_id', [m.sequelize.fn('SUM', m.sequelize.col('cantidad')), 'total_vendido']],
        include: [
          { model: m.Producto, as: 'producto', attributes: ['nombre', 'precio'] },
          {
            model: m.Pedido,
            as: 'pedido',
            attributes: [],
            where: { ...filtroFechas(rango), estado: { [Op.ne]: 'cancelado' } }
          }
        ],
        group: ['producto_id', 'producto.id'],
        order: [[m.sequelize.fn('SUM', m.sequelize.col('cantidad')), 'DESC']],
        limit: limite
      });
      return filas.map((fila) => ({
        id: fila.producto_id,
        nombre: fila.producto?.nombre || 'Producto Desconocido',
        precio: Number(fila.producto?.precio || 0),
        totalVendido: Number(fila.getDataValue('total_vendido'))
      }));
    }
  };
};
