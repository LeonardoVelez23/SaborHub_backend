import { Router } from 'express';
import { getRestaurantes, getRestaurante, createRestaurante, updateRestaurante } from '../controllers/restauranteController.js';
import { verifyToken, restrictTo } from '../middlewares/authMiddleware.js';

const router = Router();

// Rol admin; el servicio limita por nivel (superadmin / admin de restaurante).
router.get('/', verifyToken, restrictTo('admin'), getRestaurantes);
router.get('/:id', verifyToken, restrictTo('admin'), getRestaurante);
router.post('/', verifyToken, restrictTo('admin'), createRestaurante);
router.put('/:id', verifyToken, restrictTo('admin'), updateRestaurante);

export default router;
