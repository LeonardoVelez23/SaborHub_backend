import { ErrorNegocio } from '../errors/ErrorNegocio.js';
import { RegistroDuplicado } from '../errors/RegistroDuplicado.js';
import { cambioDeContrasenia, comprobarDuenio, opcional, sinContrasenia, validarPolitica } from './cuentas.js';

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

/** El consumidor final es del sistema: no se edita ni se elimina (RN-38). */
const consumidorFinalFijo = () => new ErrorNegocio('El consumidor final no se puede modificar ni eliminar', 403);

const esPersonal = (usuario) => Boolean(usuario) && usuario.rol !== 'cliente';
const esSuperadmin = (usuario) => usuario?.nivel === 'plataforma';

/** La cuenta solo la modifica el propio cliente o el superadmin (RN-28). */
const comprobarCuenta = (usuario, id) => {
  if (usuario?.rol === 'cliente') return comprobarDuenio(usuario, id);
  if (!esSuperadmin(usuario)) {
    throw new ErrorNegocio('Solo el cliente o el superadmin pueden modificar la cuenta de un cliente', 403);
  }
};

/** Cliente con su afiliación al restaurante del personal (o null para el superadmin). */
const conAfiliacion = (cliente) => {
  const { afiliaciones, ...datos } = cliente.toJSON ? cliente.toJSON() : cliente;
  return { ...datos, afiliacion: afiliaciones?.[0] ?? null };
};

/**
 * Clientes (RF-01, RF-06, RF-08, RF-44). `usuario` es el de la sesión
 * ({id, rol, nivel, restaurante_id}) o null en el registro público.
 * `afiliacion` es el servicio de clientes por restaurante (RN-26 a RN-28).
 */
export const crearClienteService = ({ clientes, afiliacion, otps, contrasenias, versionLegal, ahora = () => new Date() }) => ({
  /** Solo los afiliados al restaurante del personal; el superadmin, todos (RN-26). */
  listar: async (usuario) => (await afiliacion.clientesDelPersonal(usuario)).map(conAfiliacion),

  /** Búsqueda exacta para un pedido asistido (RF-44). */
  buscar: (usuario, texto) => afiliacion.buscar(usuario, texto),

  /** Un cliente solo ve su propio perfil; el personal, a sus afiliados (fuera de ellos, 404). */
  obtener: async (id, usuario) => {
    if (usuario.rol === 'cliente' && String(usuario.id) !== String(id)) {
      throw new ErrorNegocio('No tiene permisos para ver este perfil', 403);
    }
    if (esPersonal(usuario) && !(await afiliacion.visibleParaPersonal(usuario, id))) throw noEncontrado();
    const cliente = await clientes.buscarSinContrasenia(id);
    if (!cliente) throw noEncontrado();
    return cliente;
  },

  /**
   * Quien se registra acepta los términos y la política de datos vigentes
   * (LOPDP). El personal que crea un cliente desde el panel no acepta por él;
   * con `consentimiento_presencial: true` lo afilia a su restaurante (RF-43).
   */
  crear: async (usuario, datos) => {
    // tipo_cliente es obsoleto (18-11-2026): si llega (versiones viejas de la app), se ignora.
    const { identificacion, nombres, apellidos, correo_electronico, telefono, contrasenia } = datos;
    if (!identificacion || !nombres || !apellidos || !correo_electronico || !contrasenia) {
      throw new ErrorNegocio(
        'Los campos identificacion, nombres, apellidos, correo_electronico y contrasenia son obligatorios'
      );
    }
    validarPolitica(contrasenia);

    const delPersonal = esPersonal(usuario);
    let aceptacionLegal = {};
    if (!delPersonal) {
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
        contrasenia: await contrasenias.hash(contrasenia),
        ...aceptacionLegal
      })
    );
    if (delPersonal && datos.consentimiento_presencial === true) {
      await afiliacion.afiliarPresencial(cliente.id, usuario);
    }
    return sinContrasenia(cliente);
  },

  /**
   * Edita los datos (RN-16, RN-28): el propio cliente o el superadmin.
   * Cambiar la contraseña exige el código del correo, salvo al superadmin.
   */
  actualizar: async (id, usuario, datos) => {
    const { identificacion, nombres, apellidos, correo_electronico, telefono } = datos;
    comprobarCuenta(usuario, id);
    const cliente = await clientes.buscar(id);
    if (!cliente) throw noEncontrado();
    if (cliente.es_consumidor_final) throw consumidorFinalFijo();

    const cambio = await cambioDeContrasenia(
      { cuenta: cliente, contrasenia: datos.contrasenia, otp: datos.otp, sinOtp: esSuperadmin(usuario) },
      { otps, contrasenias }
    );

    await unico(() =>
      clientes.actualizar(cliente, {
        identificacion: identificacion?.trim() ?? cliente.identificacion,
        nombres: nombres?.trim() ?? cliente.nombres,
        apellidos: apellidos?.trim() ?? cliente.apellidos,
        correo_electronico: correo_electronico?.trim().toLowerCase() ?? cliente.correo_electronico,
        telefono: telefono !== undefined ? opcional(telefono) : cliente.telefono,
        ...cambio
      })
    );
    return sinContrasenia(cliente);
  },

  /** Solo el superadmin (RN-28); el cliente elimina la suya en /privacidad. */
  eliminar: async (id, usuario) => {
    if (!esSuperadmin(usuario)) {
      throw new ErrorNegocio('Solo el superadmin puede eliminar la cuenta de un cliente', 403);
    }
    const cliente = await clientes.buscar(id);
    if (!cliente) throw noEncontrado();
    if (cliente.es_consumidor_final) throw consumidorFinalFijo();
    await clientes.eliminar(cliente);
  }
});
