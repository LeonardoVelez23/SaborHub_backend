import { Router } from 'express';
import healthRoutes from './health.routes.js';
import categoriaRoutes from './categoriaRoutes.js';
import productoRoutes from './productoRoutes.js';
import clienteRoutes from './clienteRoutes.js';
import empleadoRoutes from './empleadoRoutes.js';
import pedidoRoutes from './pedidoRoutes.js';
import pagoRoutes from './pagoRoutes.js';
import authRoutes from './authRoutes.js';
import legalRoutes from './legalRoutes.js';
import privacidadRoutes from './privacidadRoutes.js';
import perfilRoutes from './perfilRoutes.js';
import carritoRoutes from './carritoRoutes.js';
import restauranteRoutes from './restauranteRoutes.js';
import sucursalRoutes from './sucursalRoutes.js';
import afiliacionRoutes from './afiliacionRoutes.js';
import mesaRoutes from './mesaRoutes.js';
import { openapi } from '../docs/openapi.js';

const router = Router();

router.use('/', healthRoutes);
// Contrato de la API (OpenAPI 3.1); se abre en https://editor.swagger.io.
router.get('/openapi.json', (req, res) => res.json(openapi));
router.use('/auth', authRoutes);
router.use('/legal', legalRoutes);
router.use('/privacidad', privacidadRoutes);
router.use('/perfil', perfilRoutes);
router.use('/carrito', carritoRoutes);
router.use('/restaurantes', restauranteRoutes);
router.use('/sucursales', sucursalRoutes);
router.use('/afiliaciones', afiliacionRoutes);
router.use('/categorias', categoriaRoutes);
router.use('/productos', productoRoutes);
router.use('/clientes', clienteRoutes);
router.use('/empleados', empleadoRoutes);
router.use('/mesas', mesaRoutes);
router.use('/pedidos', pedidoRoutes);
router.use('/pagos', pagoRoutes);

export default router;