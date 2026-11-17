import { biometricoService } from '../dependencias.js';

/** Ingreso con huella o rostro: solo HTTP (reglas en services/biometricoService.js). */

/** POST /auth/biometrico/activar (cliente con sesión). */
export const activarBiometrico = async (req, res, next) => {
  try {
    const credencial = await biometricoService.activar(req.user.id, req.body?.dispositivo);
    res.status(201).json({ success: true, message: 'Ingreso con huella activado', data: { credencial } });
  } catch (error) {
    next(error);
  }
};

/** POST /auth/biometrico (público): credencial → sesión nueva. */
export const loginBiometrico = async (req, res, next) => {
  try {
    const sesion = await biometricoService.ingresar(req.body?.credencial);
    res.status(200).json({ success: true, message: 'Inicio de sesión exitoso', ...sesion });
  } catch (error) {
    next(error);
  }
};

/** DELETE /auth/biometrico (cliente con sesión): desactiva este dispositivo. */
export const desactivarBiometrico = async (req, res, next) => {
  try {
    await biometricoService.desactivar(req.user.id, req.body?.credencial);
    res.status(200).json({ success: true, message: 'Ingreso con huella desactivado' });
  } catch (error) {
    next(error);
  }
};
