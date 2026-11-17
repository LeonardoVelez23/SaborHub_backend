import { ErrorNegocio } from '../errors/ErrorNegocio.js';

/** Tamaño máximo de la foto ya decodificada (la app la envía de 512 px). */
export const MAX_BYTES_FOTO = 600 * 1024;

const BASE64 = /^[A-Za-z0-9+/]+={0,2}$/;
const FIRMA_PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

/** Tipo de imagen según sus primeros bytes (no se confía en lo que diga la app). */
export const tipoDeImagen = (bytes) => {
  if (bytes.length > 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg';
  if (bytes.length > 8 && bytes.subarray(0, 8).equals(FIRMA_PNG)) return 'image/png';
  if (
    bytes.length > 12 &&
    bytes.subarray(0, 4).toString('ascii') === 'RIFF' &&
    bytes.subarray(8, 12).toString('ascii') === 'WEBP'
  ) {
    return 'image/webp';
  }
  return null;
};

/**
 * Perfil del cliente de la sesión (RF-06): sus datos con la fecha de su
 * foto, y la foto opcional (JPEG, PNG o WebP, máx. 600 KB). Editar los
 * datos usa las reglas de clienteService.
 */
export const crearPerfilService = ({ clientes, fotos }) => ({
  obtener: async (clienteId) => {
    const cliente = await clientes.buscarConFoto(clienteId);
    if (!cliente) throw new ErrorNegocio('Cliente no encontrado', 404);
    const { foto, ...datos } = cliente.toJSON();
    return { ...datos, foto_actualizada_en: foto?.updatedAt ?? null };
  },

  /** `imagen` en base64; devuelve la fecha de la foto guardada. */
  guardarFoto: async (clienteId, imagen) => {
    if (typeof imagen !== 'string' || !BASE64.test(imagen)) throw new ErrorNegocio('Envía la imagen en base64');
    const bytes = Buffer.from(imagen, 'base64');
    if (bytes.length > MAX_BYTES_FOTO) throw new ErrorNegocio('La imagen es demasiado grande (máximo 600 KB)');
    const tipo = tipoDeImagen(bytes);
    if (!tipo) throw new ErrorNegocio('La imagen debe ser JPEG, PNG o WebP');
    return fotos.guardar(clienteId, bytes, tipo);
  },

  foto: async (clienteId) => {
    const foto = await fotos.buscar(clienteId);
    if (!foto) throw new ErrorNegocio('No tienes foto de perfil', 404);
    return { tipo: foto.tipo, imagen: Buffer.from(foto.datos).toString('base64'), actualizada_en: foto.updatedAt };
  },

  quitarFoto: (clienteId) => fotos.eliminar(clienteId)
});
