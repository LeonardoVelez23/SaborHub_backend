import { authService } from '../dependencias.js';

/** Inicio de sesión y recuperación de contraseña: solo HTTP (reglas en services/authService.js). */

export const login = async (req, res, next) => {
  try {
    const { token, user } = await authService.ingresar(req.body ?? {});
    res.status(200).json({ success: true, message: 'Inicio de sesión exitoso', token, user });
  } catch (error) {
    next(error);
  }
};

/** Envía el código de verificación al correo (misma respuesta exista o no). */
export const forgotPassword = async (req, res, next) => {
  try {
    const message = await authService.solicitarCodigo(req.body ?? {});
    res.status(200).json({ success: true, message });
  } catch (error) {
    next(error);
  }
};

/** Nueva contraseña con el código del correo. */
export const resetPassword = async (req, res, next) => {
  try {
    await authService.restablecer(req.body ?? {});
    res.status(200).json({
      success: true,
      message: '¡Contraseña restablecida con éxito! Ya puedes iniciar sesión con tu nueva clave.'
    });
  } catch (error) {
    next(error);
  }
};

export { login as authLogin };
