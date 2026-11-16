import { randomBytes } from 'node:crypto';
import { config } from './config/env.js';
import * as modelos from './models/index.js';
import { crearTransacciones } from './repositories/transacciones.js';
import { crearPedidoRepository } from './repositories/pedidoRepository.js';
import { crearProductoRepository } from './repositories/productoRepository.js';
import { crearCategoriaRepository } from './repositories/categoriaRepository.js';
import { crearPagoRepository } from './repositories/pagoRepository.js';
import { crearPersonasRepository } from './repositories/personasRepository.js';
import { crearTransaccionPagoRepository } from './repositories/transaccionPagoRepository.js';
import { crearPedidoService } from './services/pedidoService.js';
import { crearPagoService } from './services/pagoService.js';
import { crearProductoService } from './services/productoService.js';
import { crearCategoriaService } from './services/categoriaService.js';
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
  pagos: crearPagoRepository(modelos),
  personas: crearPersonasRepository(modelos),
  intentos: crearTransaccionPagoRepository(modelos)
};

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
