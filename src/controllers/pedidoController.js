import { pedidoService } from '../dependencias.js';

/**
 * Pedidos: solo HTTP. Las reglas y transacciones están en
 * services/pedidoService.js; los errores (ErrorNegocio) los responde el
 * errorHandler.
 */

export const getAllPedidos = async (req, res, next) => {
  try {
    const data = await pedidoService.listar(req.user, { clienteId: req.query.cliente_id });
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

/** Pedidos del cliente de la sesión (app móvil). */
export const getMisPedidos = async (req, res, next) => {
  try {
    const data = await pedidoService.misPedidos(req.user.id);
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

export const getPedidoById = async (req, res, next) => {
  try {
    const data = await pedidoService.obtener(req.params.id, req.user);
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

export const createPedido = async (req, res, next) => {
  try {
    const data = await pedidoService.crear(req.user, req.body ?? {});
    res.status(201).json({ success: true, message: 'Pedido creado correctamente', data });
  } catch (error) {
    next(error);
  }
};

export const updatePedido = async (req, res, next) => {
  try {
    const data = await pedidoService.actualizar(req.params.id, req.user, req.body ?? {});
    res.status(200).json({ success: true, message: 'Pedido actualizado correctamente', data });
  } catch (error) {
    next(error);
  }
};

export const deletePedido = async (req, res, next) => {
  try {
    await pedidoService.eliminar(req.params.id, req.user);
    res.status(200).json({ success: true, message: 'Pedido eliminado correctamente' });
  } catch (error) {
    next(error);
  }
};

export const getPedidoStats = async (req, res, next) => {
  try {
    const { desde, hasta } = req.query;
    const data = await pedidoService.estadisticas(req.user, { desde, hasta });
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
};
