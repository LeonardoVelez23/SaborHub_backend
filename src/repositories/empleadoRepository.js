import { sinDuplicados } from '../errors/RegistroDuplicado.js';
import { filtroEmpleados } from './alcance.js';

const SIN_CONTRASENIA = { exclude: ['contrasenia'] };

/** Acceso a Empleados. `m` son los modelos (se leen al usarse). */
export const crearEmpleadoRepository = (m) => ({
  listar: (alcance) =>
    m.Empleado.findAll({
      where: filtroEmpleados(alcance),
      attributes: SIN_CONTRASENIA,
      order: [['apellidos', 'ASC'], ['nombres', 'ASC']]
    }),

  /** Solo si está en el alcance (SIN_FILTRO para el propio perfil). */
  buscar: (id, alcance) => m.Empleado.findOne({ where: { id, ...filtroEmpleados(alcance) } }),

  buscarSinContrasenia: (id, alcance) =>
    m.Empleado.findOne({ where: { id, ...filtroEmpleados(alcance) }, attributes: SIN_CONTRASENIA }),

  crear: (datos) => sinDuplicados(() => m.Empleado.create(datos)),

  actualizar: (empleado, datos) => sinDuplicados(() => empleado.update(datos)),

  eliminar: (empleado) => empleado.destroy()
});
