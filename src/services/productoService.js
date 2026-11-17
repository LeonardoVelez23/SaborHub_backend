import { ErrorNegocio } from '../errors/ErrorNegocio.js';
import { RegistroDuplicado } from '../errors/RegistroDuplicado.js';
import { sucursalDelPersonal } from './alcance.js';

export const ESTADOS_PRODUCTO = ['disponible', 'no disponible'];

// Las imágenes están en los assets de la app móvil: solo se guarda el nombre
// del archivo, sin extensión (assets/images/productos/<imagen_codigo>.webp).
const IMAGEN_CODIGO_REGEX = /^[a-z0-9_]{1,60}$/;

/**
 * undefined = no se envió; '' o null = quitar la imagen; texto = código
 * (RF-11, CA-10).
 */
export const leerImagenCodigo = (valor) => {
  if (valor === undefined) return undefined;
  if (valor === null || String(valor).trim() === '') return null;
  const codigo = String(valor).trim();
  if (!IMAGEN_CODIGO_REGEX.test(codigo)) {
    throw new ErrorNegocio(
      'imagen_codigo solo admite minúsculas, números y guion bajo (máx. 60), p. ej. bandeja_paisa'
    );
  }
  return codigo;
};

/**
 * Precio > 0, stock ≥ 0, código de imagen y estado (RN-17). Solo valida
 * lo que se envió. Devuelve el código de imagen (ver leerImagenCodigo).
 */
const validarValores = ({ precio, cantidad_disponible, estado, imagen_codigo }) => {
  if (precio !== undefined && Number(precio) <= 0) throw new ErrorNegocio('El precio debe ser mayor a 0');
  if (cantidad_disponible !== undefined && Number(cantidad_disponible) < 0) {
    throw new ErrorNegocio('La cantidad disponible no puede ser negativa');
  }
  const imagenCodigo = leerImagenCodigo(imagen_codigo);
  if (estado && !ESTADOS_PRODUCTO.includes(estado)) {
    throw new ErrorNegocio('estado debe ser: disponible o no disponible');
  }
  return imagenCodigo;
};

/** El código de producto es único en la sucursal (RN-17). */
const unico = async (operacion) => {
  try {
    return await operacion();
  } catch (error) {
    if (error instanceof RegistroDuplicado) throw new ErrorNegocio('Ya existe un producto con ese código');
    throw error;
  }
};

const noEncontrado = () => new ErrorNegocio('Producto no encontrado', 404);

/** Productos del menú (RF-10 a RF-12). */
export const crearProductoService = ({ productos, categorias }) => {
  /** La categoría existe y es de la misma sucursal que el producto. */
  const categoriaDeSucursal = async (id, sucursalId) => {
    const categoria = await categorias.buscar(id);
    if (!categoria || categoria.sucursal_id !== sucursalId) {
      throw new ErrorNegocio('La categoría indicada no existe');
    }
  };

  return {
    listar: () => productos.listar(),

    obtener: async (id) => {
      const producto = await productos.buscarConCategoria(id);
      if (!producto) throw noEncontrado();
      return producto;
    },

    /** En la sucursal de quien lo crea. */
    crear: async (usuario, datos) => {
      const { codigo, nombre, descripcion, precio, cantidad_disponible, estado, categoria_id } = datos;
      if (!codigo || !nombre || precio === undefined || !categoria_id) {
        throw new ErrorNegocio('Los campos codigo, nombre, precio y categoria_id son obligatorios');
      }
      const imagenCodigo = validarValores(datos);
      const sucursalId = sucursalDelPersonal(usuario);
      await categoriaDeSucursal(categoria_id, sucursalId);

      const producto = await unico(() =>
        productos.crear({
          codigo: codigo.trim(),
          nombre: nombre.trim(),
          descripcion: descripcion?.trim() || null,
          precio,
          cantidad_disponible: cantidad_disponible ?? 0,
          estado: estado || 'disponible',
          categoria_id,
          imagen_codigo: imagenCodigo ?? null,
          sucursal_id: sucursalId
        })
      );
      return productos.buscarConCategoria(producto.id);
    },

    actualizar: async (id, datos) => {
      const { codigo, nombre, descripcion, precio, cantidad_disponible, estado, categoria_id } = datos;
      const producto = await productos.buscar(id);
      if (!producto) throw noEncontrado();
      const imagenCodigo = validarValores(datos);
      if (categoria_id) await categoriaDeSucursal(categoria_id, producto.sucursal_id);

      await unico(() =>
        productos.actualizar(producto, {
          codigo: codigo?.trim() ?? producto.codigo,
          nombre: nombre?.trim() ?? producto.nombre,
          descripcion: descripcion !== undefined ? descripcion?.trim() || null : producto.descripcion,
          precio: precio ?? producto.precio,
          cantidad_disponible: cantidad_disponible ?? producto.cantidad_disponible,
          estado: estado ?? producto.estado,
          categoria_id: categoria_id ?? producto.categoria_id,
          imagen_codigo: imagenCodigo !== undefined ? imagenCodigo : producto.imagen_codigo
        })
      );
      return productos.buscarConCategoria(id);
    },

    eliminar: async (id) => {
      const producto = await productos.buscar(id);
      if (!producto) throw noEncontrado();
      await productos.eliminar(producto);
    }
  };
};
