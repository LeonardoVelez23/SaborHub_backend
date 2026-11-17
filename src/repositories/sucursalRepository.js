import { filtroDeSucursales } from './alcance.js';

/** Sucursales. `m` son los modelos (se leen al usarse). */
export const crearSucursalRepository = (m) => ({
  /** La sucursal si existe y está en el alcance; si no, null. */
  buscar: (id, alcance) => m.Sucursal.findOne({ where: { id, ...filtroDeSucursales(alcance) } }),

  restauranteExiste: async (id) => Boolean(await m.Restaurante.findByPk(id, { attributes: ['id'] })),

  /** Con el estado de su restaurante (para saber si recibe pedidos). */
  buscarConRestaurante: (id, alcance) =>
    m.Sucursal.findOne({
      where: { id, ...filtroDeSucursales(alcance) },
      include: { model: m.Restaurante, as: 'restaurante', attributes: ['id', 'estado'] }
    })
});
