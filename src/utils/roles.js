/** Cargos con alcance mayor que una sucursal (DERCAS 12). */
export const CARGO_SUPERADMIN = 'superadmin';
export const CARGO_ADMIN_RESTAURANTE = 'admin_restaurante';

/**
 * Rol de un empleado según su cargo (RF-03): define QUÉ puede hacer. El
 * superadmin y el administrador de restaurante tienen el rol admin; DÓNDE
 * lo puede hacer lo define su nivel (ver nivelDeCargo).
 */
export const rolDeCargo = (cargo) => {
  const valor = cargo?.toLowerCase() || '';
  if (['admin', 'administrador', CARGO_SUPERADMIN, CARGO_ADMIN_RESTAURANTE].includes(valor)) return 'admin';
  if (valor === 'mesero' || valor === 'cajero' || valor === 'cocinero') return valor;
  return 'empleado';
};

/**
 * Nivel de alcance según el cargo (RN-21): `plataforma` (superadmin, todo),
 * `restaurante` (todas las sucursales de su restaurante) o `sucursal` (el
 * resto del personal, solo la suya). Sale del cargo, no de que falten
 * datos: un empleado sin sucursal no ve más, ve nada.
 */
export const nivelDeCargo = (cargo) => {
  const valor = cargo?.toLowerCase() || '';
  if (valor === CARGO_SUPERADMIN) return 'plataforma';
  if (valor === CARGO_ADMIN_RESTAURANTE) return 'restaurante';
  return 'sucursal';
};
