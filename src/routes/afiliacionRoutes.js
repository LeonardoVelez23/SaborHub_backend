import { Router } from 'express';
import { afiliarme, getMisAfiliaciones, retirarAfiliacion } from '../controllers/afiliacionController.js';
import { verifyToken, restrictTo } from '../middlewares/authMiddleware.js';

const router = Router();

// Mis restaurantes: el cliente acepta, consulta y retira su consentimiento (RF-43, RF-45).
router.get('/', verifyToken, restrictTo('cliente'), getMisAfiliaciones);
router.post('/', verifyToken, restrictTo('cliente'), afiliarme);
router.delete('/:restauranteId', verifyToken, restrictTo('cliente'), retirarAfiliacion);

export default router;
