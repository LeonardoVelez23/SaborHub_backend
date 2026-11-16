import { Model, DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

/** Un producto en el carrito de un cliente (RF-13). */
class CarritoItem extends Model {}

CarritoItem.init({
  cliente_id: {
    type: DataTypes.INTEGER,
    primaryKey: true
  },
  producto_id: {
    type: DataTypes.INTEGER,
    primaryKey: true
  },
  cantidad: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  posicion: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0
  }
}, {
  sequelize,
  modelName: 'CarritoItem',
  tableName: 'CarritoItems',
  timestamps: true
});

export default CarritoItem;
