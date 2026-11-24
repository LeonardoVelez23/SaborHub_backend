'use strict';

const { randomBytes } = require('node:crypto');
const bcrypt = require('bcryptjs');

/**
 * Personal en la app (DERCAS M9, RF-54 a RF-59, RN-38 a RN-41).
 *
 * 1. Mesas de cada sucursal; un pedido presencial puede llevar mesa.
 * 2. Cliente genérico «Consumidor final» para los pedidos presenciales del
 *    personal sin datos del comensal. No puede iniciar sesión: su
 *    contraseña es el hash de bytes aleatorios que nadie conoce.
 */

const CONSUMIDOR_FINAL = {
  identificacion: '9999999999999',
  correo: 'consumidor.final@saborhub.invalid'
};

module.exports = {
  async up(queryInterface, Sequelize) {
    const sql = (texto, t, opciones = {}) => queryInterface.sequelize.query(texto, { transaction: t, ...opciones });
    const t = await queryInterface.sequelize.transaction();
    try {
      await queryInterface.createTable(
        'Mesas',
        {
          id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
          sucursal_id: {
            type: Sequelize.INTEGER,
            allowNull: false,
            references: { model: 'Sucursales', key: 'id' },
            onDelete: 'RESTRICT',
            onUpdate: 'CASCADE'
          },
          nombre: { type: Sequelize.STRING(30), allowNull: false },
          activa: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
          creado_en: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('NOW()') }
        },
        { transaction: t }
      );
      await queryInterface.addConstraint('Mesas', {
        fields: ['sucursal_id', 'nombre'],
        type: 'unique',
        name: 'Mesas_sucursal_nombre_key',
        transaction: t
      });
      await sql(`ALTER TABLE "Mesas" ADD CONSTRAINT "mesas_nombre_no_vacio" CHECK (length(trim(nombre)) > 0)`, t);

      await queryInterface.addColumn(
        'Pedidos',
        'mesa_id',
        {
          type: Sequelize.INTEGER,
          allowNull: true,
          references: { model: 'Mesas', key: 'id' },
          onDelete: 'RESTRICT',
          onUpdate: 'CASCADE'
        },
        { transaction: t }
      );
      await sql(
        `ALTER TABLE "Pedidos" ADD CONSTRAINT "pedidos_mesa_solo_presencial"
           CHECK (mesa_id IS NULL OR modalidad = 'presencial')`,
        t
      );
      await queryInterface.addIndex('Pedidos', ['mesa_id', 'estado'], { name: 'pedidos_mesa_estado', transaction: t });

      await queryInterface.addColumn(
        'Clientes',
        'es_consumidor_final',
        { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
        { transaction: t }
      );
      await sql(
        `CREATE UNIQUE INDEX "clientes_un_consumidor_final" ON "Clientes" (es_consumidor_final)
           WHERE es_consumidor_final`,
        t
      );

      const hash = await bcrypt.hash(randomBytes(32).toString('hex'), 10);
      await sql(
        `INSERT INTO "Clientes"
           (identificacion, nombres, apellidos, correo_electronico, contrasenia,
            reset_password_attempts, es_consumidor_final, "createdAt", "updatedAt")
         VALUES (:identificacion, 'Consumidor', 'Final', :correo, :hash, 0, true, NOW(), NOW())
         ON CONFLICT (identificacion) DO UPDATE SET es_consumidor_final = true`,
        t,
        { replacements: { ...CONSUMIDOR_FINAL, hash } }
      );

      // Igual que el resto de tablas: sin acceso por la API REST de Supabase.
      await sql('ALTER TABLE "Mesas" ENABLE ROW LEVEL SECURITY;', t);

      await t.commit();
    } catch (error) {
      await t.rollback();
      throw error;
    }
  },

  async down(queryInterface) {
    const sql = (texto, t, opciones = {}) => queryInterface.sequelize.query(texto, { transaction: t, ...opciones });
    const t = await queryInterface.sequelize.transaction();
    try {
      // Los pedidos del consumidor final impiden borrarlo (RESTRICT): se
      // conserva como cliente normal en ese caso.
      await sql(
        `DELETE FROM "Clientes" c WHERE c.es_consumidor_final
           AND NOT EXISTS (SELECT 1 FROM "Pedidos" p WHERE p.cliente_id = c.id)`,
        t
      );
      await sql('DROP INDEX IF EXISTS "clientes_un_consumidor_final"', t);
      await queryInterface.removeColumn('Clientes', 'es_consumidor_final', { transaction: t });
      await queryInterface.removeColumn('Pedidos', 'mesa_id', { transaction: t });
      await queryInterface.dropTable('Mesas', { transaction: t });
      await t.commit();
    } catch (error) {
      await t.rollback();
      throw error;
    }
  }
};
