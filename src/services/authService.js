import { ErrorNegocio } from '../errors/ErrorNegocio.js';
import { validarPolitica } from './cuentas.js';

const MENSAJE_RECUPERACION = 'Si el correo está registrado, recibirás el código de verificación.';

/**
 * Inicio de sesión y recuperación de contraseña (RF-02, RF-03, RF-05).
 * `emitirToken(cuenta, rol)` firma el JWT; `correo.enviarCodigo` envía el OTP.
 */
export const crearAuthService = ({ cuentas, otps, contrasenias, emitirToken, rolDeCargo, correo, mostrarCodigo = null, registro = console }) => ({
  /**
   * Busca primero entre los clientes y luego entre el personal. El mismo
   * mensaje para cuenta inexistente y contraseña incorrecta (CA-03).
   */
  ingresar: async ({ email, password }) => {
    if (!email || !password) {
      throw new ErrorNegocio('Por favor, ingrese su correo/identificación y contraseña');
    }
    const encontrada = await cuentas.paraIngresar(email);
    const invalidas = new ErrorNegocio('Credenciales inválidas', 401);
    if (!encontrada) throw invalidas;
    const { cuenta, esCliente } = encontrada;
    if (!(await contrasenias.comparar(password, cuenta.contrasenia))) throw invalidas;

    const rol = esCliente ? 'cliente' : rolDeCargo(cuenta.cargo);
    const { contrasenia: _, ...datos } = cuenta.toJSON();
    return { token: emitirToken(cuenta, rol), user: { ...datos, rol } };
  },

  /**
   * Envía un código nuevo. Responde lo mismo exista o no el correo, y
   * aunque falle el envío: otra respuesta revelaría qué correos tienen
   * cuenta (RNF-06). Devuelve el mensaje para el usuario.
   */
  solicitarCodigo: async ({ email }) => {
    if (!email) throw new ErrorNegocio('Por favor, ingrese su correo electrónico');
    const cuenta = await cuentas.porCorreo(email.trim().toLowerCase());
    if (!cuenta) return MENSAJE_RECUPERACION;

    const otp = await otps.emitir(cuenta);
    mostrarCodigo?.(cuenta.correo_electronico, otp);
    try {
      await correo.enviarCodigo(cuenta.correo_electronico, otp, `${cuenta.nombres} ${cuenta.apellidos}`);
    } catch (error) {
      registro.error('Error enviando OTP de recuperación:', error);
    }
    return MENSAJE_RECUPERACION;
  },

  /** Nueva contraseña con el código del correo. */
  restablecer: async ({ email, otp, newPassword }) => {
    if (!email || !otp || !newPassword) {
      throw new ErrorNegocio('Correo, código OTP y nueva contraseña son requeridos');
    }
    validarPolitica(newPassword);
    const cuenta = await cuentas.porCorreo(email.trim().toLowerCase());
    if (!cuenta || !(await otps.verificar(cuenta, otp))) {
      throw new ErrorNegocio('El código ingresado es incorrecto o ha expirado. Solicita uno nuevo.');
    }
    await cuentas.actualizar(cuenta, { contrasenia: await contrasenias.hash(newPassword), ...otps.limpio });
  }
});
