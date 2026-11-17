import { afiliacionService, clienteService } from '../dependencias.js';

/** Clientes (registro público con token opcional): solo HTTP (reglas en services/clienteService.js). */

export const getAllClientes = async (req, res, next) => {
  try {
    res.status(200).json({ success: true, data: await clienteService.listar(req.user) });
  } catch (error) {
    next(error);
  }
};

export const buscarCliente = async (req, res, next) => {
  try {
    res.status(200).json({ success: true, data: await clienteService.buscar(req.user, req.query.q) });
  } catch (error) {
    next(error);
  }
};

export const cambiarBloqueoCliente = async (req, res, next) => {
  try {
    const data = await afiliacionService.cambiarBloqueo(req.user, req.params.id, req.body ?? {});
    const mensaje = data.estado === 'bloqueado' ? 'Cliente bloqueado en tu restaurante' : 'Cliente desbloqueado';
    res.status(200).json({ success: true, message: mensaje, data });
  } catch (error) {
    next(error);
  }
};

export const getClienteById = async (req, res, next) => {
  try {
    res.status(200).json({ success: true, data: await clienteService.obtener(req.params.id, req.user) });
  } catch (error) {
    next(error);
  }
};

export const createCliente = async (req, res, next) => {
  try {
    const data = await clienteService.crear(req.user ?? null, req.body ?? {});
    res.status(201).json({ success: true, message: 'Cliente creado correctamente', data });
  } catch (error) {
    next(error);
  }
};

export const updateCliente = async (req, res, next) => {
  try {
    const data = await clienteService.actualizar(req.params.id, req.user, req.body ?? {});
    res.status(200).json({ success: true, message: 'Cliente actualizado correctamente', data });
  } catch (error) {
    next(error);
  }
};

export const deleteCliente = async (req, res, next) => {
  try {
    await clienteService.eliminar(req.params.id, req.user);
    res.status(200).json({ success: true, message: 'Cliente eliminado correctamente' });
  } catch (error) {
    next(error);
  }
};
