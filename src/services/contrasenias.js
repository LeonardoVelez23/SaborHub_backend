import { randomBytes } from 'node:crypto';

/**
 * Hash de contraseñas (RNF-01: bcrypt, factor 10). Recibe bcrypt para que
 * los tests unitarios puedan usar uno rápido o falso.
 */
export const crearContrasenias = (bcrypt) => ({
  hash: async (texto) => bcrypt.hash(texto, await bcrypt.genSalt(10)),

  comparar: (texto, hash) => bcrypt.compare(texto, hash),

  /** Hash de una contraseña aleatoria: nadie puede volver a entrar. */
  inutilizable: () => bcrypt.hash(randomBytes(32).toString('hex'), 10)
});
