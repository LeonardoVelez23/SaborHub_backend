import { restauranteService, sucursalService } from '../dependencias.js';

/** Restaurantes y sucursales: solo HTTP (reglas en services/restauranteService.js). */

const manejar = (accion, { status = 200, message } = {}) => async (req, res, next) => {
  try {
    const data = await accion(req);
    res.status(status).json({ success: true, ...(message && { message }), data });
  } catch (error) {
    next(error);
  }
};

export const getRestaurantes = manejar((req) => restauranteService.listar(req.user));
export const getRestaurante = manejar((req) => restauranteService.obtener(req.params.id, req.user));
export const createRestaurante = manejar((req) => restauranteService.crear(req.user, req.body ?? {}), {
  status: 201,
  message: 'Restaurante creado correctamente'
});
export const updateRestaurante = manejar(
  (req) => restauranteService.actualizar(req.params.id, req.user, req.body ?? {}),
  { message: 'Restaurante actualizado correctamente' }
);

export const getSucursalesPublicas = manejar(() => sucursalService.listarPublicas());
export const getSucursalPublica = manejar((req) => sucursalService.obtenerPublica(req.params.id));
export const getSucursalesGestion = manejar((req) => sucursalService.listar(req.user));
export const createSucursal = manejar((req) => sucursalService.crear(req.user, req.body ?? {}), {
  status: 201,
  message: 'Sucursal creada correctamente'
});
export const updateSucursal = manejar((req) => sucursalService.actualizar(req.params.id, req.user, req.body ?? {}), {
  message: 'Sucursal actualizada correctamente'
});
