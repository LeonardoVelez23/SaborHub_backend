'use strict';

/**
 * Tipo de cliente obsoleto (DERCAS, decisión del 18-11-2026).
 *
 * Las categorías (Estudiante, Docente, Personal Administrativo, Persona
 * externa) venían del comedor del Politécnico y no aplican a una plataforma
 * de varios restaurantes. La columna queda opcional y ya no se pide ni se
 * muestra; los valores guardados se conservan (salen en la exportación de
 * datos del cliente). Borrarla del todo sería otra migración.
 */
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(
      'ALTER TABLE "Clientes" ALTER COLUMN "tipo_cliente" DROP NOT NULL;'
    );
  },

  async down(queryInterface) {
    const t = await queryInterface.sequelize.transaction();
    try {
      await queryInterface.sequelize.query(
        `UPDATE "Clientes" SET "tipo_cliente" = 'Persona externa' WHERE "tipo_cliente" IS NULL;`,
        { transaction: t }
      );
      await queryInterface.sequelize.query(
        'ALTER TABLE "Clientes" ALTER COLUMN "tipo_cliente" SET NOT NULL;',
        { transaction: t }
      );
      await t.commit();
    } catch (error) {
      await t.rollback();
      throw error;
    }
  }
};
