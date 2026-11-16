'use strict';

/**
 * Carrito del cliente guardado en el servidor (RF-13): no se pierde al
 * cerrar la app ni al cambiar de teléfono. Una fila por producto; se vacía
 * al crear el pedido y al eliminar la cuenta.
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('CarritoItems', {
      cliente_id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        references: { model: 'Clientes', key: 'id' },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE'
      },
      producto_id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        references: { model: 'Productos', key: 'id' },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE'
      },
      cantidad: { type: Sequelize.INTEGER, allowNull: false },
      // Orden en que el cliente los agregó.
      posicion: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      createdAt: { type: Sequelize.DATE, allowNull: false },
      updatedAt: { type: Sequelize.DATE, allowNull: false }
    });
    await queryInterface.addIndex('CarritoItems', ['producto_id']);
    // Igual que el resto de tablas: sin acceso por la API REST de Supabase.
    await queryInterface.sequelize.query(
      'ALTER TABLE "CarritoItems" ENABLE ROW LEVEL SECURITY;'
    );
  },

  async down(queryInterface) {
    await queryInterface.dropTable('CarritoItems');
  }
};
