import { Router } from 'express';
import { irAPagoPayphone, retornoPayphone } from '../controllers/payphoneController.js';

const router = Router();

// URL de respuesta de Payphone (PAYPHONE_RESPONSE_URL): <servidor>/pagos/payphone/retorno
router.get('/retorno', retornoPayphone);
// Abre el formulario de Payphone desde nuestro dominio (Referer).
router.get('/ir', irAPagoPayphone);

export default router;
