import crypto from 'node:crypto';
import { ErrorNegocio } from '../errors/ErrorNegocio.js';

/**
 * Ingreso con huella o rostro (RF-02a, app móvil, solo clientes).
 *
 * La app no guarda la contraseña: al activarlo recibe una credencial del
 * dispositivo (`<id>.<secreto>`) que guarda cifrada y solo envía después de
 * verificar la huella con el sistema operativo. Aquí se guarda el SHA-256
 * del secreto. Cada ingreso entrega un secreto nuevo (el anterior deja de
 * servir) y la credencial vence tras 30 días sin usarse.
 */

export const DIAS_SIN_USO = 30;
export const MAX_POR_CLIENTE = 5;
const INVALIDA = 'El ingreso con huella ya no es válido. Inicia sesión con tu contraseña.';

const hash = (secreto) => crypto.createHash('sha256').update(secreto).digest('hex');
const nuevoSecreto = () => crypto.randomBytes(32).toString('base64url');

/** `<id>.<secreto>` → { id, secreto } o null si no tiene ese formato. */
export const leerCredencial = (texto) => {
  if (typeof texto !== 'string') return null;
  const match = /^(\d{1,10})\.([A-Za-z0-9_-]{43})$/.exec(texto);
  return match ? { id: Number(match[1]), secreto: match[2] } : null;
};

const dispositivoDe = (valor) => (typeof valor === 'string' && valor.trim() ? valor.trim().slice(0, 100) : null);

export const crearBiometricoService = ({ credenciales, clientes, emitirToken, ahora = () => new Date() }) => {
  const vencida = (credencial) =>
    ahora().getTime() - new Date(credencial.ultimo_uso).getTime() > DIAS_SIN_USO * 24 * 60 * 60 * 1000;

  return {
    /** Devuelve la credencial que guarda la app. */
    activar: async (clienteId, dispositivo) => {
      const secreto = nuevoSecreto();
      const credencial = await credenciales.crear({
        cliente_id: clienteId,
        token_hash: hash(secreto),
        dispositivo: dispositivoDe(dispositivo),
        ultimo_uso: ahora()
      });
      await credenciales.conservarRecientes(clienteId, MAX_POR_CLIENTE);
      return `${credencial.id}.${secreto}`;
    },

    /** Credencial → sesión nueva y credencial renovada. */
    ingresar: async (texto) => {
      const invalida = new ErrorNegocio(INVALIDA, 401);
      const leida = leerCredencial(texto);
      const credencial = leida ? await credenciales.buscar(leida.id) : null;
      const coincide =
        credencial && crypto.timingSafeEqual(Buffer.from(credencial.token_hash), Buffer.from(hash(leida.secreto)));
      if (!coincide) throw invalida;

      const cliente = await clientes.buscar(credencial.cliente_id);
      if (vencida(credencial) || !cliente || cliente.eliminado_en) {
        await credenciales.eliminar(credencial);
        throw invalida;
      }

      // Solo si nadie la usó a la vez: dos ingresos no reciben sesión con
      // el mismo secreto.
      const secreto = nuevoSecreto();
      const rotada = await credenciales.rotar(credencial.id, credencial.token_hash, {
        token_hash: hash(secreto),
        ultimo_uso: ahora()
      });
      if (!rotada) throw invalida;

      return {
        token: emitirToken(cliente, 'cliente'),
        user: { ...cliente.toJSON(), rol: 'cliente' },
        credencial: `${credencial.id}.${secreto}`
      };
    },

    /** Desactiva este dispositivo; solo borra credenciales del propio cliente. */
    desactivar: async (clienteId, texto) => {
      const leida = leerCredencial(texto);
      if (leida) await credenciales.eliminarDeCliente(leida.id, clienteId);
    }
  };
};
