import { beforeEach, describe, expect, it } from 'vitest';
import { Categoria, Empleado, Pedido } from '../src/models/index.js';
import { afiliar, api, auth, crearCliente, crearEmpleado, crearProducto, crearSucursal, limpiarBase, login } from './helpers.js';

/** Restaurantes y sucursales (DERCAS 12, etapa 2). */
describe('Sucursales', () => {
  let admin, token, sucursal, otra;

  beforeEach(async () => {
    await limpiarBase();
    sucursal = await crearSucursal();
    otra = await crearSucursal({ nueva: true });
    admin = await crearEmpleado('admin');
    token = await login(admin);
  });

  const crearCategoria = (nombre, datos = {}) =>
    api().post('/api/v1/categorias').set(auth(token)).send({ nombre, ...datos });

  it('el catálogo se crea en la sucursal de quien lo crea, aunque envíe otra (RN-21)', async () => {
    const cat = await crearCategoria('Sopas', { sucursal_id: otra.id });
    expect(cat.status).toBe(201);
    expect(cat.body.data.sucursal_id).toBe(sucursal.id);

    const prod = await api()
      .post('/api/v1/productos')
      .set(auth(token))
      .send({ codigo: 'S1', nombre: 'Locro', precio: 3, categoria_id: cat.body.data.id, sucursal_id: otra.id });
    expect(prod.status).toBe(201);
    expect(prod.body.data.sucursal_id).toBe(sucursal.id);
  });

  it('nombre de categoría y código de producto son únicos por sucursal', async () => {
    await Categoria.create({ nombre: 'Sopas', sucursal_id: otra.id });
    await crearProducto({ codigo: 'S1', sucursal_id: otra.id });
    // Otra sucursal ya los usa: aquí sí se pueden usar.
    const cat = await crearCategoria('Sopas');
    expect(cat.status).toBe(201);
    const nuevo = { codigo: 'S1', nombre: 'Locro', precio: 3, categoria_id: cat.body.data.id };
    expect((await api().post('/api/v1/productos').set(auth(token)).send(nuevo)).status).toBe(201);
    // En la misma sucursal, no.
    expect((await crearCategoria('Sopas')).body.message).toBe('Ya existe una categoría con ese nombre');
    const repetido = await api().post('/api/v1/productos').set(auth(token)).send(nuevo);
    expect(repetido.body.message).toBe('Ya existe un producto con ese código');
  });

  it('un producto no usa una categoría de otra sucursal', async () => {
    const ajena = await Categoria.create({ nombre: 'Ajena', sucursal_id: otra.id });
    const res = await api()
      .post('/api/v1/productos')
      .set(auth(token))
      .send({ codigo: 'X1', nombre: 'X', precio: 1, categoria_id: ajena.id });
    expect(res.status).toBe(400);
    expect(res.body.message).toBe('La categoría indicada no existe');
  });

  it('un pedido es de la sucursal de sus productos y no mezcla sucursales (RN-20, CA-34)', async () => {
    const cliente = await crearCliente();
    await afiliar(cliente, { sucursal: otra });
    const tokenCliente = await login(cliente);
    const aqui = await crearProducto({ sucursal_id: sucursal.id });
    const alla = await crearProducto({ sucursal_id: otra.id });
    const pedir = (detalles) =>
      api().post('/api/v1/pedidos').set(auth(tokenCliente)).send({ modalidad: 'en línea', detalles });

    const mezcla = await pedir([{ producto_id: aqui.id, cantidad: 1 }, { producto_id: alla.id, cantidad: 1 }]);
    expect(mezcla.status).toBe(400);
    expect(mezcla.body.message).toBe('Todos los productos del pedido deben ser de la misma sucursal');
    expect(await Pedido.count()).toBe(0);
    await alla.reload();
    expect(alla.cantidad_disponible).toBe(20); // no se descontó stock

    const ok = await pedir([{ producto_id: alla.id, cantidad: 2 }]);
    expect(ok.status).toBe(201);
    expect((await Pedido.findByPk(ok.body.data.id)).sucursal_id).toBe(otra.id);
  });

  it('un empleado nuevo queda en el restaurante y la sucursal del admin que lo crea', async () => {
    const res = await api().post('/api/v1/empleados').set(auth(token)).send({
      identificacion: '0911111111',
      nombres: 'Luis',
      apellidos: 'Mora',
      correo_electronico: 'luis@prueba.test',
      cargo: 'cajero',
      contrasenia: 'Clave#123'
    });
    expect(res.status).toBe(201);
    const luis = await Empleado.findByPk(res.body.data.id);
    expect(luis.restaurante_id).toBe(sucursal.restaurante_id);
    expect(luis.sucursal_id).toBe(sucursal.id);
  });

  it('un empleado sin sucursal no crea productos ni categorías', async () => {
    const sinSucursal = await crearEmpleado('cajero', { sucursal_id: null });
    const res = await api().post('/api/v1/categorias').set(auth(await login(sinSucursal))).send({ nombre: 'X' });
    expect(res.status).toBe(403);
  });
});
