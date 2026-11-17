import { beforeEach, describe, expect, it } from 'vitest';
import { Pago, Restaurante, Sucursal } from '../src/models/index.js';
import { api, auth, crearCliente, crearEmpleado, crearPedido, crearProducto, crearSucursal, limpiarBase, login } from './helpers.js';

/**
 * Aislamiento entre restaurantes y sucursales (DERCAS 12, RN-21, CA-32 y
 * CA-33). Restaurante X con sucursales A y B; restaurante Y con sucursal C.
 */
describe('Aislamiento por restaurante y sucursal', () => {
  let A, B, C, cliente, pedidoA, pedidoB, pedidoC;

  const empleadoDe = (cargo, sucursal) =>
    crearEmpleado(cargo, { restaurante_id: sucursal.restaurante_id, sucursal_id: sucursal.id });

  beforeEach(async () => {
    await limpiarBase();
    A = await crearSucursal();
    B = await Sucursal.create({ restaurante_id: A.restaurante_id, nombre: 'B', direccion: 'Calle B' });
    C = await crearSucursal({ nueva: true });
    cliente = await crearCliente();
    pedidoA = await crearPedido(cliente, { sucursal: A });
    pedidoB = await crearPedido(cliente, { sucursal: B });
    pedidoC = await crearPedido(cliente, { sucursal: C });
  });

  const ids = (res) => res.body.data.map((x) => x.id).sort();

  it('un cajero de A no ve pedidos ni pagos de B (CA-32)', async () => {
    const token = await login(await empleadoDe('cajero', A));
    expect(ids(await api().get('/api/v1/pedidos').set(auth(token)))).toEqual([pedidoA.id]);
    expect((await api().get(`/api/v1/pedidos/${pedidoB.id}`).set(auth(token))).status).toBe(404);
    expect((await api().put(`/api/v1/pedidos/${pedidoB.id}`).set(auth(token)).send({ estado: 'cancelado' })).status).toBe(404);

    const pagoB = await Pago.create({ pedido_id: pedidoB.id, fecha: new Date(), valor: 5, metodo_pago: 'efectivo' });
    expect(ids(await api().get('/api/v1/pagos').set(auth(token)))).toEqual([]);
    expect((await api().get(`/api/v1/pagos/${pagoB.id}`).set(auth(token))).status).toBe(404);
    expect((await api().get(`/api/v1/pagos/pedido/${pedidoB.id}`).set(auth(token))).status).toBe(404);
    expect((await api().put(`/api/v1/pagos/${pagoB.id}`).set(auth(token)).send({ estado: 'aprobado' })).status).toBe(404);
  });

  it('un cajero de A no modifica productos de B y las estadísticas son solo de A', async () => {
    const token = await login(await empleadoDe('cajero', A));
    const productoB = await crearProducto({ sucursal_id: B.id });
    expect((await api().put(`/api/v1/productos/${productoB.id}`).set(auth(token)).send({ precio: 1 })).status).toBe(404);
    const stats = await api().get('/api/v1/pedidos/stats').set(auth(token));
    expect(stats.body.data.totalOrders).toBe(1);
    expect(stats.body.data.totalClients).toBe(1);
  });

  it('el admin del restaurante X ve sus dos sucursales y nada de Y (CA-33)', async () => {
    const adminX = await crearEmpleado('admin_restaurante', { restaurante_id: A.restaurante_id, sucursal_id: null });
    const token = await login(adminX);
    expect(ids(await api().get('/api/v1/pedidos').set(auth(token)))).toEqual([pedidoA.id, pedidoB.id].sort());
    expect((await api().get(`/api/v1/pedidos/${pedidoC.id}`).set(auth(token))).status).toBe(404);

    const cajeroC = await empleadoDe('cajero', C);
    const empleados = ids(await api().get('/api/v1/empleados').set(auth(token)));
    expect(empleados).toContain(adminX.id);
    expect(empleados).not.toContain(cajeroC.id);
    expect((await api().get(`/api/v1/empleados/${cajeroC.id}`).set(auth(token))).status).toBe(404);
    expect((await api().delete(`/api/v1/empleados/${cajeroC.id}`).set(auth(token))).status).toBe(404);

    const productoC = await crearProducto({ sucursal_id: C.id });
    expect((await api().delete(`/api/v1/productos/${productoC.id}`).set(auth(token))).status).toBe(404);
  });

  it('el admin de restaurante crea personal en una de sus sucursales, no en otra ni con más alcance (RN-24)', async () => {
    const token = await login(await crearEmpleado('admin_restaurante', { restaurante_id: A.restaurante_id, sucursal_id: null }));
    const nuevo = (datos) =>
      api().post('/api/v1/empleados').set(auth(token)).send({
        identificacion: `09${Math.floor(Math.random() * 1e8)}`.padEnd(10, '0'),
        nombres: 'N',
        apellidos: 'N',
        correo_electronico: `n${Math.random()}@prueba.test`,
        contrasenia: 'Clave#123',
        ...datos
      });
    const enB = await nuevo({ cargo: 'cocinero', sucursal_id: B.id });
    expect(enB.status).toBe(201);
    expect(enB.body.data.sucursal_id).toBe(B.id);
    expect((await nuevo({ cargo: 'cocinero', sucursal_id: C.id })).status).toBe(400);
    expect((await nuevo({ cargo: 'superadmin' })).status).toBe(403);
  });

  it('un admin de sucursal no se da más alcance ni crea administradores de restaurante', async () => {
    const admin = await empleadoDe('admin', A);
    const token = await login(admin);
    const sube = await api().put(`/api/v1/empleados/${admin.id}`).set(auth(token)).send({ cargo: 'admin_restaurante' });
    expect(sube.status).toBe(403);
  });

  it('el superadmin ve toda la plataforma', async () => {
    const token = await login(await crearEmpleado('superadmin', { restaurante_id: null, sucursal_id: null }));
    expect(ids(await api().get('/api/v1/pedidos').set(auth(token)))).toEqual([pedidoA.id, pedidoB.id, pedidoC.id].sort());
  });

  it('una sucursal inactiva o un restaurante suspendido no reciben pedidos (RN-22)', async () => {
    const tokenCliente = await login(cliente);
    const producto = await crearProducto({ sucursal_id: B.id });
    const pedir = () =>
      api().post('/api/v1/pedidos').set(auth(tokenCliente)).send({ modalidad: 'en línea', detalles: [{ producto_id: producto.id, cantidad: 1 }] });

    await B.update({ activa: false });
    const cerrada = await pedir();
    expect(cerrada.status).toBe(400);
    expect(cerrada.body.message).toBe('Esta sucursal no está recibiendo pedidos por ahora');
    await producto.reload();
    expect(producto.cantidad_disponible).toBe(20); // la transacción se deshizo

    await B.update({ activa: true });
    await Restaurante.update({ estado: 'suspendido' }, { where: { id: B.restaurante_id } });
    expect((await pedir()).status).toBe(400);
    await Restaurante.update({ estado: 'activo' }, { where: { id: B.restaurante_id } });
    expect((await pedir()).status).toBe(201);
  });

  it('el menú público se filtra por sucursal con ?sucursal_id', async () => {
    const res = await api().get(`/api/v1/productos?sucursal_id=${C.id}`);
    expect(res.status).toBe(200);
    expect(res.body.data.every((p) => p.sucursal_id === C.id)).toBe(true);
    expect(res.body.data).toHaveLength(1);
    expect((await api().get('/api/v1/productos?sucursal_id=abc')).status).toBe(400);
  });
});
