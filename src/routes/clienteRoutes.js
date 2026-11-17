import { Router } from 'express';
import {
  getAllClientes,
  getClienteById,
  createCliente,
  updateCliente,
  deleteCliente,
  buscarCliente,
  cambiarBloqueoCliente
} from '../controllers/clienteController.js';
import { verifyToken, restrictTo, tokenOpcional } from '../middlewares/authMiddleware.js';

const router = Router();

// Registro público; el personal también crea clientes desde el panel.
router.post('/', tokenOpcional, createCliente);
// El personal ve solo los clientes afiliados a su restaurante (RN-26).
router.get('/', verifyToken, restrictTo('admin', 'empleado', 'cajero', 'mesero'), getAllClientes);
router.get('/buscar', verifyToken, restrictTo('admin', 'empleado', 'cajero', 'mesero'), buscarCliente);
router.get('/:id', verifyToken, restrictTo('admin', 'cliente'), getClienteById);
// La cuenta: el propio cliente o el superadmin (RN-28; el servicio lo comprueba).
router.put('/:id', verifyToken, restrictTo('admin', 'cliente'), updateCliente);
router.put('/:id/bloqueo', verifyToken, restrictTo('admin'), cambiarBloqueoCliente);
router.delete('/:id', verifyToken, restrictTo('admin'), deleteCliente);

export default router;