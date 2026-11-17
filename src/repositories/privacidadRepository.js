import { Op } from 'sequelize';

/**
 * Lo que los derechos del cliente (LOPDP) necesitan leer o borrar de
 * varias tablas: sus datos para descargar y lo que se borra con la cuenta.
 */
export const crearPrivacidadRepository = (m) => ({
  dispositivosBiometricos: (clienteId) =>
    m.CredencialBiometrica.findAll({
      where: { cliente_id: clienteId },
      attributes: ['dispositivo', 'createdAt', 'ultimo_uso'],
      order: [['ultimo_uso', 'DESC']]
    }),

  carrito: (clienteId) =>
    m.CarritoItem.findAll({
      where: { cliente_id: clienteId },
      include: { model: m.Producto, as: 'producto', attributes: ['nombre'] },
      order: [['posicion', 'ASC']]
    }),

  pedidos: (clienteId) =>
    m.Pedido.findAll({
      where: { cliente_id: clienteId },
      attributes: ['id', 'fecha', 'hora', 'modalidad', 'estado', 'valor_total'],
      include: [
        {
          model: m.DetallePedido,
          as: 'detalles',
          attributes: ['cantidad', 'precio_unitario', 'subtotal'],
          include: { model: m.Producto, as: 'producto', attributes: ['nombre'] }
        },
        { model: m.Pago, as: 'pago', attributes: ['fecha', 'valor', 'metodo_pago', 'estado'] }
      ],
      order: [['id', 'DESC']]
    }),

  /** Pedidos del cliente que no están en `estadosFinales`. */
  contarPedidosAbiertos: (clienteId, estadosFinales, t) =>
    m.Pedido.count({
      where: { cliente_id: clienteId, estado: { [Op.notIn]: estadosFinales } },
      transaction: t
    }),

  vaciarCarrito: (clienteId, t) => m.CarritoItem.destroy({ where: { cliente_id: clienteId }, transaction: t })
});
