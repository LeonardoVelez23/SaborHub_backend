import { sinDuplicados } from '../errors/RegistroDuplicado.js';

/** Acceso a Categorias. `m` son los modelos (se leen al usarse). */
export const crearCategoriaRepository = (m) => ({
  listar: () => m.Categoria.findAll({ order: [['nombre', 'ASC']] }),

  buscar: (id) => m.Categoria.findByPk(id),

  crear: (datos) => sinDuplicados(() => m.Categoria.create(datos)),

  actualizar: (categoria, datos) => sinDuplicados(() => categoria.update(datos)),

  /** Con productos, la base lo impide (clave foránea RESTRICT → 400). */
  eliminar: (categoria) => categoria.destroy()
});
