import { describe, expect, it, vi } from 'vitest';
import { crearClienteService } from '../../src/services/clienteService.js';
import { crearEmpleadoService } from '../../src/services/empleadoService.js';
import { crearPrivacidadService } from '../../src/services/privacidadService.js';
import { tipoDeImagen } from '../../src/services/perfilService.js';

/** Hash y OTP falsos: el OTP válido es 123456. */
const contrasenias = {
  hash: async (t) => `hash:${t}`,
  comparar: async (t, h) => h === `hash:${t}`,
  inutilizable: async () => 'hash:imposible'
};
const otps = () => ({ verificar: vi.fn(async (_cuenta, otp) => otp === '123456'), limpio: { reset_password_token: null } });

const repo = (filas) => ({
  buscar: async (id) => filas.find((f) => f.id === Number(id)) ?? null,
  bloquear: async (id) => filas.find((f) => f.id === Number(id)) ?? null,
  crear: async (datos) => ({ id: 99, ...datos }),
  actualizar: async (fila, datos) => Object.assign(fila, datos)
});

const CLAVE = 'Nueva#2026';

describe('Cuentas de clientes y empleados (RF-01, RF-06, RF-07)', () => {
  it('el registro exige aceptar la versión vigente; el personal no acepta por el cliente', async () => {
    const svc = crearClienteService({ clientes: repo([]), otps: otps(), contrasenias, versionLegal: 'v2', ahora: () => new Date(0) });
    const datos = { identificacion: '1', nombres: 'Ana', apellidos: 'Paz', correo_electronico: ' ANA@X.COM ', contrasenia: CLAVE };
    await expect(svc.crear(null, datos)).rejects.toThrow('Debes aceptar');
    await expect(svc.crear(null, { ...datos, acepta_terminos: true, version_legal: 'v1' })).rejects.toThrow('se actualizaron');
    const ana = await svc.crear(null, { ...datos, acepta_terminos: true, version_legal: 'v2' });
    expect(ana).toMatchObject({ correo_electronico: 'ana@x.com', legal_version: 'v2' });
    expect(ana).not.toHaveProperty('contrasenia');
    expect(await svc.crear({ id: 1, rol: 'mesero' }, datos)).not.toHaveProperty('legal_version');
  });

  it('cambiar la propia contraseña pide el OTP, revisando antes la política', async () => {
    const o = otps();
    const ana = { id: 1, nombres: 'Ana' };
    const svc = crearClienteService({ clientes: repo([ana]), otps: o, contrasenias, versionLegal: 'v2' });
    const yo = { id: 1, rol: 'cliente' };
    await expect(svc.actualizar(1, yo, { contrasenia: 'debil', otp: '000000' })).rejects.toThrow('8 caracteres');
    expect(o.verificar).not.toHaveBeenCalled(); // no gasta un intento
    await expect(svc.actualizar(1, yo, { contrasenia: CLAVE })).rejects.toThrow('Se requiere el código OTP');
    await expect(svc.actualizar(1, yo, { contrasenia: CLAVE, otp: '000000' })).rejects.toThrow('incorrecto');
    await svc.actualizar(1, yo, { contrasenia: CLAVE, otp: '123456' });
    expect(ana.contrasenia).toBe(`hash:${CLAVE}`);
    await expect(svc.actualizar(1, { id: 2, rol: 'cliente' }, { nombres: 'X' })).rejects.toMatchObject({ status: 403 });
  });

  it('un empleado no cambia su cargo; el admin cambia la contraseña de otro sin OTP', async () => {
    const luis = { id: 5, cargo: 'mesero', turno_trabajo: null };
    const svc = crearEmpleadoService({ empleados: repo([luis]), otps: otps(), contrasenias });
    await expect(svc.actualizar(5, { id: 5, rol: 'mesero' }, { cargo: 'admin' })).rejects.toMatchObject({ status: 403 });
    await svc.actualizar(5, { id: 5, rol: 'mesero' }, { cargo: ' mesero ' }); // mismo cargo: permitido
    await svc.actualizar(5, { id: 1, rol: 'admin' }, { contrasenia: CLAVE });
    expect(luis.contrasenia).toBe(`hash:${CLAVE}`);
  });

  it('eliminar la cuenta pide la contraseña, no se permite con pedidos en curso y anonimiza', async () => {
    const ana = { id: 3, contrasenia: `hash:${CLAVE}`, nombres: 'Ana' };
    const afiliaciones = { eliminarDelCliente: vi.fn() };
    let abiertos = 1;
    const svc = crearPrivacidadService({
      clientes: repo([ana]),
      fotos: { eliminar: vi.fn() },
      privacidad: { contarPedidosAbiertos: async () => abiertos, vaciarCarrito: vi.fn() },
      afiliaciones,
      contrasenias,
      transacciones: { ejecutar: (trabajo) => trabajo('t') }
    });
    await expect(svc.eliminarCuenta(3, '')).rejects.toThrow('Ingresa tu contraseña');
    await expect(svc.eliminarCuenta(3, 'otra')).rejects.toThrow('no es correcta');
    await expect(svc.eliminarCuenta(3, CLAVE)).rejects.toThrow('pedidos en curso');
    abiertos = 0;
    await svc.eliminarCuenta(3, CLAVE);
    expect(ana).toMatchObject({ nombres: 'Cliente', correo_electronico: 'eliminado-3@eliminado.invalid', contrasenia: 'hash:imposible' });
    expect(ana.eliminado_en).toBeInstanceOf(Date);
    // Ningún restaurante conserva su consentimiento (RF-45).
    expect(afiliaciones.eliminarDelCliente).toHaveBeenCalledWith(3, 't');
  });

  it('reconoce la foto por sus bytes, no por lo que diga la app', () => {
    expect(tipoDeImagen(Buffer.from([0xff, 0xd8, 0xff, 0xe0]))).toBe('image/jpeg');
    expect(tipoDeImagen(Buffer.from('RIFF0000WEBPVP8 '))).toBe('image/webp');
    expect(tipoDeImagen(Buffer.from('<svg onload=alert(1)>'))).toBeNull();
  });
});
