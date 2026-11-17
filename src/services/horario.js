import { ErrorNegocio } from '../errors/ErrorNegocio.js';

/**
 * Horario de atención de una sucursal (RF-36, RN-22): {"lunes": [["07:00",
 * "16:00"]], ...}. Un día sin entrada está cerrado. `null` = sin horario
 * publicado: no se restringe por hora (solo por `activa`).
 */
export const DIAS = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'];

const HORA = /^([01]\d|2[0-3]):[0-5]\d$/;

/** Valida y normaliza el horario; lanza 400 con el motivo. */
export const validarHorario = (horario) => {
  if (horario === null || horario === undefined) return null;
  if (typeof horario !== 'object' || Array.isArray(horario)) {
    throw new ErrorNegocio('horario debe ser un objeto por día: {"lunes": [["07:00", "16:00"]]}');
  }
  const limpio = {};
  for (const [dia, tramos] of Object.entries(horario)) {
    if (!DIAS.includes(dia)) throw new ErrorNegocio(`Día de horario inválido: ${dia} (usa ${DIAS.join(', ')})`);
    if (!Array.isArray(tramos) || tramos.length > 4) {
      throw new ErrorNegocio(`El horario del ${dia} debe ser una lista de hasta 4 tramos [inicio, fin]`);
    }
    limpio[dia] = tramos.map((tramo) => {
      const [inicio, fin] = Array.isArray(tramo) ? tramo : [];
      if (!HORA.test(inicio ?? '') || !HORA.test(fin ?? '') || inicio >= fin) {
        throw new ErrorNegocio(`Tramo inválido el ${dia}: usa ["HH:MM", "HH:MM"] con inicio antes del fin`);
      }
      return [inicio, fin];
    });
  }
  return limpio;
};

/** Día de la semana de una fecha AAAA-MM-DD (sin depender de la zona del servidor). */
const diaDe = (fecha) => DIAS[new Date(`${fecha}T12:00:00Z`).getUTCDay()];

/** ¿Atiende en `ahora` ({fecha, hora} locales del restaurante)? */
export const abiertaEn = (horario, { fecha, hora }) => {
  if (!horario) return true;
  const hhmm = hora.slice(0, 5);
  return (horario[diaDe(fecha)] ?? []).some(([inicio, fin]) => hhmm >= inicio && hhmm < fin);
};
