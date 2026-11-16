import { describe, expect, it, vi } from 'vitest';
import { RETORNO, crearPagoTarjetaService } from '../../src/services/pagoTarjetaService.js';

/**
 * El servicio de pago con tarjeta funciona con cualquier pasarela que
 * cumpla el contrato PasarelaPago: aquí, una falsa y repositorios en memoria.
 */
const armar = ({ pedido = { id: 7, cliente_id: 1, estado: 'solicitado', valor_total: 6, pago: null }, confirmacion } = {}) => {
  const intentosGuardados = [];
  let pagoGuardado = null;
  const pasarela = {
    nombre: 'Falsa',
    configurada: () => true,
    preparar: vi.fn(async ({ referencia }) => ({ urlPago: `https://pasarela.test/${referencia}` })),
    confirmar: vi.fn(async ({ referencia }) => ({
      aprobada: true,
      referencia,
      centavos: 600,
      transaccionId: 555,
      autorizacion: 'A1',
      ...confirmacion
    }))
  };
  const actualizar = async (fila, datos) => Object.assign(fila, datos);
  const servicio = crearPagoTarjetaService({
    pasarela,
    pedidos: { buscarConPago: async () => pedido, bloquear: async () => pedido },
    pagos: {
      bloquearDelPedido: async () => pagoGuardado,
      crear: async (datos) => (pagoGuardado = datos),
      actualizar
    },
    intentos: {
      crear: async (datos) => {
        const intento = { id: intentosGuardados.length + 1, estado: 'iniciada', ...datos };
        intentosGuardados.push(intento);
        return intento;
      },
      porReferencia: async (ref) => intentosGuardados.find((i) => i.client_tx_id === ref) ?? null,
      bloquear: async (id) => intentosGuardados.find((i) => i.id === id),
      actualizar,
      eliminar: async () => {}
    },
    transacciones: { ejecutar: (trabajo) => trabajo('t') },
    urlIntermedia: (url) => `https://api.test/ir?u=${url}`,
    generarReferencia: (id) => `SP${id}-abc`,
    registro: { error: () => {} }
  });
  return { servicio, pasarela, pago: () => pagoGuardado, intentos: intentosGuardados };
};

describe('Pago con tarjeta con una pasarela cualquiera (RF-22)', () => {
  it('prepara el cobro en centavos y devuelve la página intermedia', async () => {
    const { servicio, pasarela } = armar();
    const res = await servicio.preparar(7, 1);
    expect(pasarela.preparar).toHaveBeenCalledWith(expect.objectContaining({ referencia: 'SP7-abc', centavos: 600 }));
    expect(res).toEqual({ url: 'https://api.test/ir?u=https://pasarela.test/SP7-abc', client_transaction_id: 'SP7-abc' });
  });

  it('no deja pagar el pedido de otro cliente ni uno cancelado', async () => {
    await expect(armar().servicio.preparar(7, 2)).rejects.toMatchObject({ status: 404 });
    const cancelado = armar({ pedido: { id: 7, cliente_id: 1, estado: 'cancelado', valor_total: 6 } });
    await expect(cancelado.servicio.preparar(7, 1)).rejects.toThrow('cancelado');
  });

  it('registra el pago aprobado solo si la pasarela lo confirma por el monto exacto', async () => {
    const { servicio, pago, intentos } = armar();
    await servicio.preparar(7, 1);
    expect(await servicio.procesarRetorno({ id: '99', referencia: 'SP7-abc' })).toEqual({
      resultado: RETORNO.APROBADO,
      pedidoId: 7
    });
    expect(pago()).toMatchObject({ estado: 'aprobado', metodo_pago: 'tarjeta', numero_referencia: 'Falsa 555' });
    expect(intentos[0].estado).toBe('aprobada');
  });

  it('no registra nada si el monto no coincide o el cliente canceló', async () => {
    const otroMonto = armar({ confirmacion: { centavos: 100 } });
    await otroMonto.servicio.preparar(7, 1);
    expect((await otroMonto.servicio.procesarRetorno({ id: '99', referencia: 'SP7-abc' })).resultado).toBe(RETORNO.NO_COINCIDE);
    expect(otroMonto.pago()).toBeNull();

    const cancelo = armar();
    await cancelo.servicio.preparar(7, 1);
    expect((await cancelo.servicio.procesarRetorno({ referencia: 'SP7-abc', cancelado: '1' })).resultado).toBe(RETORNO.CANCELADO);
    expect(cancelo.intentos[0].estado).toBe('cancelada');
  });

  it('rechaza al arrancar una pasarela que no cumple el contrato', () => {
    expect(() => crearPagoTarjetaService({ pasarela: { nombre: 'X' } })).toThrow('PasarelaPago');
  });
});
