import { privacidadService } from '../dependencias.js';

/** Derechos del cliente sobre sus datos (LOPDP): solo HTTP. */

/** Sus datos en un formato descargable (acceso y portabilidad). */
export const getMisDatos = async (req, res, next) => {
  try {
    res.status(200).json({ success: true, data: await privacidadService.misDatos(req.user.id) });
  } catch (error) {
    next(error);
  }
};

export const eliminarMiCuenta = async (req, res, next) => {
  try {
    await privacidadService.eliminarCuenta(req.user.id, req.body?.contrasenia);
    res.status(200).json({ success: true, message: 'Tu cuenta y tus datos personales se eliminaron' });
  } catch (error) {
    next(error);
  }
};
