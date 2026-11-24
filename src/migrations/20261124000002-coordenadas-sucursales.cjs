'use strict';

/**
 * Coordenadas de las sucursales (DERCAS, 24-11-2026).
 *
 * La app elige la sucursal más cercana al usuario con su ubicación, que no
 * sale del teléfono: el servidor solo publica dónde está cada local. Las dos
 * columnas son opcionales (una sucursal sin coordenadas no entra en el
 * cálculo), pero van juntas: ambas nulas o ambas con valor. numeric(9,6)
 * guarda seis decimales, unos 11 cm.
 */
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(`
      ALTER TABLE "Sucursales"
        ADD COLUMN "latitud" NUMERIC(9, 6),
        ADD COLUMN "longitud" NUMERIC(9, 6),
        ADD CONSTRAINT "sucursales_latitud_rango" CHECK ("latitud" BETWEEN -90 AND 90),
        ADD CONSTRAINT "sucursales_longitud_rango" CHECK ("longitud" BETWEEN -180 AND 180),
        ADD CONSTRAINT "sucursales_coordenadas_juntas" CHECK (("latitud" IS NULL) = ("longitud" IS NULL));
    `);
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(`
      ALTER TABLE "Sucursales"
        DROP CONSTRAINT IF EXISTS "sucursales_coordenadas_juntas",
        DROP CONSTRAINT IF EXISTS "sucursales_longitud_rango",
        DROP CONSTRAINT IF EXISTS "sucursales_latitud_rango",
        DROP COLUMN IF EXISTS "longitud",
        DROP COLUMN IF EXISTS "latitud";
    `);
  }
};
