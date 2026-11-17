import { beforeEach, describe, expect, it } from 'vitest';
import { CarritoItem } from '../src/models/index.js';
import { afiliar, api, auth, crearCliente, crearEmpleado, crearProducto, limpiarBase, login, PASSWORD } from './helpers.js';

describe('Carrito en el servidor (RF-13)', () => {
  let ana, token, arroz, jugo;

  beforeEach(async () => {
    await limpiarBase();
    ana = await crearCliente();
    await afiliar(ana);
    token = await login(ana);
    arroz = await crearProducto({ nombre: 'Arroz', precio: 3, cantidad_disponible: 10, imagen_codigo: 'arroz' });
    jugo = await crearProducto({ nombre: 'Jugo', precio: 1, cantidad_disponible: 5 });
  });

  const guardar = (items, t = token) =>
    api().put('/api/v1/carrito').set(auth(t)).send({ items });
  const leer = (t = token) => api().get('/api/v1/carrito').set(auth(t));

  it('empieza vacío', async () => {
    const res = await leer();
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ items: [] });
  });

  it('guarda el carrito y lo devuelve en el mismo orden con los datos del producto', async () => {
    const res = await guardar([
      { producto_id: jugo.id, cantidad: 2 },
      { producto_id: arroz.id, cantidad: 1 }
    ]);
    expect(res.status).toBe(200);

    const { items } = (await leer()).body.data;
    expect(items.map((i) => [i.producto_id, i.cantidad])).toEqual([[jugo.id, 2], [arroz.id, 1]]);
    expect(items[1].producto).toMatchObject({
      id: arroz.id,
      nombre: 'Arroz',
      precio: 3,
      cantidad_disponible: 10,
      estado: 'disponible',
      imagen_codigo: 'arroz'
    });
  });

  it('cada guardado reemplaza el carrito completo', async () => {
    await guardar([{ producto_id: arroz.id, cantidad: 1 }, { producto_id: jugo.id, cantidad: 1 }]);
    await guardar([{ producto_id: jugo.id, cantidad: 4 }]);

    const { items } = (await leer()).body.data;
    expect(items.map((i) => [i.producto_id, i.cantidad])).toEqual([[jugo.id, 4]]);

    await guardar([]);
    expect((await leer()).body.data.items).toEqual([]);
  });

  it('ignora productos que ya no existen', async () => {
    const res = await guardar([{ producto_id: 99999, cantidad: 1 }, { producto_id: arroz.id, cantidad: 2 }]);
    expect(res.status).toBe(200);
    expect(res.body.data.items.map((i) => i.producto_id)).toEqual([arroz.id]);
  });

  it.each([
    ['sin lista', undefined],
    ['cantidad 0', [{ producto_id: 1, cantidad: 0 }]],
    ['más de 50 unidades', [{ producto_id: 1, cantidad: 51 }]],
    ['cantidad decimal', [{ producto_id: 1, cantidad: 1.5 }]],
    ['producto repetido', [{ producto_id: 1, cantidad: 1 }, { producto_id: 1, cantidad: 2 }]],
    ['id inválido', [{ producto_id: '1', cantidad: 1 }]]
  ])('rechaza datos inválidos: %s', async (_, items) => {
    const res = await guardar(items);
    expect(res.status).toBe(400);
  });

  it('cada cliente ve solo su carrito', async () => {
    await guardar([{ producto_id: arroz.id, cantidad: 1 }]);
    const tokenLuis = await login(await crearCliente());

    expect((await leer(tokenLuis)).body.data.items).toEqual([]);
  });

  it('solo para clientes', async () => {
    const tokenAdmin = await login(await crearEmpleado('admin'));
    expect((await leer(tokenAdmin)).status).toBe(403);
    expect((await api().get('/api/v1/carrito')).status).toBe(401);
  });

  it('se vacía cuando el cliente hace su pedido', async () => {
    await guardar([{ producto_id: arroz.id, cantidad: 2 }]);

    const pedido = await api()
      .post('/api/v1/pedidos')
      .set(auth(token))
      .send({ modalidad: 'en línea', detalles: [{ producto_id: arroz.id, cantidad: 2 }] });

    expect(pedido.status).toBe(201);
    expect((await leer()).body.data.items).toEqual([]);
  });

  it('si el pedido falla, el carrito se conserva', async () => {
    await guardar([{ producto_id: jugo.id, cantidad: 2 }]);

    const pedido = await api()
      .post('/api/v1/pedidos')
      .set(auth(token))
      .send({ modalidad: 'en línea', detalles: [{ producto_id: jugo.id, cantidad: 6 }] });

    expect(pedido.status).toBe(400);
    expect((await leer()).body.data.items).toHaveLength(1);
  });

  it('un pedido del personal a nombre del cliente no vacía su carrito', async () => {
    await guardar([{ producto_id: arroz.id, cantidad: 1 }]);
    const tokenCajero = await login(await crearEmpleado('cajero'));

    const pedido = await api()
      .post('/api/v1/pedidos')
      .set(auth(tokenCajero))
      .send({ modalidad: 'presencial', cliente_id: ana.id, detalles: [{ producto_id: jugo.id, cantidad: 1 }] });

    expect(pedido.status).toBe(201);
    expect((await leer()).body.data.items).toHaveLength(1);
  });

  it('aparece en Mis datos y se borra al eliminar la cuenta', async () => {
    await guardar([{ producto_id: arroz.id, cantidad: 3 }]);

    const datos = await api().get('/api/v1/privacidad/mis-datos').set(auth(token));
    expect(datos.body.data.carrito).toMatchObject([{ producto: 'Arroz', cantidad: 3 }]);

    const res = await api()
      .delete('/api/v1/privacidad/mi-cuenta')
      .set(auth(token))
      .send({ contrasenia: PASSWORD });
    expect(res.status).toBe(200);
    expect(await CarritoItem.count({ where: { cliente_id: ana.id } })).toBe(0);
  });
});
