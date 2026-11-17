import { porId } from './alcance.js';
import { sinDuplicados } from '../errors/RegistroDuplicado.js';

/** Restaurantes. `filtro` es el where del alcance (lo arma el servicio). */
export const crearRestauranteRepository = (m) => ({
  listar: (filtro) => m.Restaurante.findAll({ where: filtro, order: [['nombre', 'ASC']] }),
  buscar: (id, filtro) => m.Restaurante.findOne({ where: porId(id, filtro) }),
  crear: (datos) => sinDuplicados(() => m.Restaurante.create(datos)),
  actualizar: (fila, datos) => sinDuplicados(() => fila.update(datos))
});
