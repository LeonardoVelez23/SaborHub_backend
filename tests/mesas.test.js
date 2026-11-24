import bcrypt from 'bcryptjs';
import { beforeEach, describe, expect, it } from 'vitest';
import { Cliente, Mesa, Pago, Pedido } from '../src/models/index.js';
import {
  api,
  auth,
  afiliar,
  crearCliente,
  crearEmpleado,
  crearProducto,
  crearSucursal,
  limpiarBase,
  login,
  PASSWORD
} from './helpers.js';

/**
 * Personal en la app (DERCAS M9): mesas, consumidor final y entrega del
 * mesero (RF-55 a RF-59, RN-38 a RN-40, CA-56 a CA-59 y CA-61).
 */

const CF = { identificacion: '9999999999999', correo: 'consumidor.final@saborhub.invalid' };

/** limpiarBase vacía Clientes: se vuelve a crear como lo hace la migración. */
const crearConsumidorFinal = async () =>
  Cliente.create({
    identificacion: CF.identificacion,
    nombres: 'Consumidor',
    apellidos: 'Final',
    correo_electronico: CF.correo,
    contrasenia: await bcrypt.hash('nadie-la-conoce', 4),
    es_consumidor_final: true
  });

const pedirEnMesa = (token, producto, extra = {}) =>
  api()
    .post('/api/v1/pedidos')
    .set(auth(token))
    .send({ modalidad: 'presencial', detalles: [{ producto_id: producto.id, cantidad: 2 }], ...extra });

describe('Personal en la app (M9)', () => {
  let sucursal, consumidorFinal, mesero, tokenMesero, tokenCajero, tokenAdmin, tokenCocinero, producto, mesa4;

  beforeEach(async () => {
    await limpiarBase();
    sucursal = await crearSucursal();
    consumidorFinal = await crearConsumidorFinal();
    mesero = await crearEmpleado('mesero');
    const [cajero, admin, cocinero] = await Promise.all([
      crearEmpleado('cajero'),
      crearEmpleado('admin'),
      crearEmpleado('cocinero')
    ]);
    [tokenMesero, tokenCajero, tokenAdmin, tokenCocinero] = await Promise.all([
      login(mesero),
      login(cajero),
      login(admin),
      login(cocinero)
    ]);
    producto = await crearProducto({ sucursal_id: sucursal.id });
    mesa4 = await Mesa.create({ sucursal_id: sucursal.id, nombre: 'Mesa 4' });
  });

  describe('mesas (RF-55)', () => {
    it('caja crea y renombra; el nombre es único en la sucursal (409)', async () => {
      const creada = await api().post('/api/v1/mesas').set(auth(tokenCajero)).send({ nombre: ' Terraza 1 ' });
      expect(creada.status).toBe(201);
      expect(creada.body.data).toMatchObject({ nombre: 'Terraza 1', sucursal_id: sucursal.id, activa: true });

      const repetida = await api().post('/api/v1/mesas').set(auth(tokenCajero)).send({ nombre: 'Mesa 4' });
      expect(repetida.status).toBe(409);

      const renombrada = await api()
        .put(`/api/v1/mesas/${creada.body.data.id}`)
        .set(auth(tokenCajero))
        .send({ nombre: 'Terraza A', activa: false });
      expect(renombrada.status).toBe(200);
      expect(renombrada.body.data).toMatchObject({ nombre: 'Terraza A', activa: false });
    });

    it('el mesero lista pero no crea mesas', async () => {
      const lista = await api().get('/api/v1/mesas').set(auth(tokenMesero));
      expect(lista.status).toBe(200);
      expect(lista.body.data.map((m) => m.nombre)).toEqual(['Mesa 4']);

      const crear = await api().post('/api/v1/mesas').set(auth(tokenMesero)).send({ nombre: 'Mesa 5' });
      expect(crear.status).toBe(403);
    });

    it('ordena por nombre natural y oculta las inactivas salvo que se pidan', async () => {
      await Mesa.bulkCreate([
        { sucursal_id: sucursal.id, nombre: 'Mesa 10' },
        { sucursal_id: sucursal.id, nombre: 'Mesa 2' },
        { sucursal_id: sucursal.id, nombre: 'Mesa 9', activa: false }
      ]);
      const activas = await api().get('/api/v1/mesas').set(auth(tokenMesero));
      expect(activas.body.data.map((m) => m.nombre)).toEqual(['Mesa 2', 'Mesa 4', 'Mesa 10']);

      const todas = await api().get('/api/v1/mesas?incluir_inactivas=true').set(auth(tokenCajero));
      expect(todas.body.data).toHaveLength(4);
    });

    it('no ve ni cambia mesas de otra sucursal (RN-21)', async () => {
      const otra = await crearSucursal({ nueva: true });
      const ajena = await Mesa.create({ sucursal_id: otra.id, nombre: 'Mesa 1' });

      const lista = await api().get(`/api/v1/mesas?sucursal_id=${otra.id}`).set(auth(tokenCajero));
      expect(lista.body.data.map((m) => m.id)).not.toContain(ajena.id);

      const cambio = await api().put(`/api/v1/mesas/${ajena.id}`).set(auth(tokenCajero)).send({ activa: false });
      expect(cambio.status).toBe(404);
    });

    it('solo el admin elimina, y no una mesa con pedidos (409)', async () => {
      expect((await api().delete(`/api/v1/mesas/${mesa4.id}`).set(auth(tokenCajero))).status).toBe(403);

      await pedirEnMesa(tokenMesero, producto, { mesa_id: mesa4.id });
      const conPedidos = await api().delete(`/api/v1/mesas/${mesa4.id}`).set(auth(tokenAdmin));
      expect(conPedidos.status).toBe(409);
      expect(conPedidos.body.message).toBe('La mesa tiene pedidos: desactívala');

      const libre = await Mesa.create({ sucursal_id: sucursal.id, nombre: 'Mesa 7' });
      expect((await api().delete(`/api/v1/mesas/${libre.id}`).set(auth(tokenAdmin))).status).toBe(200);
    });
  });

  describe('pedido de mesa (RF-56)', () => {
    it('CA-56: sin cliente queda del consumidor final, con la mesa y el mesero como responsable', async () => {
      const res = await pedirEnMesa(tokenMesero, producto, { mesa_id: mesa4.id });

      expect(res.status).toBe(201);
      expect(res.body.data).toMatchObject({
        modalidad: 'presencial',
        mesa_id: mesa4.id,
        empleado_id: mesero.id,
        cliente_id: consumidorFinal.id,
        mesa: { id: mesa4.id, nombre: 'Mesa 4' }
      });
      expect(res.body.data.cliente.es_consumidor_final).toBe(true);
    });

    it('con un cliente registrado y afiliado queda a su nombre', async () => {
      const ana = await crearCliente();
      await afiliar(ana, { sucursal });
      const res = await pedirEnMesa(tokenMesero, producto, { mesa_id: mesa4.id, cliente_id: ana.id });
      expect(res.status).toBe(201);
      expect(res.body.data.cliente_id).toBe(ana.id);
    });

    it('un pedido en línea del personal sigue exigiendo cliente_id', async () => {
      const res = await api()
        .post('/api/v1/pedidos')
        .set(auth(tokenCajero))
        .send({ modalidad: 'en línea', detalles: [{ producto_id: producto.id, cantidad: 1 }] });
      expect(res.status).toBe(400);
    });

    it('CA-57: mesa inactiva o de otra sucursal → 400 y no se crea', async () => {
      const inactiva = await Mesa.create({ sucursal_id: sucursal.id, nombre: 'Mesa 8', activa: false });
      const otra = await crearSucursal({ nueva: true });
      const ajena = await Mesa.create({ sucursal_id: otra.id, nombre: 'Mesa 1' });

      expect((await pedirEnMesa(tokenMesero, producto, { mesa_id: inactiva.id })).status).toBe(400);
      expect((await pedirEnMesa(tokenMesero, producto, { mesa_id: ajena.id })).status).toBe(400);
      expect(await Pedido.count()).toBe(0);
    });

    it('CA-57: mesa en un pedido en línea → 400', async () => {
      const res = await api()
        .post('/api/v1/pedidos')
        .set(auth(tokenCajero))
        .send({ modalidad: 'en línea', mesa_id: mesa4.id, detalles: [{ producto_id: producto.id, cantidad: 1 }] });
      expect(res.status).toBe(400);
      expect(res.body.message).toBe('Solo los pedidos presenciales del personal llevan mesa');
    });

    it('CA-57: un cliente que envía mesa_id → 400', async () => {
      const ana = await crearCliente();
      await afiliar(ana, { sucursal });
      const res = await pedirEnMesa(await login(ana), producto, { mesa_id: mesa4.id });
      expect(res.status).toBe(400);
      expect(res.body.message).toBe('Solo los pedidos presenciales del personal llevan mesa');
    });
  });

  describe('entrega del mesero (RF-57, RN-40)', () => {
    const cambiar = (token, id, cuerpo) => api().put(`/api/v1/pedidos/${id}`).set(auth(token)).send(cuerpo);

    it('CA-58: entrega un pedido listo, pero no lo prepara, cancela ni cobra', async () => {
      const { body } = await pedirEnMesa(tokenMesero, producto, { mesa_id: mesa4.id });
      const id = body.data.id;

      expect((await cambiar(tokenMesero, id, { estado: 'en preparación' })).status).toBe(403);
      expect((await cambiar(tokenCocinero, id, { estado: 'en preparación' })).status).toBe(200);
      expect((await cambiar(tokenMesero, id, { estado: 'cancelado' })).status).toBe(403);
      expect((await cambiar(tokenCocinero, id, { estado: 'listo' })).status).toBe(200);
      expect((await cambiar(tokenMesero, id, { estado: 'entregado', empleado_id: null })).status).toBe(403);

      const entregado = await cambiar(tokenMesero, id, { estado: 'entregado' });
      expect(entregado.status).toBe(200);
      expect(entregado.body.data.estado).toBe('entregado');

      const cobro = await api()
        .post('/api/v1/pagos')
        .set(auth(tokenMesero))
        .send({ pedido_id: id, fecha: '2026-11-24T12:00:00Z', valor: 5, metodo_pago: 'efectivo' });
      expect(cobro.status).toBe(403);
    });

    it('un pedido con mesa no pasa a "en línea"', async () => {
      const { body } = await pedirEnMesa(tokenMesero, producto, { mesa_id: mesa4.id });
      const res = await cambiar(tokenCajero, body.data.id, { modalidad: 'en línea' });
      expect(res.status).toBe(400);
    });
  });

  describe('consumidor final (RN-38)', () => {
    it('CA-59: no inicia sesión ni con identificación ni con correo', async () => {
      for (const email of [CF.identificacion, CF.correo]) {
        const res = await api().post('/api/v1/auth/login').send({ email, password: PASSWORD });
        expect(res.status).toBe(401);
        expect(res.body.message).toBe('Credenciales inválidas');
      }
    });

    it('CA-59: no aparece en los clientes ni en la búsqueda exacta', async () => {
      const lista = await api().get('/api/v1/clientes').set(auth(tokenCajero));
      expect(lista.body.data.map((c) => c.id)).not.toContain(consumidorFinal.id);

      const busqueda = await api()
        .get(`/api/v1/clientes/buscar?q=${CF.identificacion}`)
        .set(auth(tokenMesero));
      expect(busqueda.body.data ?? null).toBeNull();
    });

    it('CA-59: no cuenta como cliente en las estadísticas', async () => {
      await pedirEnMesa(tokenMesero, producto, { mesa_id: mesa4.id });
      const stats = await api().get('/api/v1/pedidos/stats').set(auth(tokenCajero));
      expect(stats.body.data.totalOrders).toBe(1);
      expect(stats.body.data.totalClients).toBe(0);
    });
  });

  it('CA-61: la mesa con un pedido entregado sin pagar sigue ocupada hasta el pago', async () => {
    const { body } = await pedirEnMesa(tokenMesero, producto, { mesa_id: mesa4.id });
    const pedido = await Pedido.findByPk(body.data.id);
    await pedido.update({ estado: 'entregado' });

    const ocupada = await api().get('/api/v1/mesas').set(auth(tokenMesero));
    expect(ocupada.body.data[0]).toMatchObject({ ocupada: true, pedidos_abiertos: 1, total_pendiente: 5 });

    await Pago.create({
      pedido_id: pedido.id,
      fecha: new Date(),
      valor: 5,
      metodo_pago: 'efectivo',
      estado: 'aprobado'
    });
    const libre = await api().get('/api/v1/mesas').set(auth(tokenMesero));
    expect(libre.body.data[0]).toMatchObject({ ocupada: false, pedidos_abiertos: 0, total_pendiente: 0 });
  });
});
