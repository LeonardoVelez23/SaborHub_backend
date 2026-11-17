import { afiliacionService } from '../dependencias.js';

/** Mis restaurantes del cliente (RF-43, RF-45): solo HTTP (reglas en services/afiliacionService.js). */

export const getMisAfiliaciones = async (req, res, next) => {
  try {
    res.status(200).json({ success: true, data: await afiliacionService.mias(req.user.id) });
  } catch (error) {
    next(error);
  }
};

export const afiliarme = async (req, res, next) => {
  try {
    const data = await afiliacionService.afiliar(req.user.id, req.body ?? {});
    res.status(201).json({ success: true, message: 'Ya puedes pedir en este restaurante', data });
  } catch (error) {
    next(error);
  }
};

export const retirarAfiliacion = async (req, res, next) => {
  try {
    await afiliacionService.retirar(req.user.id, req.params.restauranteId);
    res.status(200).json({ success: true, message: 'Retiraste tu consentimiento a este restaurante' });
  } catch (error) {
    next(error);
  }
};
