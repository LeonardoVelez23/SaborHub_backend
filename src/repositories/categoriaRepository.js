import { sinDuplicados } from '../errors/RegistroDuplicado.js';
import { filtroSucursal, porId } from './alcance.js';

/** Acceso a Categorias. `m` son los modelos (se leen al usarse). */
export const crearCategoriaRepository = (m) => ({
  /** Públicas; con `sucursalId`, solo las de esa sucursal. */
  listar: ({ sucursalId } = {}) =>
    m.Categoria.findAll({ ...(sucursalId && { where: { sucursal_id: sucursalId } }), order: [['nombre', 'ASC']] }),

  /** Solo si está en el alcance (SIN_FILTRO para la consulta pública). */
  buscar: (id, alcance) => m.Categoria.findOne({ where: porId(id, filtroSucursal(alcance)) }),

  crear: (datos) => sinDuplicados(() => m.Categoria.create(datos)),

  actualizar: (categoria, datos) => sinDuplicados(() => categoria.update(datos)),

  /** Con productos, la base lo impide (clave foránea RESTRICT → 400). */
  eliminar: (categoria) => categoria.destroy()
});
