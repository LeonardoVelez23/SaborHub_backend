import { beforeEach, describe, expect, it } from 'vitest';
import { Pago } from '../src/models/index.js';
import { api, auth, crearCliente, crearEmpleado, crearPedido, limpiarBase, login } from './helpers.js';

describe('Mis pagos (GET /pagos/mios)', () => {
  let ana, token;

  beforeEach(async () => {
    await limpiarBase();
    ana = await crearCliente();
    token = await login(ana);
  });

  const pagar = (pedido, datos) =>
    Pago.create({ pedido_id: pedido.id, valor: 5, metodo_pago: 'tarjeta', estado: 'aprobado', ...datos });

  it('lista solo los pagos del cliente, del más reciente al más antiguo', async () => {
    const viejo = await crearPedido(ana);
    const nuevo = await crearPedido(ana);
    const sinPago = await crearPedido(ana);
    const ajeno = await crearPedido(await crearCliente());
    await pagar(viejo, { fecha: new Date('2026-11-01T12:00:00Z'), metodo_pago: 'efectivo' });
    await pagar(nuevo, { fecha: new Date('2026-11-10T12:00:00Z'), numero_referencia: 'Payphone 1' });
    await pagar(ajeno, { fecha: new Date('2026-11-12T12:00:00Z') });

    const res = await api().get('/api/v1/pagos/mios').set(auth(token));

    expect(res.status).toBe(200);
    expect(res.body.data.map((p) => p.pedido.id)).toEqual([nuevo.id, viejo.id]);
    expect(res.body.data[0]).toMatchObject({
      valor: 5,
      metodo_pago: 'tarjeta',
      estado: 'aprobado',
      numero_referencia: 'Payphone 1',
      pedido: { id: nuevo.id, valor_total: 5 }
    });
    expect(res.body.data.some((p) => p.pedido.id === sinPago.id)).toBe(false);
  });

  it('sin pagos devuelve una lista vacía', async () => {
    const res = await api().get('/api/v1/pagos/mios').set(auth(token));
    expect(res.body.data).toEqual([]);
  });

  it('solo para clientes', async () => {
    const tokenCajero = await login(await crearEmpleado('cajero'));
    expect((await api().get('/api/v1/pagos/mios').set(auth(tokenCajero))).status).toBe(403);
    expect((await api().get('/api/v1/pagos/mios')).status).toBe(401);
  });
});
