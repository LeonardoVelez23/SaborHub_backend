import { Model, DataTypes } from 'sequelize';
import sequelize from '../config/database.js';
import { comoNumero } from './decimal.js';

/** Local de un restaurante, con su menú, pedidos y personal (DERCAS 12). */
class Sucursal extends Model {}

Sucursal.init(
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    restaurante_id: { type: DataTypes.INTEGER, allowNull: false, references: { model: 'Restaurantes', key: 'id' } },
    nombre: { type: DataTypes.STRING(150), allowNull: false },
    direccion: { type: DataTypes.STRING(255), allowNull: false },
    telefono: { type: DataTypes.STRING(20), allowNull: true },
    // {"lunes": [["07:00", "16:00"]], ...}; null = sin horario publicado.
    horario: { type: DataTypes.JSONB, allowNull: true },
    activa: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    payphone_store_id: { type: DataTypes.STRING(100), allowNull: true },
    // Ubicación del local para que la app elija la más cercana. Van juntas
    // (ambas null o ambas con valor); Postgres devuelve NUMERIC como texto.
    latitud: {
      type: DataTypes.DECIMAL(9, 6),
      allowNull: true,
      get() {
        return comoNumero(this.getDataValue('latitud'));
      }
    },
    longitud: {
      type: DataTypes.DECIMAL(9, 6),
      allowNull: true,
      get() {
        return comoNumero(this.getDataValue('longitud'));
      }
    }
  },
  {
    sequelize,
    modelName: 'Sucursal',
    tableName: 'Sucursales',
    timestamps: true,
    indexes: [{ unique: true, fields: ['restaurante_id', 'nombre'] }]
  }
);

export default Sucursal;
