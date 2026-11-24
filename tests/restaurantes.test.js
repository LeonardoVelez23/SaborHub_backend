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

  it('la ubicación de la sucursal: las dos coordenadas o ninguna, en rango y como número (app: la más cercana)', async () => {
    const crear = (token, datos) => api().post('/api/v1/sucursales').set(auth(token)).send(datos);
    const editar = (token, id, datos) => api().put(`/api/v1/sucursales/${id}`).set(auth(token)).send(datos);
    const base = { nombre: 'Norte', direccion: 'Av. Norte' };

    // Validaciones: juntas, número y rango.
    const juntas = 'latitud y longitud se envían juntas: las dos con valor o las dos en null';
    expect((await crear(adminX, { ...base, latitud: -0.21 })).body.message).toBe(juntas);
    expect((await crear(adminX, { ...base, latitud: -0.21, longitud: null })).body.message).toBe(juntas);
    expect((await crear(adminX, { ...base, latitud: '-0.21', longitud: -78.49 })).body.message).toBe(
      'latitud debe ser un número entre -90 y 90'
    );
    expect((await crear(adminX, { ...base, latitud: 91, longitud: 0 })).status).toBe(400);
    expect((await crear(adminX, { ...base, latitud: 0, longitud: -180.5 })).body.message).toBe(
      'longitud debe ser un número entre -180 y 180'
    );

    // Crea con coordenadas; se devuelven como número, no como texto.
    const norte = await crear(adminX, { ...base, latitud: -0.210123, longitud: -78.489456 });
    expect(norte.status).toBe(201);
    expect(norte.body.data).toMatchObject({ latitud: -0.210123, longitud: -78.489456 });

    // El admin de la sucursal no cambia la ubicación; el del restaurante y el superadmin sí.
    expect((await editar(adminA, A.id, { latitud: -0.2, longitud: -78.5 })).status).toBe(403);
    expect((await editar(adminX, A.id, { latitud: -0.2 })).status).toBe(400);
    expect((await editar(adminX, A.id, { latitud: -0.2, longitud: -78.5 })).body.data).toMatchObject({ latitud: -0.2, longitud: -78.5 });
    expect((await editar(superadmin, C.id, { latitud: 10, longitud: 20 })).status).toBe(200);
    // Editar otro campo no las toca; null las borra.
    expect((await editar(adminX, A.id, { telefono: '022' })).body.data.latitud).toBe(-0.2);
    expect((await editar(adminX, norte.body.data.id, { latitud: null, longitud: null })).body.data).toMatchObject({
      latitud: null,
      longitud: null
    });

    // Lista pública, detalle y gestión: números.
    const publica = await api().get('/api/v1/sucursales');
    expect(publica.body.data.find((s) => s.id === A.id)).toMatchObject({ latitud: -0.2, longitud: -78.5 });
    expect(publica.body.data.find((s) => s.id === norte.body.data.id)).toMatchObject({ latitud: null, longitud: null });
    expect((await api().get(`/api/v1/sucursales/${C.id}`)).body.data).toMatchObject({ latitud: 10, longitud: 20 });
    const gestion = await api().get('/api/v1/sucursales/gestion').set(auth(adminX));
    expect(typeof gestion.body.data.find((s) => s.id === A.id).latitud).toBe('number');
  });

  it('la base rechaza una sola coordenada o fuera de rango', async () => {
    await expect(A.update({ latitud: 1, longitud: null })).rejects.toThrow();
    await expect(A.update({ latitud: 95, longitud: 0 })).rejects.toThrow();
    await A.update({ latitud: 1.5, longitud: 2.5 });
    await A.reload();
    expect(A.latitud).toBe(1.5);
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
