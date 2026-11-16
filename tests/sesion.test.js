import jwt from 'jsonwebtoken';
import { beforeEach, describe, expect, it } from 'vitest';
import { PASSWORD, api, crearCliente, crearEmpleado, limpiarBase } from './helpers.js';

const duracion = (token) => {
  const { iat, exp } = jwt.decode(token);
  return exp - iat;
};

const login = (correo) =>
  api().post('/api/v1/auth/login').send({ email: correo, password: PASSWORD });

describe('Duración de la sesión', () => {
  beforeEach(limpiarBase);

  it('la sesión del cliente dura 20 minutos desde el login', async () => {
    const cliente = await crearCliente();

    const res = await login(cliente.correo_electronico);

    expect(res.status).toBe(200);
    expect(duracion(res.body.token)).toBe(20 * 60);
  });

  it('la sesión del personal dura 8 horas (turno)', async () => {
    const cajero = await crearEmpleado('cajero');

    const res = await login(cajero.correo_electronico);

    expect(res.status).toBe(200);
    expect(duracion(res.body.token)).toBe(8 * 60 * 60);
  });
});
