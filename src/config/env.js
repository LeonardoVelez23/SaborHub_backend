import dotenv from 'dotenv';

dotenv.config();

// Sin secreto propio cualquiera podría firmar tokens válidos (p. ej. de admin).
if (!process.env.JWT_SECRET) {
  throw new Error(
    'JWT_SECRET no está definido. Agrégalo al .env (ver .env.example) o a las variables del servidor.'
  );
}

export const config = {
  port: process.env.PORT || 3000,
  nodeEnv: process.env.NODE_ENV || 'development',
  // Ver src/config/cors.js.
  corsOrigin: process.env.CORS_ORIGIN,
  databaseUrl: process.env.DATABASE_URL,
  jwtSecret: process.env.JWT_SECRET,
  // Duración de la sesión (formato de jsonwebtoken: 20m, 8h...). Fija desde
  // el login, sin renovación: al vencer hay que volver a iniciar sesión.
  sesionCliente: process.env.JWT_EXPIRES_CLIENTE || '20m',
  sesionPersonal: process.env.JWT_EXPIRES_PERSONAL || '8h',
  // Límite de peticiones en /auth. Solo se desactiva en los tests.
  rateLimitEnabled: process.env.RATE_LIMIT_ENABLED !== 'false',
  // Zona horaria del restaurante: fecha y hora de los pedidos.
  zonaHoraria: process.env.APP_TIMEZONE || 'America/Guayaquil',
  brevoApiKey: process.env.BREVO_API_KEY || '',
  smtpHost: process.env.SMTP_HOST || 'smtp-relay.brevo.com',
  smtpPort: parseInt(process.env.SMTP_PORT || '587', 10),
  smtpUser: process.env.SMTP_USER || '',
  smtpPass: process.env.SMTP_PASS || '',
  emailFrom: process.env.EMAIL_FROM || '"Sabor Politécnico" <no-reply@saborpolitecnico.com>',
  // Pago con tarjeta (RF-22). Sin token y URL de respuesta el pago con
  // tarjeta queda desactivado (la API responde 503). StoreID es opcional.
  payphone: {
    apiUrl: process.env.PAYPHONE_API_URL || 'https://pay.payphonetodoesposible.com',
    token: process.env.PAYPHONE_TOKEN || '',
    storeId: process.env.PAYPHONE_STORE_ID || '',
    // Página pública de este backend: <servidor>/pagos/payphone/retorno
    responseUrl: process.env.PAYPHONE_RESPONSE_URL || '',
    // Enlace para volver a la app al terminar (se agrega /pedidos/<id>/pago).
    appUrl: process.env.APP_DEEP_LINK || 'saborpolitecnico://app'
  }
};
