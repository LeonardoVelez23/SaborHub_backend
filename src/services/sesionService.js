/**
 * Validez de una sesión abierta. El rol se lee de la base en cada petición:
 * un cambio de cargo aplica en la siguiente y una cuenta eliminada pierde
 * el acceso aunque su token no haya vencido.
 */
export const crearSesionService = ({ cuentas, rolDeCargo }) => ({
  /** Rol vigente del usuario del token, o null si ya no existe. */
  rolVigente: async ({ id, rol }) => {
    if (rol === 'cliente') {
      const cliente = await cuentas.clienteDeSesion(id);
      return cliente && !cliente.eliminado_en ? 'cliente' : null;
    }
    const empleado = await cuentas.empleadoDeSesion(id);
    return empleado ? rolDeCargo(empleado.cargo) : null;
  }
});
