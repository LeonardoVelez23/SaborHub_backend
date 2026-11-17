import { nivelDeCargo as nivelPorDefecto } from '../utils/roles.js';

/**
 * Validez de una sesión abierta. El rol y el alcance (restaurante y
 * sucursal del personal) se leen de la base en cada petición: un cambio de
 * cargo o de sucursal aplica en la siguiente y una cuenta eliminada pierde
 * el acceso aunque su token no haya vencido. El alcance nunca sale de un
 * parámetro del cliente (RN-21).
 */
export const crearSesionService = ({ cuentas, rolDeCargo, nivelDeCargo = nivelPorDefecto }) => ({
  /** {rol, nivel, restaurante_id, sucursal_id} vigentes, o null si el usuario ya no existe. */
  vigente: async ({ id, rol }) => {
    if (rol === 'cliente') {
      const cliente = await cuentas.clienteDeSesion(id);
      return cliente && !cliente.eliminado_en ? { rol: 'cliente', nivel: null, restaurante_id: null, sucursal_id: null } : null;
    }
    const empleado = await cuentas.empleadoDeSesion(id);
    if (!empleado) return null;
    return {
      rol: rolDeCargo(empleado.cargo),
      nivel: nivelDeCargo(empleado.cargo),
      restaurante_id: empleado.restaurante_id ?? null,
      sucursal_id: empleado.sucursal_id ?? null
    };
  }
});
