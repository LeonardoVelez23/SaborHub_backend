import { ErrorNegocio } from '../errors/ErrorNegocio.js';

/**
 * Alcance del personal (DERCAS 12, RN-21): qué restaurante y sucursal puede
 * ver y modificar. Sale de la sesión (leída de la base en cada petición),
 * nunca de los datos que envía el cliente.
 *
 * Un alcance es {nivel: 'plataforma'} | {nivel: 'restaurante', restauranteId}
 * | {nivel: 'sucursal', sucursalId} | {nivel: 'ninguno'}. Los repositorios
 * lo convierten en el filtro de cada consulta.
 */

/** Consultas públicas (menú) o del propio cliente: sin filtro de alcance. */
export const SIN_FILTRO = Object.freeze({ nivel: 'plataforma', publico: true });

const NINGUNO = Object.freeze({ nivel: 'ninguno' });

/** Alcance del usuario de la sesión (personal). */
export const alcanceDe = (usuario) => {
  const nivel = usuario?.nivel ?? 'sucursal';
  if (nivel === 'plataforma') return { nivel };
  if (nivel === 'restaurante') {
    return usuario.restaurante_id ? { nivel, restauranteId: usuario.restaurante_id } : NINGUNO;
  }
  return usuario?.sucursal_id ? { nivel: 'sucursal', sucursalId: usuario.sucursal_id } : NINGUNO;
};

/**
 * Sucursal donde escribe el personal: la suya, o (administrador de
 * restaurante o superadmin) la indicada, si está en su alcance. `sucursales`
 * es el repositorio para comprobarlo. Devuelve la fila de la sucursal.
 */
export const sucursalParaEscribir = async (usuario, sucursalPedida, sucursales) => {
  const alcance = alcanceDe(usuario);
  if (alcance.nivel === 'ninguno') {
    throw new ErrorNegocio('Tu usuario no tiene una sucursal asignada', 403);
  }
  const id = alcance.nivel === 'sucursal' ? alcance.sucursalId : sucursalPedida;
  if (id === undefined || id === null || id === '') {
    throw new ErrorNegocio('sucursal_id es obligatorio: indica en qué sucursal');
  }
  const sucursal = await sucursales.buscar(id, alcance);
  if (!sucursal) throw new ErrorNegocio('La sucursal indicada no existe');
  return sucursal;
};

/** Compatibilidad: id de la sucursal del personal de una sucursal. */
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
