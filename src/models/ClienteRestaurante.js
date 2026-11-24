import { Model, DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

/**
 * Afiliación de un cliente a un restaurante (DERCAS 12, RF-43): su
 * consentimiento para que ese restaurante trate sus datos y, si hace
 * falta, el bloqueo en ese restaurante. La cuenta es de la plataforma.
 */
class ClienteRestaurante extends Model {}

ClienteRestaurante.init(
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    cliente_id: { type: DataTypes.INTEGER, allowNull: false, references: { model: 'Clientes', key: 'id' } },
    restaurante_id: { type: DataTypes.INTEGER, allowNull: false, references: { model: 'Restaurantes', key: 'id' } },
    estado: { type: DataTypes.ENUM('activo', 'bloqueado', 'retirado'), allowNull: false, defaultValue: 'activo' },
    origen: { type: DataTypes.ENUM('app', 'presencial', 'pedido'), allowNull: false },
    legal_version: { type: DataTypes.STRING(20), allowNull: false },
    afiliado_en: { type: DataTypes.DATE, allowNull: false },
    bloqueado_en: { type: DataTypes.DATE, allowNull: true },
    bloqueado_por: { type: DataTypes.INTEGER, allowNull: true, references: { model: 'Empleados', key: 'id' } },
    motivo_bloqueo: { type: DataTypes.STRING(255), allowNull: true }
  },
  {
    sequelize,
    modelName: 'ClienteRestaurante',
    tableName: 'ClientesRestaurantes',
    timestamps: true,
    indexes: [{ unique: true, fields: ['cliente_id', 'restaurante_id'] }]
  }
);

export default ClienteRestaurante;
