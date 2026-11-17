import { Model, DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

// Campos que nunca deben salir en una respuesta JSON: la contraseña y el OTP
// de recuperación (con el OTP cualquiera podría cambiar la contraseña).
const CAMPOS_PRIVADOS = [
  'contrasenia',
  'reset_password_token',
  'reset_password_expires',
  'reset_password_attempts'
];

class Empleado extends Model {
  toJSON() {
    const values = { ...this.get() };
    for (const campo of CAMPOS_PRIVADOS) delete values[campo];
    return values;
  }
}

Empleado.init({
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  identificacion: {
    type: DataTypes.STRING(20),
    allowNull: false,
    unique: true
  },
  nombres: {
    type: DataTypes.STRING(100),
    allowNull: false
  },
  apellidos: {
    type: DataTypes.STRING(100),
    allowNull: false
  },
  correo_electronico: {
    type: DataTypes.STRING(150),
    allowNull: false,
    unique: true,
    validate: {
      isEmail: true
    }
  },
  telefono: {
    type: DataTypes.STRING(20),
    allowNull: true
  },
  cargo: {
    type: DataTypes.STRING(100),
    allowNull: true
  },
  turno_trabajo: {
    type: DataTypes.STRING(50),
    allowNull: true
  },
  contrasenia: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  reset_password_token: {
    type: DataTypes.STRING(255),
    allowNull: true
  },
  reset_password_expires: {
    type: DataTypes.DATE,
    allowNull: true
  },
  // Intentos fallidos con el OTP vigente (máximo OTP_MAX_ATTEMPTS).
  reset_password_attempts: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0
  },
  // Alcance (DERCAS 12): null solo para el superadmin de la plataforma.
  restaurante_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: { model: 'Restaurantes', key: 'id' }
  },
  // null para el administrador de restaurante (ve todas sus sucursales).
  sucursal_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: { model: 'Sucursales', key: 'id' }
  }
}, {
  sequelize,
  modelName: 'Empleado',
  tableName: 'Empleados',
  timestamps: true
});

export default Empleado;
