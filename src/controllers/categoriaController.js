import { categoriaService } from '../dependencias.js';

/** Categorías: solo HTTP (reglas en services/categoriaService.js). */

export const getAllCategorias = async (req, res, next) => {
  try {
    res.status(200).json({ success: true, data: await categoriaService.listar() });
  } catch (error) {
    next(error);
  }
};

export const getCategoriaById = async (req, res, next) => {
  try {
    res.status(200).json({ success: true, data: await categoriaService.obtener(req.params.id) });
  } catch (error) {
    next(error);
  }
};

export const createCategoria = async (req, res, next) => {
  try {
    const data = await categoriaService.crear(req.body ?? {});
    res.status(201).json({ success: true, message: 'Categoría creada correctamente', data });
  } catch (error) {
    next(error);
  }
};

export const updateCategoria = async (req, res, next) => {
  try {
    const data = await categoriaService.actualizar(req.params.id, req.body ?? {});
    res.status(200).json({ success: true, message: 'Categoría actualizada correctamente', data });
  } catch (error) {
    next(error);
  }
};

export const deleteCategoria = async (req, res, next) => {
  try {
    await categoriaService.eliminar(req.params.id);
    res.status(200).json({ success: true, message: 'Categoría eliminada correctamente' });
  } catch (error) {
    next(error);
  }
};
