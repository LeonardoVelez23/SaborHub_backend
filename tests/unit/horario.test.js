import { describe, expect, it } from 'vitest';
import { abiertaEn, validarHorario } from '../../src/services/horario.js';

describe('Horario de la sucursal (RF-36, RN-22)', () => {
  // 2026-11-16 es lunes; 2026-11-15, domingo.
  const horario = { lunes: [['07:00', '10:00'], ['12:00', '16:00']], sabado: [['08:00', '12:00']] };

  it('abierta solo dentro de un tramo del día (fin excluido); sin horario, siempre', () => {
    expect(abiertaEn(horario, { fecha: '2026-11-16', hora: '07:00:00' })).toBe(true);
    expect(abiertaEn(horario, { fecha: '2026-11-16', hora: '11:00:00' })).toBe(false);
    expect(abiertaEn(horario, { fecha: '2026-11-16', hora: '15:59:59' })).toBe(true);
    expect(abiertaEn(horario, { fecha: '2026-11-16', hora: '16:00:00' })).toBe(false);
    expect(abiertaEn(horario, { fecha: '2026-11-15', hora: '09:00:00' })).toBe(false); // domingo sin entrada
    expect(abiertaEn(null, { fecha: '2026-11-15', hora: '03:00:00' })).toBe(true);
  });

  it('valida días y tramos', () => {
    expect(validarHorario(horario)).toEqual(horario);
    expect(validarHorario(null)).toBeNull();
    expect(() => validarHorario({ Lunes: [] })).toThrow('Día de horario inválido');
    expect(() => validarHorario({ lunes: [['10:00', '09:00']] })).toThrow('Tramo inválido');
    expect(() => validarHorario({ lunes: [['7:00', '09:00']] })).toThrow('Tramo inválido');
    expect(() => validarHorario({ lunes: [['24:00', '25:00']] })).toThrow('Tramo inválido');
    expect(() => validarHorario([])).toThrow('objeto por día');
  });
});
