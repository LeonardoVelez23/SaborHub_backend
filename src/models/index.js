import sequelize from '../config/database.js';
import Categoria from './Categoria.js';
import Producto from './Producto.js';
import Cliente from './Cliente.js';
import Empleado from './Empleado.js';
import Pedido from './Pedido.js';
import DetallePedido from './DetallePedido.js';
import Pago from './Pago.js';
import FotoPerfil from './FotoPerfil.js';
import TransaccionPayphone from './TransaccionPayphone.js';
import CredencialBiometrica from './CredencialBiometrica.js';
import CarritoItem from './CarritoItem.js';
import Restaurante from './Restaurante.js';
import Sucursal from './Sucursal.js';
import ClienteRestaurante from './ClienteRestaurante.js';

// --- Asociaciones ---

// Restaurante -> Sucursal -> menú, pedidos y personal (DERCAS 12)
Restaurante.hasMany(Sucursal, { foreignKey: 'restaurante_id', as: 'sucursales' });
Sucursal.belongsTo(Restaurante, { foreignKey: 'restaurante_id', as: 'restaurante' });
Sucursal.hasMany(Categoria, { foreignKey: 'sucursal_id', as: 'categorias' });
Categoria.belongsTo(Sucursal, { foreignKey: 'sucursal_id', as: 'sucursal' });
Sucursal.hasMany(Producto, { foreignKey: 'sucursal_id', as: 'productos' });
Producto.belongsTo(Sucursal, { foreignKey: 'sucursal_id', as: 'sucursal' });
Sucursal.hasMany(Pedido, { foreignKey: 'sucursal_id', as: 'pedidos' });
Pedido.belongsTo(Sucursal, { foreignKey: 'sucursal_id', as: 'sucursal' });
Restaurante.hasMany(Empleado, { foreignKey: 'restaurante_id', as: 'empleados' });
Empleado.belongsTo(Restaurante, { foreignKey: 'restaurante_id', as: 'restaurante' });
Sucursal.hasMany(Empleado, { foreignKey: 'sucursal_id', as: 'empleados' });
Empleado.belongsTo(Sucursal, { foreignKey: 'sucursal_id', as: 'sucursal' });

// Categoria <-> Producto (Uno a Muchos)
Categoria.hasMany(Producto, { foreignKey: 'categoria_id', as: 'productos' });
Producto.belongsTo(Categoria, { foreignKey: 'categoria_id', as: 'categoria' });

// Cliente <-> Pedido (Uno a Muchos)
Cliente.hasMany(Pedido, { foreignKey: 'cliente_id', as: 'pedidos' });
Pedido.belongsTo(Cliente, { foreignKey: 'cliente_id', as: 'cliente' });

// Empleado <-> Pedido (Uno a Muchos) - Atención (Mesero / Repartidor)
Empleado.hasMany(Pedido, { foreignKey: 'empleado_id', as: 'pedidosAsignados' });
Pedido.belongsTo(Empleado, { foreignKey: 'empleado_id', as: 'empleadoResponsable' });

// Empleado <-> Pedido (Uno a Muchos) - Preparación (Cocinero)
Empleado.hasMany(Pedido, { foreignKey: 'empleado_preparacion_id', as: 'pedidosPreparados' });
Pedido.belongsTo(Empleado, { foreignKey: 'empleado_preparacion_id', as: 'empleadoPreparacion' });

// Pedido <-> DetallePedido (Uno a Muchos)
Pedido.hasMany(DetallePedido, { foreignKey: 'pedido_id', as: 'detalles' });
DetallePedido.belongsTo(Pedido, { foreignKey: 'pedido_id', as: 'pedido' });

// Producto <-> DetallePedido (Uno a Muchos)
Producto.hasMany(DetallePedido, { foreignKey: 'producto_id', as: 'detallesPedido' });
DetallePedido.belongsTo(Producto, { foreignKey: 'producto_id', as: 'producto' });

// Pedido <-> Producto (Muchos a Muchos a través de DetallePedido)
Pedido.belongsToMany(Producto, {
  through: DetallePedido,
  foreignKey: 'pedido_id',
  otherKey: 'producto_id',
  as: 'productos'
});
Producto.belongsToMany(Pedido, {
  through: DetallePedido,
  foreignKey: 'producto_id',
  otherKey: 'pedido_id',
  as: 'pedidos'
});

// Pedido <-> Pago (Uno a Uno)
Pedido.hasOne(Pago, { foreignKey: 'pedido_id', as: 'pago' });
Pago.belongsTo(Pedido, { foreignKey: 'pedido_id', as: 'pedido' });

// Cliente <-> FotoPerfil (Uno a Uno; se borra con el cliente)
Cliente.hasOne(FotoPerfil, { foreignKey: 'cliente_id', as: 'foto', onDelete: 'CASCADE' });
FotoPerfil.belongsTo(Cliente, { foreignKey: 'cliente_id', as: 'cliente' });

// Pedido <-> TransaccionPayphone (intentos de pago con tarjeta, RF-22)
Pedido.hasMany(TransaccionPayphone, { foreignKey: 'pedido_id', as: 'transaccionesPayphone', onDelete: 'CASCADE' });
TransaccionPayphone.belongsTo(Pedido, { foreignKey: 'pedido_id', as: 'pedido' });

// Cliente <-> CredencialBiometrica (ingreso con huella, uno por dispositivo)
Cliente.hasMany(CredencialBiometrica, { foreignKey: 'cliente_id', as: 'credencialesBiometricas', onDelete: 'CASCADE' });
CredencialBiometrica.belongsTo(Cliente, { foreignKey: 'cliente_id', as: 'cliente' });

// Cliente <-> CarritoItem (carrito guardado en el servidor, RF-13)
Cliente.hasMany(CarritoItem, { foreignKey: 'cliente_id', as: 'carrito', onDelete: 'CASCADE' });
CarritoItem.belongsTo(Cliente, { foreignKey: 'cliente_id', as: 'cliente' });
Producto.hasMany(CarritoItem, { foreignKey: 'producto_id', as: 'enCarritos', onDelete: 'CASCADE' });
CarritoItem.belongsTo(Producto, { foreignKey: 'producto_id', as: 'producto' });

// Cliente <-> Restaurante: afiliación por restaurante (DERCAS 12, RF-43)
Cliente.hasMany(ClienteRestaurante, { foreignKey: 'cliente_id', as: 'afiliaciones', onDelete: 'CASCADE' });
ClienteRestaurante.belongsTo(Cliente, { foreignKey: 'cliente_id', as: 'cliente' });
Restaurante.hasMany(ClienteRestaurante, { foreignKey: 'restaurante_id', as: 'afiliaciones' });
ClienteRestaurante.belongsTo(Restaurante, { foreignKey: 'restaurante_id', as: 'restaurante' });

// Al cambiar la contraseña (también al restablecerla o eliminar la cuenta)
// se revoca el ingreso con huella en todos los dispositivos.
Cliente.addHook('afterUpdate', async (cliente, options) => {
  if (cliente.changed('contrasenia')) {
    await CredencialBiometrica.destroy({
      where: { cliente_id: cliente.id },
      transaction: options.transaction
    });
  }
});

// Exportar todos los modelos y la conexión
export {
  sequelize,
  Categoria,
  Producto,
  Cliente,
  Empleado,
  Pedido,
  DetallePedido,
  Pago,
  FotoPerfil,
  TransaccionPayphone,
  CredencialBiometrica,
  CarritoItem,
  Restaurante,
  Sucursal,
  ClienteRestaurante
};
