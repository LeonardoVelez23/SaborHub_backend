import { mesaService } from '../dependencias.js';

/** Mesas: solo HTTP (reglas en services/mesaService.js). */

const manejar = (accion, { status = 200, message } = {}) => async (req, res, next) => {
  try {
    const data = await accion(req);
    res.status(status).json({ success: true, ...(message && { message }), data });
  } catch (error) {
    next(error);
  }
};

export const getMesas = manejar((req) => mesaService.listar(req.user, req.query));
export const createMesa = manejar((req) => mesaService.crear(req.user, req.body ?? {}), {
  status: 201,
  message: 'Mesa creada correctamente'
});
export const updateMesa = manejar((req) => mesaService.actualizar(req.params.id, req.user, req.body ?? {}), {
  message: 'Mesa actualizada correctamente'
});
export const deleteMesa = manejar(async (req) => {
  await mesaService.eliminar(req.params.id, req.user);
  return null;
}, { message: 'Mesa eliminada correctamente' });
