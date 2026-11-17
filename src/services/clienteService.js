import { ErrorNegocio } from '../errors/ErrorNegocio.js';
import { RegistroDuplicado } from '../errors/RegistroDuplicado.js';
import { cambioDeContrasenia, comprobarDuenio, opcional, sinContrasenia, validarPolitica } from './cuentas.js';

export const TIPOS_CLIENTE = ['Estudiante', 'Docente', 'Personal Administrativo', 'Persona externa'];

const validarTipo = (tipo) => {
  if (!TIPOS_CLIENTE.includes(tipo)) {
    throw new ErrorNegocio('tipo_cliente debe ser: Estudiante, Docente, Personal Administrativo o Persona externa');
  }
};

/** Identificación y correo únicos entre clientes (RN-18). */
const unico = async (operacion) => {
  try {
    return await operacion();
  } catch (error) {
    if (error instanceof RegistroDuplicado) {
      throw new ErrorNegocio('Ya existe un cliente con esa identificación o correo electrónico');
    }
    throw error;
  }
};

const noEncontrado = () => new ErrorNegocio('Cliente no encontrado', 404);

/**
 * Clientes (RF-01, RF-06, RF-08). `usuario` es el de la sesión ({id, rol})
 * o null en el registro público.
 */
export const crearClienteService = ({ clientes, otps, contrasenias, versionLegal, ahora = () => new Date() }) => ({
  listar: () => clientes.listarActivos(),

  /** Un cliente solo ve su propio perfil. */
  obtener: async (id, usuario) => {
    if (usuario.rol === 'cliente' && String(usuario.id) !== String(id)) {
      throw new ErrorNegocio('No tiene permisos para ver este perfil', 403);
    }
    const cliente = await clientes.buscarSinContrasenia(id);
    if (!cliente) throw noEncontrado();
    return cliente;
  },

  /**
   * Quien se registra acepta los términos y la política de datos vigentes
   * (LOPDP). El personal que crea un cliente desde el panel no acepta por él.
   */
  crear: async (usuario, datos) => {
    const { identificacion, nombres, apellidos, correo_electronico, telefono, tipo_cliente, contrasenia } = datos;
    if (!identificacion || !nombres || !apellidos || !correo_electronico || !tipo_cliente || !contrasenia) {
      throw new ErrorNegocio(
        'Los campos identificacion, nombres, apellidos, correo_electronico, tipo_cliente y contrasenia son obligatorios'
      );
    }
    validarTipo(tipo_cliente);
    validarPolitica(contrasenia);

    const esPersonal = Boolean(usuario) && usuario.rol !== 'cliente';
    let aceptacionLegal = {};
    if (!esPersonal) {
      if (datos.acepta_terminos !== true) {
        throw new ErrorNegocio('Debes aceptar los términos y condiciones y la política de protección de datos');
      }
      if (datos.version_legal !== versionLegal) {
        throw new ErrorNegocio('Los términos y condiciones se actualizaron. Revísalos y acéptalos de nuevo.');
      }
      aceptacionLegal = { legal_version: versionLegal, legal_aceptado_en: ahora() };
    }

    const cliente = await unico(async () =>
      clientes.crear({
        identificacion: identificacion.trim(),
        nombres: nombres.trim(),
        apellidos: apellidos.trim(),
        correo_electronico: correo_electronico.trim().toLowerCase(),
        telefono: opcional(telefono),
        tipo_cliente,
        contrasenia: await contrasenias.hash(contrasenia),
        ...aceptacionLegal
      })
    );
    return sinContrasenia(cliente);
  },

  /**
   * Edita los datos (RN-16). Cambiar la contraseña exige el código del
   * correo, salvo que lo haga el administrador.
   */
  actualizar: async (id, usuario, datos) => {
    const { identificacion, nombres, apellidos, correo_electronico, telefono, tipo_cliente } = datos;
    comprobarDuenio(usuario, id);
    const cliente = await clientes.buscar(id);
    if (!cliente) throw noEncontrado();
    if (tipo_cliente) validarTipo(tipo_cliente);

    const cambio = await cambioDeContrasenia(
      { cuenta: cliente, contrasenia: datos.contrasenia, otp: datos.otp, sinOtp: usuario.rol === 'admin' },
      { otps, contrasenias }
    );

    await unico(() =>
      clientes.actualizar(cliente, {
        identificacion: identificacion?.trim() ?? cliente.identificacion,
        nombres: nombres?.trim() ?? cliente.nombres,
        apellidos: apellidos?.trim() ?? cliente.apellidos,
        correo_electronico: correo_electronico?.trim().toLowerCase() ?? cliente.correo_electronico,
        telefono: telefono !== undefined ? opcional(telefono) : cliente.telefono,
        tipo_cliente: tipo_cliente ?? cliente.tipo_cliente,
        ...cambio
      })
    );
    return sinContrasenia(cliente);
  },

  eliminar: async (id) => {
    const cliente = await clientes.buscar(id);
    if (!cliente) throw noEncontrado();
    await clientes.eliminar(cliente);
  }
});
