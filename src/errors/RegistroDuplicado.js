/**
 * Un valor único ya existe (código de producto, nombre de categoría, pago
 * de un pedido...). Lo lanzan los repositorios en lugar del error propio
 * de la base, y cada servicio lo convierte en su mensaje.
 */
export class RegistroDuplicado extends Error {
  constructor(message = 'Ya existe un registro con esos datos') {
    super(message);
    this.name = 'RegistroDuplicado';
  }
}

/** Ejecuta `operacion` traduciendo la violación de unicidad de la base. */
export const sinDuplicados = async (operacion) => {
  try {
    return await operacion();
  } catch (error) {
    if (error.name === 'SequelizeUniqueConstraintError') throw new RegistroDuplicado();
    throw error;
  }
};
