import { sinDuplicados } from '../errors/RegistroDuplicado.js';

/** Acceso a Productos: catálogo y stock. `m` son los modelos (se leen al usarse). */
export const crearProductoRepository = (m) => {
  const conCategoria = { model: m.Categoria, as: 'categoria', attributes: ['id', 'nombre'] };

  return {
    listar: () => m.Producto.findAll({ include: conCategoria, order: [['nombre', 'ASC']] }),

    buscarConCategoria: (id) => m.Producto.findByPk(id, { include: conCategoria }),

    buscar: (id) => m.Producto.findByPk(id),

    crear: (datos) => sinDuplicados(() => m.Producto.create(datos)),

    actualizar: (producto, datos) => sinDuplicados(() => producto.update(datos)),

    /** Si está en pedidos, la base lo impide (clave foránea RESTRICT → 400). */
    eliminar: (producto) => producto.destroy(),

    // ------------------------------------------------ Stock (en transacción)

    /**
     * Bloquea (SELECT ... FOR UPDATE) las filas hasta que termine `t`.
     * Siempre en orden de id para evitar deadlocks entre pedidos simultáneos.
     */
    bloquear: (ids, t) =>
      m.Producto.findAll({
        where: { id: [...ids] },
        order: [['id', 'ASC']],
        lock: t.LOCK.UPDATE,
        transaction: t
      }),

    descontar: (producto, cantidad, t) =>
      producto.decrement('cantidad_disponible', { by: cantidad, transaction: t }),

    reponer: (producto, cantidad, t) =>
      producto.increment('cantidad_disponible', { by: cantidad, transaction: t })
  };
};
