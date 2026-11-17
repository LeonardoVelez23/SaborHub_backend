import { Model, DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

class Categoria extends Model {}

Categoria.init({
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  nombre: {
    type: DataTypes.STRING(100),
    allowNull: false
  },
  // Cada sucursal tiene su propio menú; el nombre es único en la sucursal.
  sucursal_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: { model: 'Sucursales', key: 'id' }
  }
}, {
  sequelize,
  modelName: 'Categoria',
  tableName: 'Categorias',
  timestamps: true,
  indexes: [{ unique: true, fields: ['sucursal_id', 'nombre'] }]
});

export default Categoria;
