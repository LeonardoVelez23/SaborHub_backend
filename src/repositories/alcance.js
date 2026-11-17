import { Op, literal } from 'sequelize';

/**
 * Traduce un alcance (services/alcance.js) al filtro de Sequelize. Es el
 * único lugar que decide qué filas ve el personal (RN-21). Sin alcance,
 * falla: una consulta que olvida el filtro no puede devolver datos de otros
 * restaurantes. Las públicas pasan SIN_FILTRO a propósito.
 */

const entero = (valor) => {
  const n = Number(valor);
  if (!Number.isInteger(n) || n <= 0) throw new TypeError(`Id de alcance inválido: ${valor}`);
  return n;
};

const exigir = (alcance) => {
  if (!alcance?.nivel) throw new TypeError('Consulta sin alcance: pasa el del usuario o SIN_FILTRO');
  return alcance;
};

/** Filas con columna `sucursal_id` (categorías, productos, pedidos). */
export const filtroSucursal = (alcance, columna = 'sucursal_id') => {
  const { nivel, sucursalId, restauranteId } = exigir(alcance);
  if (nivel === 'plataforma') return {};
  if (nivel === 'sucursal') return { [columna]: entero(sucursalId) };
  if (nivel === 'restaurante') {
    return {
      [columna]: { [Op.in]: literal(`(SELECT id FROM "Sucursales" WHERE restaurante_id = ${entero(restauranteId)})`) }
    };
  }
  return { [columna]: null }; // ninguno: la columna es NOT NULL, no coincide nada
};

/** La tabla Sucursales misma. */
export const filtroDeSucursales = (alcance) => {
  const { nivel, sucursalId, restauranteId } = exigir(alcance);
  if (nivel === 'plataforma') return {};
  if (nivel === 'sucursal') return { id: entero(sucursalId) };
  if (nivel === 'restaurante') return { restaurante_id: entero(restauranteId) };
  return { id: null };
};

/** Empleados (tienen restaurante_id y sucursal_id propios). */
export const filtroEmpleados = (alcance) => {
  const { nivel, sucursalId, restauranteId } = exigir(alcance);
  if (nivel === 'plataforma') return {};
  if (nivel === 'sucursal') return { sucursal_id: entero(sucursalId) };
  if (nivel === 'restaurante') return { restaurante_id: entero(restauranteId) };
  return { id: null };
};

/**
 * `where` de una fila por id dentro del alcance. El filtro va en un AND
 * aparte: con `{ id, ...filtro }` un filtro que también usa `id` (sucursal
 * propia, restaurante propio) reemplazaría el id pedido.
 */
export const porId = (id, filtro) => ({ id, [Op.and]: [filtro] });
