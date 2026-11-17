import { sinDuplicados } from '../errors/RegistroDuplicado.js';

const SIN_CONTRASENIA = { exclude: ['contrasenia'] };

/** Acceso a Empleados. `m` son los modelos (se leen al usarse). */
export const crearEmpleadoRepository = (m) => ({
  listar: () =>
    m.Empleado.findAll({ attributes: SIN_CONTRASENIA, order: [['apellidos', 'ASC'], ['nombres', 'ASC']] }),

  buscar: (id) => m.Empleado.findByPk(id),

  buscarSinContrasenia: (id) => m.Empleado.findByPk(id, { attributes: SIN_CONTRASENIA }),

  crear: (datos) => sinDuplicados(() => m.Empleado.create(datos)),

  actualizar: (empleado, datos) => sinDuplicados(() => empleado.update(datos)),

  eliminar: (empleado) => empleado.destroy()
});
