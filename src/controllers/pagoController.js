import { pagoService } from '../dependencias.js';

/** Pagos en caja y por el personal: solo HTTP (reglas en services/pagoService.js). */

export const getAllPagos = async (req, res, next) => {
  try {
    res.status(200).json({ success: true, data: await pagoService.listar() });
  } catch (error) {
    next(error);
  }
};

/**
 * Pagos del cliente de la sesión ("Mis pagos" de la app). Solo pagos
 * registrados: los intentos con tarjeta cancelados no son pagos.
 */
export const getMisPagos = async (req, res, next) => {
  try {
    res.status(200).json({ success: true, data: await pagoService.misPagos(req.user.id) });
  } catch (error) {
    next(error);
  }
};

export const getPagoById = async (req, res, next) => {
  try {
    res.status(200).json({ success: true, data: await pagoService.obtener(req.params.id, req.user) });
  } catch (error) {
    next(error);
  }
};

export const getPagoByPedido = async (req, res, next) => {
  try {
    res.status(200).json({ success: true, data: await pagoService.delPedido(req.params.pedidoId, req.user) });
  } catch (error) {
    next(error);
  }
};

export const createPago = async (req, res, next) => {
  try {
    const data = await pagoService.crear(req.user, req.body ?? {});
    res.status(201).json({ success: true, message: 'Pago registrado correctamente', data });
  } catch (error) {
    next(error);
  }
};

export const updatePago = async (req, res, next) => {
  try {
    const data = await pagoService.actualizar(req.params.id, req.body ?? {});
    res.status(200).json({ success: true, message: 'Pago actualizado correctamente', data });
  } catch (error) {
    next(error);
  }
};

export const deletePago = async (req, res, next) => {
  try {
    await pagoService.eliminar(req.params.id);
    res.status(200).json({ success: true, message: 'Pago eliminado correctamente' });
  } catch (error) {
    next(error);
  }
};
