import crypto from 'node:crypto';
import { Op } from 'sequelize';
import { Cliente, CredencialBiometrica } from '../models/index.js';
import { emitirToken } from '../utils/sesion.js';

/**
 * Ingreso con huella o rostro (app móvil, solo clientes).
 *
 * La app no guarda la contraseña: al activarlo recibe una credencial del
 * dispositivo (`<id>.<secreto>`) que guarda cifrada y solo envía después de
 * verificar la huella con el sistema operativo. Aquí se guarda el SHA-256
 * del secreto. Cada ingreso entrega un secreto nuevo (el anterior deja de
 * servir) y la credencial vence tras 30 días sin usarse.
 */

const DIAS_SIN_USO = 30;
const MAX_POR_CLIENTE = 5;
const INVALIDA = 'El ingreso con huella ya no es válido. Inicia sesión con tu contraseña.';

const hash = (secreto) => crypto.createHash('sha256').update(secreto).digest('hex');
const nuevoSecreto = () => crypto.randomBytes(32).toString('base64url');
const vencida = (credencial) =>
  Date.now() - new Date(credencial.ultimo_uso).getTime() > DIAS_SIN_USO * 24 * 60 * 60 * 1000;

/** `<id>.<secreto>` → { id, secreto } o null si no tiene ese formato. */
const leerCredencial = (texto) => {
  if (typeof texto !== 'string') return null;
  const match = /^(\d{1,10})\.([A-Za-z0-9_-]{43})$/.exec(texto);
  return match ? { id: Number(match[1]), secreto: match[2] } : null;
};

const dispositivoDe = (valor) =>
  typeof valor === 'string' && valor.trim() ? valor.trim().slice(0, 100) : null;

/** POST /auth/biometrico/activar (cliente con sesión). */
export const activarBiometrico = async (req, res, next) => {
  try {
    const secreto = nuevoSecreto();
    const credencial = await CredencialBiometrica.create({
      cliente_id: req.user.id,
      token_hash: hash(secreto),
      dispositivo: dispositivoDe(req.body?.dispositivo),
      ultimo_uso: new Date()
    });

    // Solo los dispositivos más recientes.
    const sobrantes = await CredencialBiometrica.findAll({
      where: { cliente_id: req.user.id },
      order: [['ultimo_uso', 'DESC'], ['id', 'DESC']],
      offset: MAX_POR_CLIENTE,
      attributes: ['id']
    });
    if (sobrantes.length > 0) {
      await CredencialBiometrica.destroy({ where: { id: sobrantes.map((c) => c.id) } });
    }

    res.status(201).json({
      success: true,
      message: 'Ingreso con huella activado',
      data: { credencial: `${credencial.id}.${secreto}` }
    });
  } catch (error) {
    next(error);
  }
};

/** POST /auth/biometrico (público): credencial → sesión nueva. */
export const loginBiometrico = async (req, res, next) => {
  try {
    const leida = leerCredencial(req.body?.credencial);
    const credencial = leida ? await CredencialBiometrica.findByPk(leida.id) : null;
    const coincide =
      credencial &&
      crypto.timingSafeEqual(Buffer.from(credencial.token_hash), Buffer.from(hash(leida.secreto)));

    if (!coincide) {
      return res.status(401).json({ success: false, message: INVALIDA });
    }
    const cliente = await Cliente.findByPk(credencial.cliente_id);
    if (vencida(credencial) || !cliente || cliente.eliminado_en) {
      await credencial.destroy();
      return res.status(401).json({ success: false, message: INVALIDA });
    }

    const secreto = nuevoSecreto();
    // Solo si nadie la usó a la vez (evita que dos ingresos reciban sesión
    // con el mismo secreto).
    const [actualizadas] = await CredencialBiometrica.update(
      { token_hash: hash(secreto), ultimo_uso: new Date() },
      { where: { id: credencial.id, token_hash: { [Op.eq]: credencial.token_hash } } }
    );
    if (actualizadas !== 1) {
      return res.status(401).json({ success: false, message: INVALIDA });
    }

    res.status(200).json({
      success: true,
      message: 'Inicio de sesión exitoso',
      token: emitirToken(cliente, 'cliente'),
      user: { ...cliente.toJSON(), rol: 'cliente' },
      credencial: `${credencial.id}.${secreto}`
    });
  } catch (error) {
    next(error);
  }
};

/** DELETE /auth/biometrico (cliente con sesión): desactiva este dispositivo. */
export const desactivarBiometrico = async (req, res, next) => {
  try {
    const leida = leerCredencial(req.body?.credencial);
    if (leida) {
      await CredencialBiometrica.destroy({ where: { id: leida.id, cliente_id: req.user.id } });
    }
    res.status(200).json({ success: true, message: 'Ingreso con huella desactivado' });
  } catch (error) {
    next(error);
  }
};
