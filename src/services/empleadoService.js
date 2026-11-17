import { ErrorNegocio } from '../errors/ErrorNegocio.js';
import { RegistroDuplicado } from '../errors/RegistroDuplicado.js';
import { cambioDeContrasenia, comprobarDuenio, opcional, sinContrasenia, validarPolitica } from './cuentas.js';

/** Identificación y correo únicos entre empleados (RN-18). */
const unico = async (operacion) => {
  try {
    return await operacion();
  } catch (error) {
    if (error instanceof RegistroDuplicado) {
      throw new ErrorNegocio('Ya existe un empleado con esa identificación o correo electrónico');
    }
    throw error;
  }
};

const noEncontrado = () => new ErrorNegocio('Empleado no encontrado', 404);

/** undefined = no se envió; '' = vaciar. */
const normalizar = (valor) => (valor === undefined ? undefined : opcional(valor));

/** Personal del restaurante (RF-06, RF-07). `usuario` es el de la sesión. */
export const crearEmpleadoService = ({ empleados, otps, contrasenias }) => ({
  listar: () => empleados.listar(),

  /** El personal que no es admin solo ve su propio perfil. */
  obtener: async (id, usuario) => {
    if (usuario.rol !== 'admin' && String(usuario.id) !== String(id)) {
      throw new ErrorNegocio('No tiene permisos para ver este perfil', 403);
    }
    const empleado = await empleados.buscarSinContrasenia(id);
    if (!empleado) throw noEncontrado();
    return empleado;
  },

  crear: async (datos) => {
    const { identificacion, nombres, apellidos, correo_electronico, telefono, cargo, turno_trabajo, contrasenia } =
      datos;
    if (!identificacion || !nombres || !apellidos || !correo_electronico || !contrasenia) {
      throw new ErrorNegocio(
        'Los campos identificacion, nombres, apellidos, correo_electronico y contrasenia son obligatorios'
      );
    }
    validarPolitica(contrasenia);

    const empleado = await unico(async () =>
      empleados.crear({
        identificacion: identificacion.trim(),
        nombres: nombres.trim(),
        apellidos: apellidos.trim(),
        correo_electronico: correo_electronico.trim().toLowerCase(),
        telefono: opcional(telefono),
        cargo: opcional(cargo),
        turno_trabajo: opcional(turno_trabajo),
        contrasenia: await contrasenias.hash(contrasenia)
      })
    );
    return sinContrasenia(empleado);
  },

  actualizar: async (id, usuario, datos) => {
    const { identificacion, nombres, apellidos, correo_electronico, telefono, cargo, turno_trabajo } = datos;
    comprobarDuenio(usuario, id);
    const empleado = await empleados.buscar(id);
    if (!empleado) throw noEncontrado();

    // Solo el administrador cambia cargo y turno: el cargo define el rol,
    // así que un empleado podría darse permisos de admin.
    if (usuario.rol !== 'admin') {
      const cambiaCargo = cargo !== undefined && normalizar(cargo) !== empleado.cargo;
      const cambiaTurno = turno_trabajo !== undefined && normalizar(turno_trabajo) !== empleado.turno_trabajo;
      if (cambiaCargo || cambiaTurno) {
        throw new ErrorNegocio('Solo el administrador puede cambiar el cargo o el turno de trabajo', 403);
      }
    }

    // El administrador cambia la contraseña de otro sin OTP; la suya, con OTP.
    const cambio = await cambioDeContrasenia(
      {
        cuenta: empleado,
        contrasenia: datos.contrasenia,
        otp: datos.otp,
        sinOtp: usuario.rol === 'admin' && usuario.id !== empleado.id
      },
      { otps, contrasenias }
    );

    await unico(() =>
      empleados.actualizar(empleado, {
        identificacion: identificacion?.trim() ?? empleado.identificacion,
        nombres: nombres?.trim() ?? empleado.nombres,
        apellidos: apellidos?.trim() ?? empleado.apellidos,
        correo_electronico: correo_electronico?.trim().toLowerCase() ?? empleado.correo_electronico,
        telefono: telefono !== undefined ? opcional(telefono) : empleado.telefono,
        cargo: cargo !== undefined ? opcional(cargo) : empleado.cargo,
        turno_trabajo: turno_trabajo !== undefined ? opcional(turno_trabajo) : empleado.turno_trabajo,
        ...cambio
      })
    );
    return sinContrasenia(empleado);
  },

  eliminar: async (id) => {
    const empleado = await empleados.buscar(id);
    if (!empleado) throw noEncontrado();
    await empleados.eliminar(empleado);
  }
});
