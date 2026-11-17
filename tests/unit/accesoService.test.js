import { describe, expect, it, vi } from 'vitest';
import { crearOtpService, OTP_MAX_ATTEMPTS } from '../../src/services/otpService.js';
import { crearAuthService } from '../../src/services/authService.js';
import { crearBiometricoService } from '../../src/services/biometricoService.js';
import { crearCarritoService } from '../../src/services/carritoService.js';
import { crearSesionService } from '../../src/services/sesionService.js';

const cuentasEnMemoria = () => ({
  actualizar: async (c, datos) => Object.assign(c, datos),
  sumarIntentoOtp: async (c) => {
    c.reset_password_attempts += 1;
  }
});

describe('Código de verificación (RN-15)', () => {
  it('guarda solo el HMAC, vence a los 15 minutos y se bloquea tras 5 intentos', async () => {
    let reloj = 0;
    const otps = crearOtpService({ cuentas: cuentasEnMemoria(), secreto: 's', ahora: () => reloj });
    const cuenta = {};
    const codigo = await otps.emitir(cuenta);
    expect(cuenta.reset_password_token).not.toContain(codigo);
    expect(await otps.verificar(cuenta, codigo)).toBe(true);

    reloj = 15 * 60 * 1000;
    expect(await otps.verificar(cuenta, codigo)).toBe(false); // vencido

    reloj = 0;
    for (let i = 0; i < OTP_MAX_ATTEMPTS; i++) await otps.verificar(cuenta, '000000');
    expect(await otps.verificar(cuenta, codigo)).toBe(false); // bloqueado aunque sea correcto
  });
});

describe('Inicio de sesión y recuperación (RF-02, RF-05)', () => {
  const ana = { contrasenia: 'hash:Clave#1', correo_electronico: 'ana@x.com', nombres: 'Ana', apellidos: 'Paz', toJSON: () => ({ id: 1, contrasenia: 'hash:Clave#1' }) };
  const armar = (correo = { enviarCodigo: vi.fn() }) =>
    crearAuthService({
      cuentas: {
        paraIngresar: async (t) => (t === 'ana@x.com' ? { cuenta: ana, esCliente: true } : null),
        porCorreo: async (c) => (c === 'ana@x.com' ? ana : null)
      },
      otps: { emitir: async () => '123456' },
      contrasenias: { comparar: async (t, h) => h === `hash:${t}` },
      emitirToken: (_c, rol) => `token-${rol}`,
      rolDeCargo: () => 'empleado',
      correo,
      registro: { error: () => {} }
    });

  it('misma respuesta para cuenta inexistente y contraseña incorrecta (CA-03)', async () => {
    const auth = armar();
    const fallos = await Promise.all([
      auth.ingresar({ email: 'nadie@x.com', password: 'Clave#1' }).catch((e) => [e.status, e.message]),
      auth.ingresar({ email: 'ana@x.com', password: 'otra' }).catch((e) => [e.status, e.message])
    ]);
    expect(fallos[0]).toEqual([401, 'Credenciales inválidas']);
    expect(fallos[1]).toEqual(fallos[0]);
    const ok = await auth.ingresar({ email: 'ana@x.com', password: 'Clave#1' });
    expect(ok).toEqual({ token: 'token-cliente', user: { id: 1, rol: 'cliente' } });
  });

  it('pedir el código no revela si el correo existe, aunque falle el envío (RNF-06)', async () => {
    const correo = { enviarCodigo: vi.fn().mockRejectedValue(new Error('SMTP caído')) };
    const auth = armar(correo);
    const existe = await auth.solicitarCodigo({ email: ' ANA@x.com ' });
    expect(await auth.solicitarCodigo({ email: 'nadie@x.com' })).toBe(existe);
    expect(correo.enviarCodigo).toHaveBeenCalledWith('ana@x.com', '123456', 'Ana Paz');
  });
});

describe('Sesión vigente', () => {
  it('rol y sucursal salen de la base; una cuenta eliminada pierde la sesión', async () => {
    const sesion = crearSesionService({
      cuentas: {
        clienteDeSesion: async (id) => ({ 1: { eliminado_en: null }, 2: { eliminado_en: new Date() } })[id] ?? null,
        empleadoDeSesion: async (id) => (id === 7 ? { cargo: 'Cajero', restaurante_id: 4, sucursal_id: 9 } : null)
      },
      rolDeCargo: (c) => c.toLowerCase()
    });
    expect(await sesion.vigente({ id: 1, rol: 'cliente' })).toEqual({ rol: 'cliente', nivel: null, restaurante_id: null, sucursal_id: null });
    expect(await sesion.vigente({ id: 2, rol: 'cliente' })).toBeNull();
    // Rol y alcance de la base, no del token.
    expect(await sesion.vigente({ id: 7, rol: 'admin' })).toEqual({ rol: 'cajero', nivel: 'sucursal', restaurante_id: 4, sucursal_id: 9 });
    expect(await sesion.vigente({ id: 8, rol: 'admin' })).toBeNull();
  });
});

describe('Ingreso con huella (RF-02a)', () => {
  const armar = () => {
    let ahora = new Date('2026-11-01T00:00:00Z');
    const filas = [];
    const credenciales = {
      crear: async (d) => (filas.push({ id: filas.length + 1, ...d }), filas.at(-1)),
      conservarRecientes: async () => {},
      buscar: async (id) => filas.find((f) => f.id === id) ?? null,
      rotar: async (id, anterior, datos) => {
        const f = filas.find((x) => x.id === id && x.token_hash === anterior);
        return Boolean(f && Object.assign(f, datos));
      },
      eliminar: async (f) => filas.splice(filas.indexOf(f), 1)
    };
    const servicio = crearBiometricoService({
      credenciales,
      clientes: { buscar: async () => ({ id: 1, toJSON: () => ({ id: 1 }) }) },
      emitirToken: () => 'jwt',
      ahora: () => ahora
    });
    return { servicio, filas, avanzar: (dias) => (ahora = new Date(ahora.getTime() + dias * 86400000)) };
  };

  it('cada ingreso renueva la credencial y la anterior deja de servir', async () => {
    const { servicio } = armar();
    const primera = await servicio.activar(1, 'Pixel');
    const { credencial: segunda, token } = await servicio.ingresar(primera);
    expect(token).toBe('jwt');
    expect(segunda).not.toBe(primera);
    await expect(servicio.ingresar(primera)).rejects.toMatchObject({ status: 401 });
  });

  it('vence tras 30 días sin uso y se borra', async () => {
    const { servicio, filas, avanzar } = armar();
    const credencial = await servicio.activar(1);
    avanzar(31);
    await expect(servicio.ingresar(credencial)).rejects.toMatchObject({ status: 401 });
    expect(filas).toHaveLength(0);
  });
});

describe('Carrito (RF-13)', () => {
  it('valida las cantidades y descarta productos que ya no existen', async () => {
    const insertados = [];
    const carrito = crearCarritoService({
      carritos: {
        productosExistentes: async () => new Map([[1, 1], [3, 1]]),
        vaciar: async () => {},
        insertar: async (filas) => insertados.push(...filas),
        items: async () => []
      },
      transacciones: { ejecutar: (trabajo) => trabajo('t') }
    });
    await expect(carrito.reemplazar(1, [{ producto_id: 1, cantidad: 51 }])).rejects.toThrow('entre 1 y 50');
    await expect(carrito.reemplazar(1, [{ producto_id: 1, cantidad: 1 }, { producto_id: 1, cantidad: 2 }])).rejects.toThrow('más de una vez');
    await carrito.reemplazar(1, [{ producto_id: 3, cantidad: 2 }, { producto_id: 2, cantidad: 1 }, { producto_id: 1, cantidad: 5 }]);
    expect(insertados).toEqual([
      { cliente_id: 1, producto_id: 3, cantidad: 2, posicion: 0 },
      { cliente_id: 1, producto_id: 1, cantidad: 5, posicion: 1 }
    ]);
  });
});

describe('Cargos y alcance (DERCAS 12, RN-21)', () => {
  it('superadmin y admin de restaurante son admin con más alcance; sin sucursal no se ve nada', async () => {
    const { rolDeCargo, nivelDeCargo } = await import('../../src/utils/roles.js');
    const { alcanceDe } = await import('../../src/services/alcance.js');
    expect(rolDeCargo('superadmin')).toBe('admin');
    expect(rolDeCargo('admin_restaurante')).toBe('admin');
    expect(nivelDeCargo('superadmin')).toBe('plataforma');
    expect(nivelDeCargo('admin_restaurante')).toBe('restaurante');
    expect(nivelDeCargo('Administrador')).toBe('sucursal');
    expect(alcanceDe({ nivel: 'sucursal', sucursal_id: 3 })).toEqual({ nivel: 'sucursal', sucursalId: 3 });
    expect(alcanceDe({ nivel: 'restaurante', restaurante_id: 2 })).toEqual({ nivel: 'restaurante', restauranteId: 2 });
    expect(alcanceDe({ nivel: 'plataforma' })).toEqual({ nivel: 'plataforma' });
    // Un cajero sin sucursal no ve más: no ve nada.
    expect(alcanceDe({ nivel: 'sucursal', sucursal_id: null })).toEqual({ nivel: 'ninguno' });
  });

  it('el filtro de los repositorios exige un alcance', async () => {
    const { filtroSucursal } = await import('../../src/repositories/alcance.js');
    expect(() => filtroSucursal(undefined)).toThrow('sin alcance');
    expect(filtroSucursal({ nivel: 'sucursal', sucursalId: 4 })).toEqual({ sucursal_id: 4 });
    expect(() => filtroSucursal({ nivel: 'sucursal', sucursalId: '1 OR 1=1' })).toThrow('inválido');
  });
});
