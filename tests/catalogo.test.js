import { beforeEach, describe, expect, it } from 'vitest';
import { api, auth, crearEmpleado, crearProducto, limpiarBase, login } from './helpers.js';

/** Unicidad y claves foráneas del catálogo contra PostgreSQL real (RN-17). */
describe('Catálogo en la base de datos', () => {
  let token, producto;

  beforeEach(async () => {
    await limpiarBase();
    token = await login(await crearEmpleado('admin'));
    producto = await crearProducto();
  });

  it('un código de producto repetido responde 400 con su motivo', async () => {
    const res = await api()
      .post('/api/v1/productos')
      .set(auth(token))
      .send({ codigo: producto.codigo, nombre: 'Otro', precio: 2, categoria_id: producto.categoria_id });
    expect(res.status).toBe(400);
    expect(res.body.message).toBe('Ya existe un producto con ese código');
  });

  it('un nombre de categoría repetido responde 400 con su motivo', async () => {
    const crear = () => api().post('/api/v1/categorias').set(auth(token)).send({ nombre: 'Sopas' });
    expect((await crear()).status).toBe(201);
    const res = await crear();
    expect(res.status).toBe(400);
    expect(res.body.message).toBe('Ya existe una categoría con ese nombre');
  });

  it('no se elimina una categoría que tiene productos', async () => {
    const res = await api().delete(`/api/v1/categorias/${producto.categoria_id}`).set(auth(token));
    expect(res.status).toBe(400);
  });
});
