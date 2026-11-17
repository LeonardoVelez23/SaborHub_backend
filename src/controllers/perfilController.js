import { clienteService, perfilService } from '../dependencias.js';

/**
 * Perfil del cliente de la sesión (RF-06): solo HTTP. Editar los datos
 * aplica las mismas reglas que /clientes/:id (clienteService), sin que la
 * app tenga que conocer su id.
 */

export const getPerfil = async (req, res, next) => {
  try {
    res.status(200).json({ success: true, data: await perfilService.obtener(req.user.id) });
  } catch (error) {
    next(error);
  }
};

export const updatePerfil = async (req, res, next) => {
  try {
    const data = await clienteService.actualizar(req.user.id, req.user, req.body ?? {});
    res.status(200).json({ success: true, message: 'Cliente actualizado correctamente', data });
  } catch (error) {
    next(error);
  }
};

/** PUT /perfil/foto  body {imagen: base64} — JPEG, PNG o WebP. */
export const putFoto = async (req, res, next) => {
  try {
    const fecha = await perfilService.guardarFoto(req.user.id, req.body?.imagen);
    res.status(200).json({ success: true, message: 'Foto actualizada', data: { foto_actualizada_en: fecha } });
  } catch (error) {
    next(error);
  }
};

/** GET /perfil/foto → {tipo, imagen: base64, actualizada_en} o 404. */
export const getFoto = async (req, res, next) => {
  try {
    res.status(200).json({ success: true, data: await perfilService.foto(req.user.id) });
  } catch (error) {
    next(error);
  }
};

export const deleteFoto = async (req, res, next) => {
  try {
    await perfilService.quitarFoto(req.user.id);
    res.status(200).json({ success: true, message: 'Foto eliminada' });
  } catch (error) {
    next(error);
  }
};
