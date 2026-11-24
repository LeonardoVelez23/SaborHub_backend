import { Router } from 'express';
import { getMesas, createMesa, updateMesa, deleteMesa } from '../controllers/mesaController.js';
import { verifyToken, restrictTo } from '../middlewares/authMiddleware.js';

/** Mesas de la sucursal (DERCAS M9, RF-55). */
const router = Router();

router.use(verifyToken);

router.get('/', restrictTo('admin', 'empleado', 'cajero', 'cocinero', 'mesero'), getMesas);
router.post('/', restrictTo('admin', 'empleado', 'cajero'), createMesa);
router.put('/:id', restrictTo('admin', 'empleado', 'cajero'), updateMesa);
router.delete('/:id', restrictTo('admin'), deleteMesa);

export default router;
