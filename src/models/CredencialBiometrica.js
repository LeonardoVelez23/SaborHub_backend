import { Model, DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

/**
 * Credencial del ingreso con huella o rostro (una por dispositivo). Solo
 * se guarda el SHA-256 del secreto; el secreto cambia en cada ingreso.
 */
class CredencialBiometrica extends Model {}

CredencialBiometrica.init({
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  cliente_id: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  token_hash: {
    type: DataTypes.STRING(64),
    allowNull: false,
    unique: true
  },
  dispositivo: {
    type: DataTypes.STRING(100),
    allowNull: true
  },
  ultimo_uso: {
    type: DataTypes.DATE,
    allowNull: false
  }
}, {
  sequelize,
  modelName: 'CredencialBiometrica',
  tableName: 'CredencialesBiometricas',
  timestamps: true
});

export default CredencialBiometrica;
