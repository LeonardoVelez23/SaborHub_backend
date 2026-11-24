import { Model, DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

/** Mesa del salón de una sucursal (DERCAS M9, RN-39). */
class Mesa extends Model {}

Mesa.init(
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    sucursal_id: { type: DataTypes.INTEGER, allowNull: false, references: { model: 'Sucursales', key: 'id' } },
    nombre: { type: DataTypes.STRING(30), allowNull: false },
    activa: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    creado_en: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW }
  },
  { sequelize, modelName: 'Mesa', tableName: 'Mesas', timestamps: false }
);

export default Mesa;
