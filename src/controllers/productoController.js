import { productoService } from '../dependencias.js';

/** Productos: solo HTTP (reglas en services/productoService.js). */

export const getAllProductos = async (req, res, next) => {
  try {
    res.status(200).json({ success: true, data: await productoService.listar({ sucursalId: req.query.sucursal_id }) });
  } catch (error) {
    next(error);
  }
};

export const getProductoById = async (req, res, next) => {
  try {
    res.status(200).json({ success: true, data: await productoService.obtener(req.params.id) });
  } catch (error) {
    next(error);
  }
};

export const createProducto = async (req, res, next) => {
  try {
    const data = await productoService.crear(req.user, req.body ?? {});
    res.status(201).json({ success: true, message: 'Producto creado correctamente', data });
  } catch (error) {
    next(error);
  }
};

export const updateProducto = async (req, res, next) => {
  try {
    const data = await productoService.actualizar(req.params.id, req.user, req.body ?? {});
    res.status(200).json({ success: true, message: 'Producto actualizado correctamente', data });
  } catch (error) {
    next(error);
  }
};

export const deleteProducto = async (req, res, next) => {
  try {
    await productoService.eliminar(req.params.id, req.user);
    res.status(200).json({ success: true, message: 'Producto eliminado correctamente' });
  } catch (error) {
    next(error);
  }
};
