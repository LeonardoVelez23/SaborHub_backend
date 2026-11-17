import { sinDuplicados } from '../errors/RegistroDuplicado.js';
import { filtroDeSucursales, porId } from './alcance.js';

/** Datos públicos de una sucursal (sin la tienda de Payphone). */
const PUBLICOS = ['id', 'restaurante_id', 'nombre', 'direccion', 'telefono', 'horario'];

/** Sucursales. `m` son los modelos (se leen al usarse). */
export const crearSucursalRepository = (m) => {
  const restaurantePublico = (atributos = ['id', 'nombre']) => ({
    model: m.Restaurante,
    as: 'restaurante',
    attributes: atributos,
    where: { estado: 'activo' },
    required: true
  });

  return {
    /** La sucursal si existe y está en el alcance; si no, null. */
    buscar: (id, alcance) => m.Sucursal.findOne({ where: porId(id, filtroDeSucursales(alcance)) }),

    restauranteExiste: async (id) => Boolean(await m.Restaurante.findByPk(id, { attributes: ['id'] })),

    /** Con el estado de su restaurante (para saber si recibe pedidos). */
    buscarConRestaurante: (id, alcance) =>
      m.Sucursal.findOne({
        where: porId(id, filtroDeSucursales(alcance)),
        include: { model: m.Restaurante, as: 'restaurante', attributes: ['id', 'estado'] }
      }),

    /** Activas de restaurantes activos, para la app (RF-37). */
    listarPublicas: () =>
      m.Sucursal.findAll({
        where: { activa: true },
        attributes: PUBLICOS,
        include: restaurantePublico(),
        order: [[{ model: m.Restaurante, as: 'restaurante' }, 'nombre', 'ASC'], ['nombre', 'ASC']]
      }),

    buscarPublica: (id) =>
      m.Sucursal.findOne({ where: { id, activa: true }, attributes: PUBLICOS, include: restaurantePublico() }),

    /** Todas las del alcance, activas o no, con sus datos de pago (gestión). */
    listar: (alcance) =>
      m.Sucursal.findAll({
        where: filtroDeSucursales(alcance),
        include: { model: m.Restaurante, as: 'restaurante', attributes: ['id', 'nombre', 'estado'] },
        order: [['restaurante_id', 'ASC'], ['nombre', 'ASC']]
      }),

    crear: (datos) => sinDuplicados(() => m.Sucursal.create(datos)),
    actualizar: (fila, datos) => sinDuplicados(() => fila.update(datos))
  };
};
