'use strict';

/**
 * Modelo tipo Uber: los términos y la política son de la plataforma y se
 * aceptan al registrarse; el primer pedido en un restaurante crea la
 * afiliación sola. Nuevo origen de afiliación: 'pedido'.
 */
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(
      `ALTER TYPE "enum_ClientesRestaurantes_origen" ADD VALUE IF NOT EXISTS 'pedido';`
    );
  },

  async down(queryInterface) {
    // Postgres no quita valores de un enum: se recrea sin 'pedido' y esas
    // afiliaciones quedan como 'app'.
    await queryInterface.sequelize.transaction(async (transaction) => {
      const q = (sql) => queryInterface.sequelize.query(sql, { transaction });
      await q(`ALTER TABLE "ClientesRestaurantes" ALTER COLUMN origen TYPE VARCHAR(20);`);
      await q(`UPDATE "ClientesRestaurantes" SET origen = 'app' WHERE origen = 'pedido';`);
      await q(`DROP TYPE "enum_ClientesRestaurantes_origen";`);
      await q(`CREATE TYPE "enum_ClientesRestaurantes_origen" AS ENUM ('app', 'presencial');`);
      await q(
        `ALTER TABLE "ClientesRestaurantes" ALTER COLUMN origen TYPE "enum_ClientesRestaurantes_origen" USING origen::"enum_ClientesRestaurantes_origen";`
      );
    });
  }
};
