import { Router } from 'express';
import { getAllPagos, getMisPagos, getPagoById, getPagoByPedido, createPago, updatePago, deletePago } from '../controllers/pagoController.js';
import { prepararPagoPayphone } from '../controllers/payphoneController.js';
import { verifyToken, restrictTo } from '../middlewares/authMiddleware.js';

const router = Router();

router.use(verifyToken);

router.get('/', restrictTo('admin', 'empleado', 'cajero'), getAllPagos);
// Pago con tarjeta por Payphone (RF-22): devuelve el enlace de pago.
router.post('/payphone/preparar', restrictTo('cliente'), prepararPagoPayphone);
// Antes de '/:id' para que "mios" no se lea como un id.
router.get('/mios', restrictTo('cliente'), getMisPagos);
router.get('/pedido/:pedidoId', getPagoByPedido);
router.get('/:id', getPagoById);
router.post('/', restrictTo('cliente', 'admin', 'empleado', 'cajero', 'cocinero'), createPago);
router.put('/:id', restrictTo('admin', 'empleado', 'cajero'), updatePago);
router.delete('/:id', restrictTo('admin'), deletePago);

export default router;