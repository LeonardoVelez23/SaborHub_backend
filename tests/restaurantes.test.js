import { beforeEach, describe, expect, it } from 'vitest';
import { Pedido, Sucursal } from '../src/models/index.js';
import { api, auth, crearCliente, crearEmpleado, crearProducto, crearSucursal, limpiarBase, login } from './helpers.js';

/** Gestión de restaurantes y sucursales (RF-35 a RF-37, RN-22, RN-24). */
describe('Restaurantes y sucursales', () => {
  let A, C, superadmin, adminX, adminA;

  beforeEach(async () => {
    await limpiarBase();
    A = await crearSucursal();
    C = await crearSucursal({ nueva: true });
    superadmin = await login(await crearEmpleado('superadmin', { restaurante_id: null, sucursal_id: null }));
    adminX = await login(await crearEmpleado('admin_restaurante', { restaurante_id: A.restaurante_id, sucursal_id: null }));
    adminA = await login(await crearEmpleado('admin', { restaurante_id: A.restaurante_id, sucursal_id: A.id }));
  });

  it('solo el superadmin crea restaurantes y los suspende (RF-35, RN-24)', async () => {
    const nuevo = { nombre: ' Cafetería Norte ', ruc: '1790012345001', correo_electronico: 'Norte@Prueba.test' };
    expect((await api().post('/api/v1/restaurantes').set(auth(adminX)).send(nuevo)).status).toBe(403);
    const creado = await api().post('/api/v1/restaurantes').set(auth(superadmin)).send(nuevo);
    expect(creado.status).toBe(201);
    expect(creado.body.data).toMatchObject({ nombre: 'Cafetería Norte', correo_electronico: 'norte@prueba.test', estado: 'activo' });
    expect((await api().post('/api/v1/restaurantes').set(auth(superadmin)).send(nuevo)).body.message).toBe('Ya existe un restaurante con ese RUC');
    expect((await api().post('/api/v1/restaurantes').set(auth(superadmin)).send({ nombre: 'X', ruc: '123' })).status).toBe(400);

    // El admin del restaurante edita sus datos, no el estado ni otros restaurantes.
    const editar = (token, id, datos) => api().put(`/api/v1/restaurantes/${id}`).set(auth(token)).send(datos);
    expect((await editar(adminX, A.restaurante_id, { telefono: '0999999999' })).status).toBe(200);
    expect((await editar(adminX, A.restaurante_id, { estado: 'suspendido' })).status).toBe(403);
    expect((await editar(adminX, C.restaurante_id, { telefono: '1' })).status).toBe(404);
    expect((await editar(adminA, A.restaurante_id, { telefono: '1' })).status).toBe(403);
    expect((await editar(superadmin, C.restaurante_id, { estado: 'suspendido' })).body.data.estado).toBe('suspendido');

    const lista = (token) => api().get('/api/v1/restaurantes').set(auth(token));
    expect((await lista(superadmin)).body.data).toHaveLength(3);
    expect((await lista(adminX)).body.data.map((r) => r.id)).toEqual([A.restaurante_id]);
  });

  it('el admin de restaurante crea y edita sucursales del suyo; el de sucursal solo teléfono y horario (RF-36)', async () => {
    const crear = (token, datos) => api().post('/api/v1/sucursales').set(auth(token)).send(datos);
    const norte = await crear(adminX, { nombre: 'Norte', direccion: 'Av. Norte', restaurante_id: C.restaurante_id });
    expect(norte.status).toBe(201);
    expect(norte.body.data.restaurante_id).toBe(A.restaurante_id); // el suyo, no el enviado
    expect((await crear(adminX, { nombre: 'Norte', direccion: 'Otra' })).body.message).toBe(
      'Ya existe una sucursal con ese nombre en el restaurante'
    );
    expect((await crear(adminA, { nombre: 'Sur', direccion: 'Av. Sur' })).status).toBe(403);
    expect((await crear(superadmin, { nombre: 'Sur', direccion: 'Av. Sur' })).status).toBe(400); // falta restaurante_id
    expect((await crear(superadmin, { nombre: 'Sur', direccion: 'Av. Sur', restaurante_id: C.restaurante_id })).status).toBe(201);

    const editar = (token, id, datos) => api().put(`/api/v1/sucursales/${id}`).set(auth(token)).send(datos);
    const horario = { lunes: [['07:00', '16:00']] };
    expect((await editar(adminA, A.id, { horario })).body.data.horario).toEqual(horario);
    expect((await editar(adminA, A.id, { activa: false })).status).toBe(403);
    expect((await editar(adminA, norte.body.data.id, { telefono: '1' })).status).toBe(404);
    expect((await editar(adminX, C.id, { activa: false })).status).toBe(404);
    expect((await editar(adminX, A.id, { horario: { lunes: [['9', '8']] } })).status).toBe(400);
    expect((await editar(adminX, norte.body.data.id, { activa: false })).body.data.activa).toBe(false);

    const gestion = await api().get('/api/v1/sucursales/gestion').set(auth(adminX));
    expect(gestion.body.data.map((s) => s.nombre).sort()).toEqual([A.nombre, 'Norte'].sort());
  });

  it('la lista pública muestra solo sucursales activas de restaurantes activos, sin datos de pago (RF-37)', async () => {
    await A.update({ payphone_store_id: 'tienda-secreta' });
    await Sucursal.create({ restaurante_id: A.restaurante_id, nombre: 'Cerrada', direccion: 'X', activa: false });
    await api().put(`/api/v1/restaurantes/${C.restaurante_id}`).set(auth(superadmin)).send({ estado: 'suspendido' });

    const res = await api().get('/api/v1/sucursales');
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0]).toMatchObject({ id: A.id, abierta: true, restaurante: { id: A.restaurante_id } });
    expect(res.body.data[0]).not.toHaveProperty('payphone_store_id');
    expect((await api().get(`/api/v1/sucursales/${A.id}`)).body.data.abierta).toBe(true);
    expect((await api().get(`/api/v1/sucursales/${C.id}`)).status).toBe(404);
  });

  it('fuera de horario la sucursal no recibe pedidos (RN-22)', async () => {
    // Un horario que nunca abre: ningún día tiene tramos.
    await A.update({ horario: {} });
    const producto = await crearProducto({ sucursal_id: A.id });
    const token = await login(await crearCliente());
    const res = await api()
      .post('/api/v1/pedidos')
      .set(auth(token))
      .send({ modalidad: 'en línea', detalles: [{ producto_id: producto.id, cantidad: 1 }] });
    expect(res.status).toBe(400);
    expect(res.body.message).toBe('La sucursal está fuera de su horario de atención');
    expect(await Pedido.count()).toBe(0);
    expect((await api().get(`/api/v1/sucursales/${A.id}`)).body.data.abierta).toBe(false);
  });
});
