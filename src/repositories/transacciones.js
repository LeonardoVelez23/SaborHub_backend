/**
 * Unidad de trabajo: los servicios agrupan varias escrituras en una
 * transacción sin conocer Sequelize. `t` se pasa tal cual a los
 * repositorios. `m` son los modelos (se leen al usarse).
 */
export const crearTransacciones = (m) => ({
  /** Ejecuta `trabajo(t)`; confirma si termina bien y deshace si lanza. */
  async ejecutar(trabajo) {
    const t = await m.sequelize.transaction();
    try {
      const resultado = await trabajo(t);
      await t.commit();
      return resultado;
    } catch (error) {
      if (!t.finished) await t.rollback();
      throw error;
    }
  }
});
