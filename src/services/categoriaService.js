import { ErrorNegocio } from '../errors/ErrorNegocio.js';
import { RegistroDuplicado } from '../errors/RegistroDuplicado.js';
import { SIN_FILTRO, alcanceDe, sucursalParaEscribir } from './alcance.js';

/** ?sucursal_id= del menú público: entero positivo o sin filtro. */
export const idOpcional = (valor) => {
  if (valor === undefined || valor === '') return undefined;
  const id = Number(valor);
  if (!Number.isInteger(id) || id <= 0) throw new ErrorNegocio('sucursal_id inválido');
  return id;
};

const noEncontrada = () => new ErrorNegocio('Categoría no encontrada', 404);

/** Nombre obligatorio y sin espacios sobrantes. */
const nombreValido = (nombre) => {
  if (typeof nombre !== 'string' || nombre.trim() === '') {
    throw new ErrorNegocio('El nombre de la categoría es obligatorio');
  }
  return nombre.trim();
};

/** El nombre de la categoría es único en la sucursal (RN-17). */
const unico = async (operacion) => {
  try {
    return await operacion();
  } catch (error) {
    if (error instanceof RegistroDuplicado) throw new ErrorNegocio('Ya existe una categoría con ese nombre');
    throw error;
  }
};

/** Categorías del menú (RF-09, RF-12). */
export const crearCategoriaService = ({ categorias, sucursales }) => ({
  listar: ({ sucursalId } = {}) => categorias.listar({ sucursalId: idOpcional(sucursalId) }),

  obtener: async (id) => {
    const categoria = await categorias.buscar(id, SIN_FILTRO);
    if (!categoria) throw noEncontrada();
    return categoria;
  },

  /**
   * En la sucursal de quien la crea (o la indicada, para el administrador
   * de restaurante o el superadmin); el nombre es único en la sucursal.
   */
  crear: async (usuario, { nombre, sucursal_id }) => {
    const limpio = nombreValido(nombre);
    const sucursal = await sucursalParaEscribir(usuario, sucursal_id, sucursales);
    return unico(() => categorias.crear({ nombre: limpio, sucursal_id: sucursal.id }));
  },

  actualizar: async (id, usuario, { nombre }) => {
    const categoria = await categorias.buscar(id, alcanceDe(usuario));
    if (!categoria) throw noEncontrada();
    const limpio = nombreValido(nombre);
    await unico(() => categorias.actualizar(categoria, { nombre: limpio }));
    return categoria;
  },

  eliminar: async (id, usuario) => {
    const categoria = await categorias.buscar(id, alcanceDe(usuario));
    if (!categoria) throw noEncontrada();
    await categorias.eliminar(categoria);
  }
});
