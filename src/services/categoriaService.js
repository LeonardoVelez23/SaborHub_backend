import { ErrorNegocio } from '../errors/ErrorNegocio.js';
import { RegistroDuplicado } from '../errors/RegistroDuplicado.js';

const noEncontrada = () => new ErrorNegocio('Categoría no encontrada', 404);

/** Nombre obligatorio y sin espacios sobrantes. */
const nombreValido = (nombre) => {
  if (typeof nombre !== 'string' || nombre.trim() === '') {
    throw new ErrorNegocio('El nombre de la categoría es obligatorio');
  }
  return nombre.trim();
};

/** El nombre de la categoría es único (RN-17). */
const unico = async (operacion) => {
  try {
    return await operacion();
  } catch (error) {
    if (error instanceof RegistroDuplicado) throw new ErrorNegocio('Ya existe una categoría con ese nombre');
    throw error;
  }
};

/** Categorías del menú (RF-09, RF-12). */
export const crearCategoriaService = ({ categorias }) => ({
  listar: () => categorias.listar(),

  obtener: async (id) => {
    const categoria = await categorias.buscar(id);
    if (!categoria) throw noEncontrada();
    return categoria;
  },

  crear: async ({ nombre }) => {
    const limpio = nombreValido(nombre);
    return unico(() => categorias.crear({ nombre: limpio }));
  },

  actualizar: async (id, { nombre }) => {
    const categoria = await categorias.buscar(id);
    if (!categoria) throw noEncontrada();
    const limpio = nombreValido(nombre);
    await unico(() => categorias.actualizar(categoria, { nombre: limpio }));
    return categoria;
  },

  eliminar: async (id) => {
    const categoria = await categorias.buscar(id);
    if (!categoria) throw noEncontrada();
    await categorias.eliminar(categoria);
  }
});
