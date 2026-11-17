import { Op } from 'sequelize';

const ATRIBUTOS_PRODUCTO = ['id', 'nombre', 'precio', 'cantidad_disponible', 'estado', 'imagen_codigo'];

/** Carrito guardado del cliente (RF-13). */
export const crearCarritoRepository = (m) => ({
  /** Con los datos vigentes de cada producto, en el orden de la app. */
  items: (clienteId) =>
    m.CarritoItem.findAll({
      where: { cliente_id: clienteId },
      include: { model: m.Producto, as: 'producto', attributes: ATRIBUTOS_PRODUCTO },
      order: [['posicion', 'ASC'], ['producto_id', 'ASC']]
    }),

  /** Cuáles de estos ids de producto existen. */
  productosExistentes: async (ids) =>
    new Set((await m.Producto.findAll({ where: { id: { [Op.in]: ids } }, attributes: ['id'] })).map((p) => p.id)),

  vaciar: (clienteId, t) => m.CarritoItem.destroy({ where: { cliente_id: clienteId }, transaction: t }),

  insertar: (filas, t) => m.CarritoItem.bulkCreate(filas, { transaction: t })
});
