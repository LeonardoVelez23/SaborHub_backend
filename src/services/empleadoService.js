import { ErrorNegocio } from '../errors/ErrorNegocio.js';
import { RegistroDuplicado } from '../errors/RegistroDuplicado.js';
import { nivelDeCargo } from '../utils/roles.js';
import { SIN_FILTRO, alcanceDe, sucursalParaEscribir } from './alcance.js';
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

const ORDEN_NIVEL = { ninguno: 0, sucursal: 1, restaurante: 2, plataforma: 3 };

/**
 * Nadie da un nivel mayor que el suyo (RN-24): solo el superadmin crea
 * superadmins y solo él o un administrador de restaurante crean
 * administradores de restaurante.
 */
const comprobarNivel = (usuario, cargo) => {
  const propio = alcanceDe(usuario).nivel;
  if (ORDEN_NIVEL[nivelDeCargo(cargo)] > ORDEN_NIVEL[propio]) {
    throw new ErrorNegocio('No puedes asignar un cargo con más alcance que el tuyo', 403);
  }
};

/** El propio perfil se ve siempre; el de otros, si está en el alcance. */
const alcanceSobre = (usuario, id) => (String(usuario.id) === String(id) ? SIN_FILTRO : alcanceDe(usuario));

/** Personal del restaurante (RF-06, RF-07, RF-40). `usuario` es el de la sesión. */
export const crearEmpleadoService = ({ empleados, sucursales, otps, contrasenias }) => {
  /**
   * Restaurante y sucursal de un empleado con `cargo`: la sucursal indicada
   * (solo si quien asigna tiene alcance mayor que una sucursal) o la de
   * quien asigna; un administrador de restaurante no tiene sucursal y el
   * superadmin, ninguno de los dos.
   */
  const ubicacion = async (usuario, cargo, { sucursal_id, restaurante_id }, actual = {}) => {
    const nivel = nivelDeCargo(cargo);
    if (nivel === 'plataforma') return { restaurante_id: null, sucursal_id: null };
    const alcance = alcanceDe(usuario);
    if (nivel === 'restaurante') {
      const restauranteId =
        alcance.nivel === 'restaurante' ? alcance.restauranteId : restaurante_id ?? actual.restaurante_id;
      if (!restauranteId || !(await sucursales.restauranteExiste(restauranteId))) {
        throw new ErrorNegocio('restaurante_id es obligatorio: indica de qué restaurante');
      }
      return { restaurante_id: restauranteId, sucursal_id: null };
    }
    const sucursal = await sucursalParaEscribir(usuario, sucursal_id ?? actual.sucursal_id, sucursales);
    return { restaurante_id: sucursal.restaurante_id, sucursal_id: sucursal.id };
  };

  return {
    listar: (usuario) => empleados.listar(alcanceDe(usuario)),

    /** El personal que no es admin solo ve su propio perfil. */
    obtener: async (id, usuario) => {
      if (usuario.rol !== 'admin' && String(usuario.id) !== String(id)) {
        throw new ErrorNegocio('No tiene permisos para ver este perfil', 403);
      }
      const empleado = await empleados.buscarSinContrasenia(id, alcanceSobre(usuario, id));
      if (!empleado) throw noEncontrado();
      return empleado;
    },

    /** En el alcance de quien lo crea (RF-40, RN-24). */
    crear: async (usuario, datos) => {
      const { identificacion, nombres, apellidos, correo_electronico, telefono, cargo, turno_trabajo, contrasenia } =
        datos;
      if (!identificacion || !nombres || !apellidos || !correo_electronico || !contrasenia) {
        throw new ErrorNegocio(
          'Los campos identificacion, nombres, apellidos, correo_electronico y contrasenia son obligatorios'
        );
      }
      validarPolitica(contrasenia);
      comprobarNivel(usuario, cargo);
      const lugar = await ubicacion(usuario, cargo, datos);

      const empleado = await unico(async () =>
        empleados.crear({
          identificacion: identificacion.trim(),
          nombres: nombres.trim(),
          apellidos: apellidos.trim(),
          correo_electronico: correo_electronico.trim().toLowerCase(),
          telefono: opcional(telefono),
          cargo: opcional(cargo),
          turno_trabajo: opcional(turno_trabajo),
          contrasenia: await contrasenias.hash(contrasenia),
          ...lugar
        })
      );
      return sinContrasenia(empleado);
    },

    actualizar: async (id, usuario, datos) => {
      const { identificacion, nombres, apellidos, correo_electronico, telefono, cargo, turno_trabajo } = datos;
      comprobarDuenio(usuario, id);
      const empleado = await empleados.buscar(id, alcanceSobre(usuario, id));
      if (!empleado) throw noEncontrado();

      const nuevoCargo = cargo !== undefined ? normalizar(cargo) : empleado.cargo;
      const cambiaCargo = cargo !== undefined && nuevoCargo !== empleado.cargo;
      // Solo el administrador cambia cargo y turno: el cargo define el rol,
      // así que un empleado podría darse permisos de admin.
      if (usuario.rol !== 'admin') {
        const cambiaTurno = turno_trabajo !== undefined && normalizar(turno_trabajo) !== empleado.turno_trabajo;
        if (cambiaCargo || cambiaTurno) {
          throw new ErrorNegocio('Solo el administrador puede cambiar el cargo o el turno de trabajo', 403);
        }
      }
      if (cambiaCargo) comprobarNivel(usuario, nuevoCargo);

      // Cambiar de sucursal (RN-24): solo con alcance mayor que una sucursal.
      const mueve = datos.sucursal_id !== undefined && alcanceDe(usuario).nivel !== 'sucursal';
      const lugar =
        cambiaCargo || mueve ? await ubicacion(usuario, nuevoCargo, mueve ? datos : {}, empleado) : {};

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
          cargo: nuevoCargo,
          turno_trabajo: turno_trabajo !== undefined ? opcional(turno_trabajo) : empleado.turno_trabajo,
          ...lugar,
          ...cambio
        })
      );
      return sinContrasenia(empleado);
    },

    eliminar: async (id, usuario) => {
      const empleado = await empleados.buscar(id, alcanceDe(usuario));
      if (!empleado) throw noEncontrado();
      await empleados.eliminar(empleado);
    }
  };
};
