import { ErrorNegocio } from '../errors/ErrorNegocio.js';

/**
 * Alcance del personal (DERCAS 12, RN-21): restaurante y sucursal salen de
 * la sesión (leídos de la base en cada petición), nunca de los datos que
 * envía el cliente.
 */

/** Sucursal donde escribe este usuario del personal. */
export const sucursalDelPersonal = (usuario) => {
  if (!usuario?.sucursal_id) {
    throw new ErrorNegocio('Tu usuario no tiene una sucursal asignada', 403);
  }
  return usuario.sucursal_id;
};

/**
 * Todos los productos de un pedido son de la misma sucursal (RN-20).
 * Devuelve esa sucursal.
 */
export const sucursalDeProductos = (productos) => {
  const sucursales = new Set(productos.map((p) => p.sucursal_id));
  if (sucursales.size > 1) {
    throw new ErrorNegocio('Todos los productos del pedido deben ser de la misma sucursal');
  }
  return [...sucursales][0];
};
