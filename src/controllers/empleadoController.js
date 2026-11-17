import { empleadoService } from '../dependencias.js';

/** Empleados: solo HTTP (reglas en services/empleadoService.js). */

export const getAllEmpleados = async (req, res, next) => {
  try {
    res.status(200).json({ success: true, data: await empleadoService.listar() });
  } catch (error) {
    next(error);
  }
};

export const getEmpleadoById = async (req, res, next) => {
  try {
    res.status(200).json({ success: true, data: await empleadoService.obtener(req.params.id, req.user) });
  } catch (error) {
    next(error);
  }
};

export const createEmpleado = async (req, res, next) => {
  try {
    const data = await empleadoService.crear(req.user, req.body ?? {});
    res.status(201).json({ success: true, message: 'Empleado creado correctamente', data });
  } catch (error) {
    next(error);
  }
};

export const updateEmpleado = async (req, res, next) => {
  try {
    const data = await empleadoService.actualizar(req.params.id, req.user, req.body ?? {});
    res.status(200).json({ success: true, message: 'Empleado actualizado correctamente', data });
  } catch (error) {
    next(error);
  }
};

export const deleteEmpleado = async (req, res, next) => {
  try {
    await empleadoService.eliminar(req.params.id);
    res.status(200).json({ success: true, message: 'Empleado eliminado correctamente' });
  } catch (error) {
    next(error);
  }
};
