import { ErrorNegocio } from '../errors/ErrorNegocio.js';
import { RegistroDuplicado } from '../errors/RegistroDuplicado.js';
import { alcanceDe, sucursalParaEscribir } from './alcance.js';

const MAX_NOMBRE = 30;

const noEncontrada = () => new ErrorNegocio('Mesa no encontrada', 404);

const nombreValido = (nombre) => {
  const limpio = typeof nombre === 'string' ? nombre.trim() : '';
  if (!limpio) throw new ErrorNegocio('El nombre de la mesa es obligatorio');
  if (limpio.length > MAX_NOMBRE) throw new ErrorNegocio(`El nombre de la mesa admite hasta ${MAX_NOMBRE} caracteres`);
  return limpio;
};

/** La violación de unicidad (sucursal, nombre) → 409. */
const unica = async (operacion) => {
  try {
    return await operacion();
  } catch (error) {
    if (error instanceof RegistroDuplicado) {
      throw new ErrorNegocio('Ya existe una mesa con ese nombre en la sucursal', 409);
    }
    throw error;
  }
};

/**
 * Mesas de la sucursal (DERCAS M9, RF-55, RN-39). Lee y escribe solo en
 * el alcance del personal (RN-21): el de una sucursal, en la suya; el
 * administrador de restaurante o el superadmin, en la que indique.
 */
export const crearMesaService = ({ mesas, sucursales }) => ({
  /** Con `ocupada`, `pedidos_abiertos` y `total_pendiente` (13.4). */
  listar: async (usuario, { sucursal_id, incluir_inactivas } = {}) => {
    const sucursal = await sucursalParaEscribir(usuario, sucursal_id, sucursales);
    const filas = await mesas.listar(sucursal.id, {
      incluirInactivas: incluir_inactivas === true || incluir_inactivas === 'true'
    });
    const abiertos = await mesas.abiertos(filas.map((mesa) => mesa.id));
    return filas.map((mesa) => {
      const { pedidos = 0, total = 0 } = abiertos.get(mesa.id) ?? {};
      return {
        ...mesa.toJSON(),
        ocupada: pedidos > 0,
        pedidos_abiertos: pedidos,
        total_pendiente: Math.round(total * 100) / 100
      };
    });
  },

  crear: async (usuario, { nombre, sucursal_id } = {}) => {
    const limpio = nombreValido(nombre);
    const sucursal = await sucursalParaEscribir(usuario, sucursal_id, sucursales);
    return unica(() => mesas.crear({ sucursal_id: sucursal.id, nombre: limpio, activa: true }));
  },

  /** Renombrar, activar o desactivar. */
  actualizar: async (id, usuario, { nombre, activa } = {}) => {
    const mesa = await mesas.buscar(id, alcanceDe(usuario));
    if (!mesa) throw noEncontrada();
    if (activa !== undefined && typeof activa !== 'boolean') {
      throw new ErrorNegocio('activa debe ser true o false');
    }
    const cambios = {
      ...(nombre !== undefined && { nombre: nombreValido(nombre) }),
      ...(activa !== undefined && { activa })
    };
    return unica(() => mesas.actualizar(mesa, cambios));
  },

  /** Solo sin pedidos: con pedidos se desactiva (RN-39). */
  eliminar: async (id, usuario) => {
    const mesa = await mesas.buscar(id, alcanceDe(usuario));
    if (!mesa) throw noEncontrada();
    if (await mesas.contarPedidos(mesa.id)) {
      throw new ErrorNegocio('La mesa tiene pedidos: desactívala', 409);
    }
    await mesas.eliminar(mesa);
  }
});
