'use strict';

/**
 * Plataforma de varios restaurantes (DERCAS 12, etapa 2):
 * Restaurante → Sucursal → categorías, productos y pedidos.
 *
 * Los datos existentes pasan a un restaurante y una sucursal iniciales, así
 * el sistema sigue funcionando igual. El nombre de categoría y el código de
 * producto pasan a ser únicos por sucursal (antes, en todo el sistema).
 */

const TABLAS_DE_SUCURSAL = ['Categorias', 'Productos', 'Pedidos'];

module.exports = {
  async up(queryInterface, Sequelize) {
    const t = await queryInterface.sequelize.transaction();
    try {
      const fechas = {
        createdAt: { type: Sequelize.DATE, allowNull: false },
        updatedAt: { type: Sequelize.DATE, allowNull: false }
      };
      const referencia = (tabla, onDelete = 'RESTRICT') => ({
        type: Sequelize.INTEGER,
        references: { model: tabla, key: 'id' },
        onDelete,
        onUpdate: 'CASCADE'
      });

      await queryInterface.createTable(
        'Restaurantes',
        {
          id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
          nombre: { type: Sequelize.STRING(150), allowNull: false },
          ruc: { type: Sequelize.STRING(13), allowNull: true, unique: true },
          telefono: { type: Sequelize.STRING(20), allowNull: true },
          correo_electronico: { type: Sequelize.STRING(150), allowNull: true },
          estado: { type: Sequelize.ENUM('activo', 'suspendido'), allowNull: false, defaultValue: 'activo' },
          ...fechas
        },
        { transaction: t }
      );

      await queryInterface.createTable(
        'Sucursales',
        {
          id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
          restaurante_id: { ...referencia('Restaurantes'), allowNull: false },
          nombre: { type: Sequelize.STRING(150), allowNull: false },
          direccion: { type: Sequelize.STRING(255), allowNull: false },
          telefono: { type: Sequelize.STRING(20), allowNull: true },
          // {"lunes": [["07:00", "16:00"]], ...}; null = sin horario publicado.
          horario: { type: Sequelize.JSONB, allowNull: true },
          activa: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
          // Tienda de Payphone de la sucursal; sin ella se usa la del token.
          payphone_store_id: { type: Sequelize.STRING(100), allowNull: true },
          ...fechas
        },
        { transaction: t }
      );
      await queryInterface.addConstraint('Sucursales', {
        fields: ['restaurante_id', 'nombre'],
        type: 'unique',
        name: 'Sucursales_restaurante_nombre_key',
        transaction: t
      });

      // Restaurante y sucursal iniciales con los datos de hoy.
      const ahora = new Date();
      const [[restaurante]] = await queryInterface.sequelize.query(
        `INSERT INTO "Restaurantes" (nombre, estado, "createdAt", "updatedAt")
         VALUES ('Sabor Politécnico', 'activo', :ahora, :ahora) RETURNING id`,
        { replacements: { ahora }, transaction: t }
      );
      const [[sucursal]] = await queryInterface.sequelize.query(
        `INSERT INTO "Sucursales" (restaurante_id, nombre, direccion, activa, "createdAt", "updatedAt")
         VALUES (:restaurante, 'Principal', 'Por definir', true, :ahora, :ahora) RETURNING id`,
        { replacements: { restaurante: restaurante.id, ahora }, transaction: t }
      );

      for (const tabla of TABLAS_DE_SUCURSAL) {
        await queryInterface.addColumn(tabla, 'sucursal_id', referencia('Sucursales'), { transaction: t });
        await queryInterface.sequelize.query(`UPDATE "${tabla}" SET sucursal_id = :id`, {
          replacements: { id: sucursal.id },
          transaction: t
        });
        await queryInterface.changeColumn(tabla, 'sucursal_id', { ...referencia('Sucursales'), allowNull: false }, { transaction: t });
      }
      await queryInterface.addIndex('Pedidos', ['sucursal_id', 'fecha'], { transaction: t });

      // Únicos por sucursal (antes, globales).
      await queryInterface.removeConstraint('Categorias', 'Categorias_nombre_key', { transaction: t });
      await queryInterface.addConstraint('Categorias', {
        fields: ['sucursal_id', 'nombre'],
        type: 'unique',
        name: 'Categorias_sucursal_nombre_key',
        transaction: t
      });
      await queryInterface.removeConstraint('Productos', 'Productos_codigo_key', { transaction: t });
      await queryInterface.addConstraint('Productos', {
        fields: ['sucursal_id', 'codigo'],
        type: 'unique',
        name: 'Productos_sucursal_codigo_key',
        transaction: t
      });

      // Personal: restaurante (null solo para el superadmin) y sucursal
      // (null para el administrador de restaurante).
      await queryInterface.addColumn('Empleados', 'restaurante_id', referencia('Restaurantes'), { transaction: t });
      await queryInterface.addColumn('Empleados', 'sucursal_id', referencia('Sucursales'), { transaction: t });
      await queryInterface.sequelize.query(
        'UPDATE "Empleados" SET restaurante_id = :restaurante, sucursal_id = :sucursal',
        { replacements: { restaurante: restaurante.id, sucursal: sucursal.id }, transaction: t }
      );
      await queryInterface.addIndex('Empleados', ['restaurante_id'], { transaction: t });
      await queryInterface.addIndex('Empleados', ['sucursal_id'], { transaction: t });
      await queryInterface.addIndex('Sucursales', ['restaurante_id'], { transaction: t });

      // Igual que el resto de tablas: sin acceso por la API REST de Supabase.
      await queryInterface.sequelize.query(
        'ALTER TABLE "Restaurantes" ENABLE ROW LEVEL SECURITY; ALTER TABLE "Sucursales" ENABLE ROW LEVEL SECURITY;',
        { transaction: t }
      );

      await t.commit();
    } catch (error) {
      await t.rollback();
      throw error;
    }
  },

  async down(queryInterface) {
    const t = await queryInterface.sequelize.transaction();
    try {
      await queryInterface.removeColumn('Empleados', 'sucursal_id', { transaction: t });
      await queryInterface.removeColumn('Empleados', 'restaurante_id', { transaction: t });
      await queryInterface.removeConstraint('Productos', 'Productos_sucursal_codigo_key', { transaction: t });
      await queryInterface.removeConstraint('Categorias', 'Categorias_sucursal_nombre_key', { transaction: t });
      // Falla si dos sucursales usan el mismo código o nombre: hay que resolverlo antes.
      await queryInterface.addConstraint('Productos', { fields: ['codigo'], type: 'unique', name: 'Productos_codigo_key', transaction: t });
      await queryInterface.addConstraint('Categorias', { fields: ['nombre'], type: 'unique', name: 'Categorias_nombre_key', transaction: t });
      for (const tabla of TABLAS_DE_SUCURSAL) {
        await queryInterface.removeColumn(tabla, 'sucursal_id', { transaction: t });
      }
      await queryInterface.dropTable('Sucursales', { transaction: t });
      await queryInterface.dropTable('Restaurantes', { transaction: t });
      await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_Restaurantes_estado";', { transaction: t });
      await t.commit();
    } catch (error) {
      await t.rollback();
      throw error;
    }
  }
};
