import { describe, expect, it } from 'vitest';
import { ErrorNegocio } from '../../src/errors/ErrorNegocio.js';
import {
  agruparDetalles,
  calcularLineas,
  esFechaValida,
  estadoPagoAlCancelar,
  validarTransicion
} from '../../src/services/reglasPedido.js';

const producto = (datos) => ({ nombre: 'Almuerzo', estado: 'disponible', precio: 2.5, cantidad_disponible: 10, ...datos });

describe('Reglas de pedido (sin base de datos)', () => {
  it('suma las líneas del mismo producto y limita a 50 unidades (RN-06)', () => {
    expect(agruparDetalles([{ producto_id: 1, cantidad: 2 }, { producto_id: 1, cantidad: 3 }])).toEqual(new Map([[1, 5]]));
    expect(() => agruparDetalles([{ producto_id: 1, cantidad: 30 }, { producto_id: 1, cantidad: 21 }])).toThrow(
      'Cantidad máxima por producto: 50'
    );
    expect(() => agruparDetalles([])).toThrow(ErrorNegocio);
    expect(() => agruparDetalles([{ producto_id: 1, cantidad: 1.5 }])).toThrow('cantidad entera');
  });

  it('calcula subtotales y total con el precio vigente (CA-11)', () => {
    const productos = new Map([[1, producto({ precio: 2.5 })], [2, producto({ precio: 1 })]]);
    const { lineas, total } = calcularLineas(new Map([[1, 2], [2, 1]]), productos);
    expect(total).toBe(6);
    expect(lineas[0]).toEqual({ producto_id: 1, cantidad: 2, precio_unitario: 2.5, subtotal: 5 });
  });

  it('rechaza stock insuficiente, producto no disponible o inexistente (CA-12)', () => {
    const productos = new Map([[1, producto({ cantidad_disponible: 3 })], [2, producto({ estado: 'no disponible' })]]);
    expect(() => calcularLineas(new Map([[1, 4]]), productos)).toThrow('Stock insuficiente');
    expect(() => calcularLineas(new Map([[2, 1]]), productos)).toThrow('no está disponible');
    expect(() => calcularLineas(new Map([[9, 1]]), productos)).toThrow('no existe');
  });

  it('solo acepta las transiciones del diagrama y el cocinero no cancela (RN-01, RN-03)', () => {
    expect(() => validarTransicion('solicitado', 'en preparación', 'cajero')).not.toThrow();
    expect(() => validarTransicion('entregado', 'cancelado', 'admin')).toThrow('estado final');
    expect(() => validarTransicion('listo', 'cancelado', 'cocinero')).toThrow(
      expect.objectContaining({ status: 403 })
    );
  });

  it('al cancelar, el pago pendiente se rechaza y el aprobado se reembolsa (RN-04)', () => {
    expect(estadoPagoAlCancelar('pendiente')).toBe('rechazado');
    expect(estadoPagoAlCancelar('aprobado')).toBe('reembolsado');
    expect(estadoPagoAlCancelar('rechazado')).toBeNull();
  });

  it('valida fechas AAAA-MM-DD reales (CA-25)', () => {
    expect(esFechaValida('2026-02-28')).toBe(true);
    expect(esFechaValida(undefined)).toBe(true);
    expect(esFechaValida('2026-02-30')).toBe(false);
    expect(esFechaValida('28/02/2026')).toBe(false);
  });
});
