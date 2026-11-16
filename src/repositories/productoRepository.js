/** Stock de los productos dentro de una transacción. */
export const crearProductoRepository = (m) => ({
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
});
