import { randomBytes } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { config } from './config/env.js';
import * as modelos from './models/index.js';
import { crearTransacciones } from './repositories/transacciones.js';
import { crearPedidoRepository } from './repositories/pedidoRepository.js';
import { crearProductoRepository } from './repositories/productoRepository.js';
import { crearCategoriaRepository } from './repositories/categoriaRepository.js';
import { crearClienteRepository } from './repositories/clienteRepository.js';
import { crearEmpleadoRepository } from './repositories/empleadoRepository.js';
import { crearFotoPerfilRepository } from './repositories/fotoPerfilRepository.js';
import { crearPrivacidadRepository } from './repositories/privacidadRepository.js';
import { crearPagoRepository } from './repositories/pagoRepository.js';
import { crearPersonasRepository } from './repositories/personasRepository.js';
import { crearTransaccionPagoRepository } from './repositories/transaccionPagoRepository.js';
import { crearCuentaRepository } from './repositories/cuentaRepository.js';
import { crearCredencialRepository } from './repositories/credencialRepository.js';
import { crearCarritoRepository } from './repositories/carritoRepository.js';
import { crearSucursalRepository } from './repositories/sucursalRepository.js';
import { crearPedidoService } from './services/pedidoService.js';
import { crearPagoService } from './services/pagoService.js';
import { crearProductoService } from './services/productoService.js';
import { crearCategoriaService } from './services/categoriaService.js';
import { crearClienteService } from './services/clienteService.js';
import { crearEmpleadoService } from './services/empleadoService.js';
import { crearPerfilService } from './services/perfilService.js';
import { crearPrivacidadService } from './services/privacidadService.js';
import { crearContrasenias } from './services/contrasenias.js';
import { crearOtpService } from './services/otpService.js';
import { crearSesionService } from './services/sesionService.js';
import { crearAuthService } from './services/authService.js';
import { crearBiometricoService } from './services/biometricoService.js';
import { crearCarritoService } from './services/carritoService.js';
import { sendPasswordResetEmail } from './services/emailService.js';
import { nivelDeCargo, rolDeCargo } from './utils/roles.js';
import { emitirToken } from './utils/sesion.js';
import { VERSION_LEGAL } from './legal/documentos.js';
import { crearPagoTarjetaService } from './services/pagoTarjetaService.js';
import { crearPasarelaPayphone } from './services/pasarelas/payphone.js';
import { ahoraLocal } from './utils/reloj.js';

/**
 * Raíz de composición (inversión de dependencias): el único lugar que une
 * los servicios con sus implementaciones reales (Sequelize, Payphone,
 * reloj). Los controladores usan los servicios ya armados; los tests
 * pueden armar los suyos con dependencias en memoria.
 */

const transacciones = crearTransacciones(modelos);

const repositorios = {
  pedidos: crearPedidoRepository(modelos),
  productos: crearProductoRepository(modelos),
  categorias: crearCategoriaRepository(modelos),
  clientes: crearClienteRepository(modelos),
  empleados: crearEmpleadoRepository(modelos),
  fotos: crearFotoPerfilRepository(modelos),
  privacidad: crearPrivacidadRepository(modelos),
  pagos: crearPagoRepository(modelos),
  personas: crearPersonasRepository(modelos),
  intentos: crearTransaccionPagoRepository(modelos),
  cuentas: crearCuentaRepository(modelos),
  credenciales: crearCredencialRepository(modelos),
  carritos: crearCarritoRepository(modelos),
  sucursales: crearSucursalRepository(modelos)
};

const contrasenias = crearContrasenias(bcrypt);

export const otpService = crearOtpService({ cuentas: repositorios.cuentas, secreto: config.jwtSecret });
const otps = otpService;

/** Cambiar de pasarela = cambiar esta línea (contrato en pasarelas/pasarelaPago.js). */
const pasarela = crearPasarelaPayphone(config.payphone);

export const pedidoService = crearPedidoService({
  ...repositorios,
  transacciones,
  reloj: () => ahoraLocal()
});

export const pagoService = crearPagoService(repositorios);

export const productoService = crearProductoService(repositorios);

export const categoriaService = crearCategoriaService(repositorios);

export const pagoTarjetaService = crearPagoTarjetaService({
  pasarela,
  pedidos: repositorios.pedidos,
  pagos: repositorios.pagos,
  intentos: repositorios.intentos,
  transacciones,
  // La app abre nuestra página intermedia, no la de la pasarela (ver /pagos/payphone/ir).
  urlIntermedia: (urlPago) => {
    const ir = new URL('/pagos/payphone/ir', config.payphone.responseUrl);
    ir.searchParams.set('u', urlPago);
    return ir.toString();
  },
  generarReferencia: (pedidoId) => `SP${pedidoId}-${randomBytes(6).toString('hex')}`
});

export const clienteService = crearClienteService({
  ...repositorios,
  otps,
  contrasenias,
  versionLegal: VERSION_LEGAL
});

export const empleadoService = crearEmpleadoService({ ...repositorios, otps, contrasenias });

export const perfilService = crearPerfilService(repositorios);

export const privacidadService = crearPrivacidadService({ ...repositorios, contrasenias, transacciones });

export const sesionService = crearSesionService({ cuentas: repositorios.cuentas, rolDeCargo, nivelDeCargo });

export const authService = crearAuthService({
  cuentas: repositorios.cuentas,
  otps,
  contrasenias,
  emitirToken,
  rolDeCargo,
  correo: { enviarCodigo: (...datos) => sendPasswordResetEmail(...datos) },
  // En desarrollo el código se ve en la consola (sin correo configurado).
  mostrarCodigo:
    config.nodeEnv === 'development'
      ? (correo, otp) => console.log(`\n🔑 [CÓDIGO OTP ENVIADO A ${correo}]: ${otp}\n`)
      : null
});

export const biometricoService = crearBiometricoService({ ...repositorios, emitirToken });

export const carritoService = crearCarritoService({ ...repositorios, transacciones });
