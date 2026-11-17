'use strict';

/**
 * Clientes por restaurante (DERCAS 12, etapa 8, RF-43 a RF-45, RN-26 a RN-28).
 *
 * La cuenta del cliente sigue siendo de la plataforma; cada restaurante
 * tiene una afiliación por cliente: el consentimiento para tratar sus datos
 * y, si hace falta, el bloqueo en ese restaurante.
 *
 * Los clientes existentes quedan afiliados al restaurante inicial
 * («Sabor Politécnico», el de menor id), donde ya compraban.
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    const t = await queryInterface.sequelize.transaction();
    try {
      await queryInterface.createTable(
        'ClientesRestaurantes',
        {
          id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
          cliente_id: {
            type: Sequelize.INTEGER,
            allowNull: false,
            references: { model: 'Clientes', key: 'id' },
            onDelete: 'CASCADE',
            onUpdate: 'CASCADE'
          },
          restaurante_id: {
            type: Sequelize.INTEGER,
            allowNull: false,
            references: { model: 'Restaurantes', key: 'id' },
            onDelete: 'RESTRICT',
            onUpdate: 'CASCADE'
          },
          estado: {
            type: Sequelize.ENUM('activo', 'bloqueado', 'retirado'),
            allowNull: false,
            defaultValue: 'activo'
          },
          origen: { type: Sequelize.ENUM('app', 'presencial'), allowNull: false },
          legal_version: { type: Sequelize.STRING(20), allowNull: false },
          afiliado_en: { type: Sequelize.DATE, allowNull: false },
          bloqueado_en: { type: Sequelize.DATE, allowNull: true },
          bloqueado_por: {
            type: Sequelize.INTEGER,
            allowNull: true,
            references: { model: 'Empleados', key: 'id' },
            onDelete: 'SET NULL',
            onUpdate: 'CASCADE'
          },
          motivo_bloqueo: { type: Sequelize.STRING(255), allowNull: true },
          createdAt: { type: Sequelize.DATE, allowNull: false },
          updatedAt: { type: Sequelize.DATE, allowNull: false }
        },
        { transaction: t }
      );
      await queryInterface.addConstraint('ClientesRestaurantes', {
        fields: ['cliente_id', 'restaurante_id'],
        type: 'unique',
        name: 'ClientesRestaurantes_cliente_restaurante_key',
        transaction: t
      });
      await queryInterface.addIndex('ClientesRestaurantes', ['restaurante_id', 'estado'], { transaction: t });

      // Clientes actuales (no eliminados) → restaurante inicial.
      await queryInterface.sequelize.query(
        `INSERT INTO "ClientesRestaurantes"
           (cliente_id, restaurante_id, estado, origen, legal_version, afiliado_en, "createdAt", "updatedAt")
         SELECT c.id, r.id, 'activo', 'app', COALESCE(c.legal_version, 'migracion'),
                COALESCE(c.legal_aceptado_en, c."createdAt"), NOW(), NOW()
         FROM "Clientes" c
         CROSS JOIN (SELECT id FROM "Restaurantes" ORDER BY id LIMIT 1) r
         WHERE c.eliminado_en IS NULL`,
        { transaction: t }
      );

      // Igual que el resto de tablas: sin acceso por la API REST de Supabase.
      await queryInterface.sequelize.query('ALTER TABLE "ClientesRestaurantes" ENABLE ROW LEVEL SECURITY;', {
        transaction: t
      });

      await t.commit();
    } catch (error) {
      await t.rollback();
      throw error;
    }
  },

  async down(queryInterface) {
    const t = await queryInterface.sequelize.transaction();
    try {
      await queryInterface.dropTable('ClientesRestaurantes', { transaction: t });
      await queryInterface.sequelize.query(
        'DROP TYPE IF EXISTS "enum_ClientesRestaurantes_estado"; DROP TYPE IF EXISTS "enum_ClientesRestaurantes_origen";',
        { transaction: t }
      );
      await t.commit();
    } catch (error) {
      await t.rollback();
      throw error;
    }
  }
};
