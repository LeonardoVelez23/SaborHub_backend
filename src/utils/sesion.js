import jwt from 'jsonwebtoken';
import { config } from '../config/env.js';

/**
 * JWT de la sesión. Dura 20 minutos para clientes y 8 horas para el
 * personal (configurable), fijo desde el inicio de sesión.
 */
export const emitirToken = (user, role) =>
  jwt.sign(
    {
      id: user.id,
      identificacion: user.identificacion,
      nombres: user.nombres,
      apellidos: user.apellidos,
      correo_electronico: user.correo_electronico,
      rol: role
    },
    config.jwtSecret,
    { expiresIn: role === 'cliente' ? config.sesionCliente : config.sesionPersonal }
  );
