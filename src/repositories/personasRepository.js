/** Lo que los pedidos necesitan de clientes, empleados y carrito. */
export const crearPersonasRepository = (m) => ({
  cliente: (id, t) => m.Cliente.findByPk(id, { transaction: t }),

  /** Cliente genérico de los pedidos presenciales sin datos (RN-38). */
  consumidorFinal: (t) => m.Cliente.findOne({ where: { es_consumidor_final: true }, transaction: t }),

  mesa: (id, t) => m.Mesa.findByPk(id, { transaction: t }),

  empleado: (id, t) => m.Empleado.findByPk(id, { transaction: t }),

  /** Total de clientes registrados (dashboard), sin el consumidor final. */
  contarClientes: () => m.Cliente.count({ where: { es_consumidor_final: false } }),

  vaciarCarrito: (clienteId, t) => m.CarritoItem.destroy({ where: { cliente_id: clienteId }, transaction: t })
});
