import { beforeEach, describe, expect, it } from 'vitest';
import { ClienteRestaurante, Pedido } from '../src/models/index.js';
import { VERSION_LEGAL } from '../src/legal/documentos.js';
import {
  afiliar,
  api,
  auth,
  crearCliente,
  crearEmpleado,
  crearProducto,
  crearSucursal,
  limpiarBase,
  login
} from './helpers.js';

/**
 * Clientes por restaurante (DERCAS 12, etapa 8): una cuenta de la
 * plataforma y una afiliación por restaurante (RF-43 a RF-45, RN-26 a
 * RN-28, CA-39 a CA-42). Restaurante X (sucursal SX) y restaurante Y (SY).
 */
describe('Clientes por restaurante (afiliación)', () => {
  let SX, SY, ana, tokenAna;

  const empleadoDe = (cargo, sucursal) =>
    crearEmpleado(cargo, { restaurante_id: sucursal.restaurante_id, sucursal_id: sucursal.id });

  const pedir = (token, sucursal, extra = {}) =>
    crearProducto({ sucursal_id: sucursal.id }).then((producto) =>
      api()
        .post('/api/v1/pedidos')
        .set(auth(token))
        .send({ modalidad: 'en línea', detalles: [{ producto_id: producto.id, cantidad: 1 }], ...extra })
    );

  const afiliarme = (token, restauranteId, extra = {}) =>
    api()
      .post('/api/v1/afiliaciones')
      .set(auth(token))
      .send({ restaurante_id: restauranteId, acepta_compartir: true, version_legal: VERSION_LEGAL, ...extra });

  beforeEach(async () => {
    await limpiarBase();
    SX = await crearSucursal();
    SY = await crearSucursal({ nueva: true });
    ana = await crearCliente();
    tokenAna = await login(ana);
  });

  describe('pedido del cliente (RN-27)', () => {
    it('sin afiliación responde 409; tras aceptar, el pedido se crea (CA-40)', async () => {
      const sin = await pedir(tokenAna, SX);
      expect(sin.status).toBe(409);
      expect(sin.body.codigo).toBe('afiliacion_requerida');
      expect(sin.body.data).toMatchObject({ restaurante_id: SX.restaurante_id });
      expect(await Pedido.count()).toBe(0);

      const acepta = await afiliarme(tokenAna, SX.restaurante_id);
      expect(acepta.status).toBe(201);
      expect(acepta.body.data).toMatchObject({ estado: 'activo', origen: 'app', legal_version: VERSION_LEGAL });

      expect((await pedir(tokenAna, SX)).status).toBe(201);
    });

    it('afiliarse exige aceptar y la versión legal vigente', async () => {
      expect((await afiliarme(tokenAna, SX.restaurante_id, { acepta_compartir: false })).status).toBe(400);
      expect((await afiliarme(tokenAna, SX.restaurante_id, { version_legal: 'vieja' })).status).toBe(400);
      expect((await afiliarme(tokenAna, 99999)).status).toBe(404);
      expect(await ClienteRestaurante.count()).toBe(0);
    });

    it('bloqueado en X no pide en X, pero sí en Y, y su cuenta sigue intacta (CA-41)', async () => {
      await afiliar(ana, { sucursal: SX, estado: 'bloqueado' });
      await afiliar(ana, { sucursal: SY });

      const enX = await pedir(tokenAna, SX);
      expect(enX.status).toBe(403);
      expect(enX.body.message).toBe('Tu cuenta está bloqueada en este restaurante');
      expect((await afiliarme(tokenAna, SX.restaurante_id)).status).toBe(403);

      expect((await pedir(tokenAna, SY)).status).toBe(201);
      expect((await api().get(`/api/v1/clientes/${ana.id}`).set(auth(tokenAna))).status).toBe(200);
    });
  });

  describe('Mis restaurantes (RF-45)', () => {
    it('lista sus afiliaciones y retira el consentimiento sin perder pedidos', async () => {
      await afiliar(ana, { sucursal: SX });
      expect((await pedir(tokenAna, SX)).status).toBe(201);

      const mias = await api().get('/api/v1/afiliaciones').set(auth(tokenAna));
      expect(mias.status).toBe(200);
      expect(mias.body.data).toHaveLength(1);
      expect(mias.body.data[0]).toMatchObject({ restaurante_id: SX.restaurante_id, estado: 'activo' });
      expect(mias.body.data[0].restaurante.nombre).toBeTruthy();

      const retira = await api().delete(`/api/v1/afiliaciones/${SX.restaurante_id}`).set(auth(tokenAna));
      expect(retira.status).toBe(200);
      expect((await pedir(tokenAna, SX)).status).toBe(409);
      expect(await Pedido.count({ where: { cliente_id: ana.id } })).toBe(1);

      // Volver a aceptar la reactiva.
      expect((await afiliarme(tokenAna, SX.restaurante_id)).status).toBe(201);
      expect((await pedir(tokenAna, SX)).status).toBe(201);
    });

    it('retirar no levanta un bloqueo', async () => {
      await afiliar(ana, { sucursal: SX, estado: 'bloqueado' });
      expect((await api().delete(`/api/v1/afiliaciones/${SX.restaurante_id}`).set(auth(tokenAna))).status).toBe(409);
      expect((await ClienteRestaurante.findOne({ where: { cliente_id: ana.id } })).estado).toBe('bloqueado');
    });

    it('solo para clientes', async () => {
      const token = await login(await empleadoDe('cajero', SX));
      expect((await api().get('/api/v1/afiliaciones').set(auth(token))).status).toBe(403);
    });
  });

  describe('personal (RN-26)', () => {
    it('X no ve en su lista a un cliente que solo pidió en Y; por búsqueda exacta recibe solo id y nombre (CA-39)', async () => {
      const beto = await crearCliente();
      await afiliar(ana, { sucursal: SX });
      await afiliar(beto, { sucursal: SY });
      const token = await login(await empleadoDe('cajero', SX));

      const lista = await api().get('/api/v1/clientes').set(auth(token));
      expect(lista.status).toBe(200);
      expect(lista.body.data.map((c) => c.id)).toEqual([ana.id]);
      expect(lista.body.data[0].afiliacion).toMatchObject({ estado: 'activo' });

      const encontrado = await api()
        .get('/api/v1/clientes/buscar')
        .query({ q: beto.identificacion })
        .set(auth(token));
      expect(encontrado.status).toBe(200);
      expect(encontrado.body.data).toEqual({ id: beto.id, nombres: beto.nombres, apellidos: beto.apellidos, afiliacion: null });

      const porCorreo = await api()
        .get('/api/v1/clientes/buscar')
        .query({ q: beto.correo_electronico.toUpperCase() })
        .set(auth(token));
      expect(porCorreo.body.data.id).toBe(beto.id);

      const parcial = await api().get('/api/v1/clientes/buscar').query({ q: 'Cliente' }).set(auth(token));
      expect(parcial.status).toBe(404);

      expect((await api().get(`/api/v1/clientes/${beto.id}`).set(auth(await login(await empleadoDe('admin', SX))))).status).toBe(404);
    });

    it('el superadmin ve a todos los clientes', async () => {
      const beto = await crearCliente();
      const token = await login(await crearEmpleado('superadmin', { restaurante_id: null, sucursal_id: null }));
      const lista = await api().get('/api/v1/clientes').set(auth(token));
      expect(lista.body.data.map((c) => c.id).sort()).toEqual([ana.id, beto.id].sort());
    });

    it('pedido asistido: sin afiliación 409; con consentimiento presencial se afilia y se crea', async () => {
      const token = await login(await empleadoDe('cajero', SX));
      const sin = await pedir(token, SX, { modalidad: 'presencial', cliente_id: ana.id });
      expect(sin.status).toBe(409);
      expect(sin.body.codigo).toBe('afiliacion_requerida');

      const con = await pedir(token, SX, { modalidad: 'presencial', cliente_id: ana.id, consentimiento_presencial: true });
      expect(con.status).toBe(201);
      const fila = await ClienteRestaurante.findOne({ where: { cliente_id: ana.id, restaurante_id: SX.restaurante_id } });
      expect(fila).toMatchObject({ estado: 'activo', origen: 'presencial' });
    });

    it('el personal registra un cliente con consentimiento presencial y queda afiliado a su restaurante', async () => {
      const token = await login(await empleadoDe('mesero', SX));
      const res = await api().post('/api/v1/clientes').set(auth(token)).send({
        identificacion: '1799999999',
        nombres: 'Carla',
        apellidos: 'Mesa',
        correo_electronico: 'carla@prueba.test',
        tipo_cliente: 'Docente',
        contrasenia: 'Clave#123',
        consentimiento_presencial: true
      });
      expect(res.status).toBe(201);
      expect(await ClienteRestaurante.findOne({ where: { cliente_id: res.body.data.id } })).toMatchObject({
        restaurante_id: SX.restaurante_id,
        origen: 'presencial'
      });
    });
  });

  describe('bloqueo (RF-44, RN-28)', () => {
    it('el admin de X bloquea con motivo y desbloquea; no toca clientes de Y', async () => {
      await afiliar(ana, { sucursal: SX });
      const beto = await crearCliente();
      await afiliar(beto, { sucursal: SY });
      const admin = await empleadoDe('admin', SX);
      const token = await login(admin);
      const bloqueo = (id, datos) => api().put(`/api/v1/clientes/${id}/bloqueo`).set(auth(token)).send(datos);

      expect((await bloqueo(ana.id, { bloqueado: true })).status).toBe(400); // sin motivo
      const bloqueado = await bloqueo(ana.id, { bloqueado: true, motivo: 'Pedidos sin retirar' });
      expect(bloqueado.status).toBe(200);
      expect(bloqueado.body.data).toMatchObject({ estado: 'bloqueado', motivo_bloqueo: 'Pedidos sin retirar', bloqueado_por: admin.id });
      expect((await pedir(tokenAna, SX)).status).toBe(403);

      expect((await bloqueo(ana.id, { bloqueado: false })).body.data).toMatchObject({ estado: 'activo', motivo_bloqueo: null });
      expect((await pedir(tokenAna, SX)).status).toBe(201);

      expect((await bloqueo(beto.id, { bloqueado: true, motivo: 'x' })).status).toBe(404);
    });

    it('un cajero no bloquea', async () => {
      await afiliar(ana, { sucursal: SX });
      const token = await login(await empleadoDe('cajero', SX));
      const res = await api().put(`/api/v1/clientes/${ana.id}/bloqueo`).set(auth(token)).send({ bloqueado: true, motivo: 'x' });
      expect(res.status).toBe(403);
    });

    it('el admin de X no edita ni elimina la cuenta de un cliente, aunque sea suyo (CA-42)', async () => {
      await afiliar(ana, { sucursal: SX });
      const token = await login(await crearEmpleado('admin_restaurante', { restaurante_id: SX.restaurante_id, sucursal_id: null }));
      expect((await api().put(`/api/v1/clientes/${ana.id}`).set(auth(token)).send({ nombres: 'Otra' })).status).toBe(403);
      expect((await api().delete(`/api/v1/clientes/${ana.id}`).set(auth(token))).status).toBe(403);
    });
  });

  describe('privacidad', () => {
    it('Mis datos incluye los restaurantes y eliminar la cuenta borra las afiliaciones', async () => {
      await afiliar(ana, { sucursal: SX });
      const datos = await api().get('/api/v1/privacidad/mis-datos').set(auth(tokenAna));
      expect(datos.status).toBe(200);
      expect(datos.body.data.restaurantes).toHaveLength(1);
      expect(datos.body.data.restaurantes[0]).toMatchObject({ estado: 'activo', origen: 'app' });

      const elimina = await api().delete('/api/v1/privacidad/mi-cuenta').set(auth(tokenAna)).send({ contrasenia: 'Clave#123' });
      expect(elimina.status).toBe(200);
      expect(await ClienteRestaurante.count({ where: { cliente_id: ana.id } })).toBe(0);
    });
  });
});
