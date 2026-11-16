'use strict';

/**
 * Ingreso con huella o rostro en la app. La app guarda una credencial del
 * dispositivo (secreto aleatorio) y solo la envía tras verificar la huella;
 * aquí se guarda únicamente su SHA-256. Se borra con el cliente y al cambiar
 * la contraseña o eliminar la cuenta.
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('CredencialesBiometricas', {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
      cliente_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'Clientes', key: 'id' },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE'
      },
      token_hash: { type: Sequelize.STRING(64), allowNull: false, unique: true },
      dispositivo: { type: Sequelize.STRING(100), allowNull: true },
      ultimo_uso: { type: Sequelize.DATE, allowNull: false },
      createdAt: { type: Sequelize.DATE, allowNull: false },
      updatedAt: { type: Sequelize.DATE, allowNull: false }
    });
    await queryInterface.addIndex('CredencialesBiometricas', ['cliente_id']);
    // Igual que el resto de tablas: sin acceso por la API REST de Supabase.
    await queryInterface.sequelize.query(
      'ALTER TABLE "CredencialesBiometricas" ENABLE ROW LEVEL SECURITY;'
    );
  },

  async down(queryInterface) {
    await queryInterface.dropTable('CredencialesBiometricas');
  }
};
