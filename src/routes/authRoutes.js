import { Router } from 'express';
import { login, forgotPassword, resetPassword } from '../controllers/authController.js';
import {
  activarBiometrico,
  desactivarBiometrico,
  loginBiometrico
} from '../controllers/biometricoController.js';
import { verifyToken, restrictTo } from '../middlewares/authMiddleware.js';
import {
  loginLimiter,
  forgotPasswordLimiter,
  resetPasswordLimiter,
  biometricoLimiter
} from '../middlewares/rateLimiter.js';

const router = Router();

router.post('/login', loginLimiter, login);
router.post('/forgot-password', forgotPasswordLimiter, forgotPassword);
router.post('/reset-password', resetPasswordLimiter, resetPassword);

// Ingreso con huella o rostro (app móvil, solo clientes).
router.post('/biometrico', biometricoLimiter, loginBiometrico);
router.post('/biometrico/activar', verifyToken, restrictTo('cliente'), activarBiometrico);
router.delete('/biometrico', verifyToken, restrictTo('cliente'), desactivarBiometrico);

export default router;
