import { ErrorNegocio } from '../errors/ErrorNegocio.js';
import { errorDeContrasenia } from '../utils/password.js';

/**
 * Reglas comunes de las cuentas de clientes y empleados.
 */

export const validarPolitica = (contrasenia) => {
  const error = errorDeContrasenia(contrasenia);
  if (error) throw new ErrorNegocio(error);
};

/** Texto recortado, o null si viene vacío. */
export const opcional = (valor) => valor?.trim() || null;

/** Puede modificar el perfil `id` el administrador o el propio usuario (RN-16). */
export const comprobarDuenio = (usuario, id) => {
  if (usuario && usuario.rol !== 'admin' && String(usuario.id) !== String(id)) {
    throw new ErrorNegocio('No tiene permisos para modificar este perfil', 403);
  }
};

/**
 * Campos a guardar para cambiar la contraseña de `cuenta`. La política se
 * revisa antes del OTP para no gastar un intento. Con `sinOtp` (el
 * administrador cambiando la de otro) no se pide el código del correo.
 * Devuelve {} si no se pidió cambiarla.
 */
export const cambioDeContrasenia = async ({ cuenta, contrasenia, otp, sinOtp }, { otps, contrasenias }) => {
  if (!contrasenia) return {};
  validarPolitica(contrasenia);
  if (!sinOtp) {
    if (!otp) throw new ErrorNegocio('Se requiere el código OTP de verificación para cambiar la contraseña.');
    if (!(await otps.verificar(cuenta, otp))) {
      throw new ErrorNegocio('El código OTP es incorrecto o ha expirado. Solicita uno nuevo.');
    }
  }
  return { contrasenia: await contrasenias.hash(contrasenia), ...otps.limpio };
};

/** Fila sin la contraseña, lista para responder. */
export const sinContrasenia = (fila) => {
  const { contrasenia: _, ...resto } = typeof fila.toJSON === 'function' ? fila.toJSON() : fila;
  return resto;
};
