import { beforeEach, describe, expect, it } from 'vitest';
import { CredencialBiometrica } from '../src/models/index.js';
import { api, auth, crearCliente, crearEmpleado, limpiarBase, login } from './helpers.js';

const activar = (token, dispositivo = 'Pixel 8') =>
  api().post('/api/v1/auth/biometrico/activar').set(auth(token)).send({ dispositivo });

const ingresar = (credencial) => api().post('/api/v1/auth/biometrico').send({ credencial });

describe('Ingreso con huella o rostro', () => {
  let ana, token;

  beforeEach(async () => {
    await limpiarBase();
    ana = await crearCliente();
    token = await login(ana);
  });

  it('activa, ingresa con la credencial y la renueva en cada ingreso', async () => {
    const activado = await activar(token);
    expect(activado.status).toBe(201);
    const credencial = activado.body.data.credencial;
    expect(credencial).toMatch(/^\d+\.[A-Za-z0-9_-]{43}$/);

    // Solo se guarda el hash, nunca el secreto.
    const guardada = await CredencialBiometrica.findOne({ where: { cliente_id: ana.id } });
    expect(guardada.token_hash).not.toContain(credencial.split('.')[1]);
    expect(guardada.dispositivo).toBe('Pixel 8');

    const res = await ingresar(credencial);
    expect(res.status).toBe(200);
    expect(res.body.token).toBeTruthy();
    expect(res.body.user).toMatchObject({ id: ana.id, rol: 'cliente' });
    expect(res.body.user).not.toHaveProperty('contrasenia');
    expect(res.body.credencial).not.toBe(credencial);

    // La credencial anterior ya no sirve; la nueva sí.
    expect((await ingresar(credencial)).status).toBe(401);
    expect((await ingresar(res.body.credencial)).status).toBe(200);
  });

  it('rechaza credenciales inválidas o con otro formato', async () => {
    for (const credencial of [undefined, '', 'abc', '1.corta', `999.${'a'.repeat(43)}`]) {
      expect((await ingresar(credencial)).status).toBe(401);
    }
  });

  it('cambiar la contraseña revoca el ingreso con huella', async () => {
    const { credencial } = (await activar(token)).body.data;

    await ana.update({ contrasenia: 'otro-hash' });

    expect((await ingresar(credencial)).status).toBe(401);
    expect(await CredencialBiometrica.count()).toBe(0);
  });

  it('eliminar la cuenta revoca el ingreso con huella', async () => {
    const { credencial } = (await activar(token)).body.data;

    const res = await api()
      .delete('/api/v1/privacidad/mi-cuenta')
      .set(auth(token))
      .send({ contrasenia: 'Clave#123' });

    expect(res.status).toBe(200);
    expect((await ingresar(credencial)).status).toBe(401);
  });

  it('vence tras 30 días sin usarse', async () => {
    const { credencial } = (await activar(token)).body.data;
    await CredencialBiometrica.update(
      { ultimo_uso: new Date(Date.now() - 31 * 24 * 60 * 60 * 1000) },
      { where: { cliente_id: ana.id } }
    );

    expect((await ingresar(credencial)).status).toBe(401);
    expect(await CredencialBiometrica.count()).toBe(0);
  });

  it('desactivar borra solo la credencial de ese dispositivo', async () => {
    const primera = (await activar(token, 'Pixel')).body.data.credencial;
    const segunda = (await activar(token, 'iPhone')).body.data.credencial;

    const res = await api().delete('/api/v1/auth/biometrico').set(auth(token)).send({ credencial: primera });

    expect(res.status).toBe(200);
    expect((await ingresar(primera)).status).toBe(401);
    expect((await ingresar(segunda)).status).toBe(200);
  });

  it('otro cliente no puede desactivar mi credencial', async () => {
    const { credencial } = (await activar(token)).body.data;
    const beto = await crearCliente();

    await api().delete('/api/v1/auth/biometrico').set(auth(await login(beto))).send({ credencial });

    expect((await ingresar(credencial)).status).toBe(200);
  });

  it('guarda como máximo 5 dispositivos por cliente', async () => {
    for (let i = 0; i < 7; i++) await activar(token, `Equipo ${i}`);

    expect(await CredencialBiometrica.count({ where: { cliente_id: ana.id } })).toBe(5);
  });

  it('solo para clientes y con sesión', async () => {
    const cajero = await crearEmpleado('cajero');

    expect((await activar(await login(cajero))).status).toBe(403);
    expect((await api().post('/api/v1/auth/biometrico/activar').send({})).status).toBe(401);
  });

  it('Mis datos lista los dispositivos sin la credencial', async () => {
    const { credencial } = (await activar(token)).body.data;

    const res = await api().get('/api/v1/privacidad/mis-datos').set(auth(token));

    expect(res.body.data.ingreso_biometrico).toEqual([
      expect.objectContaining({ dispositivo: 'Pixel 8' })
    ]);
    expect(JSON.stringify(res.body)).not.toContain(credencial.split('.')[1]);
  });
});
