import { Router } from 'express';
import { getCarrito, putCarrito } from '../controllers/carritoController.js';
import { verifyToken, restrictTo } from '../middlewares/authMiddleware.js';

const router = Router();

// Carrito del cliente de la sesión (app móvil, RF-13).
router.use(verifyToken, restrictTo('cliente'));

router.get('/', getCarrito);
router.put('/', putCarrito);

export default router;
