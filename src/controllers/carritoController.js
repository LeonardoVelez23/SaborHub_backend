import { carritoService } from '../dependencias.js';

/** Carrito del cliente (RF-13): solo HTTP (reglas en services/carritoService.js). */

export const getCarrito = async (req, res, next) => {
  try {
    res.status(200).json({ success: true, data: await carritoService.leer(req.user.id) });
  } catch (error) {
    next(error);
  }
};

export const putCarrito = async (req, res, next) => {
  try {
    res.status(200).json({ success: true, data: await carritoService.reemplazar(req.user.id, req.body?.items) });
  } catch (error) {
    next(error);
  }
};
