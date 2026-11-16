/** Lo que los pedidos necesitan de clientes, empleados y carrito. */
export const crearPersonasRepository = (m) => ({
  cliente: (id, t) => m.Cliente.findByPk(id, { transaction: t }),

  empleado: (id, t) => m.Empleado.findByPk(id, { transaction: t }),

  /** Total de clientes registrados (dashboard). */
  contarClientes: () => m.Cliente.count(),

  vaciarCarrito: (clienteId, t) => m.CarritoItem.destroy({ where: { cliente_id: clienteId }, transaction: t })
});
