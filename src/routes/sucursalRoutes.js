import { Router } from 'express';
import {
  getSucursalesPublicas,
  getSucursalPublica,
  getSucursalesGestion,
  createSucursal,
  updateSucursal
} from '../controllers/restauranteController.js';
import { verifyToken, restrictTo } from '../middlewares/authMiddleware.js';

const router = Router();

router.get('/', getSucursalesPublicas);
router.get('/gestion', verifyToken, restrictTo('admin'), getSucursalesGestion);
router.get('/:id', getSucursalPublica);
router.post('/', verifyToken, restrictTo('admin'), createSucursal);
router.put('/:id', verifyToken, restrictTo('admin'), updateSucursal);

export default router;
