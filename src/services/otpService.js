import crypto from 'node:crypto';

export const OTP_TTL_MS = 15 * 60 * 1000; // 15 minutos (RN-15)
export const OTP_MAX_ATTEMPTS = 5;

/** Campos que dejan la cuenta sin código pendiente. */
export const otpLimpio = {
  reset_password_token: null,
  reset_password_expires: null,
  reset_password_attempts: 0
};

/**
 * Códigos de un solo uso enviados por correo (RN-15). Se guarda un HMAC
 * del código con `secreto`, no el código: con una copia de la base no se
 * puede usar ni adivinar. `cuentas` guarda los cambios en la cuenta
 * (Cliente o Empleado).
 */
export const crearOtpService = ({ cuentas, secreto, ahora = () => Date.now() }) => {
  const hmac = (otp) => crypto.createHmac('sha256', secreto).update(String(otp)).digest('hex');

  return {
    limpio: otpLimpio,

    /** Código nuevo de 6 dígitos (invalida el anterior); devuelve el código en claro. */
    emitir: async (cuenta) => {
      const otp = crypto.randomInt(0, 1_000_000).toString().padStart(6, '0');
      await cuentas.actualizar(cuenta, {
        reset_password_token: hmac(otp),
        reset_password_expires: new Date(ahora() + OTP_TTL_MS),
        reset_password_attempts: 0
      });
      return otp;
    },

    /**
     * Un intento fallido suma 1; al llegar a OTP_MAX_ATTEMPTS el código deja
     * de servir aunque no haya vencido. No lo borra: quien lo use guarda
     * `otpLimpio` junto con el cambio.
     */
    verificar: async (cuenta, otp) => {
      if (
        !cuenta.reset_password_token ||
        !cuenta.reset_password_expires ||
        new Date(cuenta.reset_password_expires).getTime() <= ahora() ||
        cuenta.reset_password_attempts >= OTP_MAX_ATTEMPTS
      ) {
        return false;
      }
      const codigo = String(otp ?? '').trim();
      const esperado = Buffer.from(cuenta.reset_password_token, 'utf8');
      const recibido = Buffer.from(hmac(codigo), 'utf8');
      const valido =
        /^\d{6}$/.test(codigo) && esperado.length === recibido.length && crypto.timingSafeEqual(esperado, recibido);
      if (!valido) {
        await cuentas.sumarIntentoOtp(cuenta);
        return false;
      }
      return true;
    }
  };
};
