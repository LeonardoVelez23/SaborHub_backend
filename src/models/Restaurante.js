import { Model, DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

/** Negocio que usa la plataforma (DERCAS 12). */
class Restaurante extends Model {}

Restaurante.init(
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    nombre: { type: DataTypes.STRING(150), allowNull: false },
    ruc: { type: DataTypes.STRING(13), allowNull: true, unique: true },
    telefono: { type: DataTypes.STRING(20), allowNull: true },
    correo_electronico: { type: DataTypes.STRING(150), allowNull: true },
    estado: { type: DataTypes.ENUM('activo', 'suspendido'), allowNull: false, defaultValue: 'activo' }
  },
  { sequelize, modelName: 'Restaurante', tableName: 'Restaurantes', timestamps: true }
);

export default Restaurante;
