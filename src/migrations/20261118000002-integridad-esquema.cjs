'use strict';

/**
 * Integridad del esquema (revisión del 18-11-2026, DERCAS 13.3.3).
 *
 * 1. Quita las claves foráneas duplicadas a Sucursales (`*_fkey1`) que dejó
 *    la migración 20261117000001 en Categorias, Productos y Pedidos.
 * 2. Reglas de negocio como CHECK en la base (antes solo las validaba el
 *    backend): precios y montos, stock, cantidades, formato de imagen_codigo,
 *    tipo de foto y correos en minúsculas.
 * 3. Aislamiento entre restaurantes con claves foráneas compuestas: un
 *    producto solo puede usar una categoría de su misma sucursal y un
 *    empleado solo una sucursal de su restaurante.
 * 4. Índice de ClientesRestaurantes.bloqueado_por (índice en cada FK).
 *
 * Si algún dato existente no cumple una regla, la migración falla completa
 * (una sola transacción) y no cambia nada.
 */

const DUPLICADAS = [
  ['Categorias', 'Categorias_sucursal_id_fkey1'],
  ['Productos', 'Productos_sucursal_id_fkey1'],
  ['Pedidos', 'Pedidos_sucursal_id_fkey1']
];

const CHECKS = [
  ['Productos', 'productos_precio_positivo', 'precio > 0'],
  ['Productos', 'productos_stock_no_negativo', 'cantidad_disponible >= 0'],
  ['Productos', 'productos_imagen_codigo_formato', `imagen_codigo IS NULL OR imagen_codigo ~ '^[a-z0-9_]{1,60}$'`],
  ['DetallePedidos', 'detalle_cantidad_positiva', 'cantidad > 0'],
  ['DetallePedidos', 'detalle_montos_no_negativos', 'precio_unitario >= 0 AND subtotal >= 0'],
  ['Pedidos', 'pedidos_total_no_negativo', 'valor_total >= 0'],
  ['Pagos', 'pagos_valor_no_negativo', 'valor >= 0'],
  ['TransaccionesPayphone', 'payphone_monto_positivo', 'monto > 0'],
  ['CarritoItems', 'carrito_cantidad_rango', 'cantidad BETWEEN 1 AND 50'],
  ['CarritoItems', 'carrito_posicion_no_negativa', 'posicion >= 0'],
  ['FotosPerfil', 'fotos_tipo_permitido', `tipo IN ('image/jpeg', 'image/png', 'image/webp')`],
  ['Clientes', 'clientes_correo_minusculas', 'correo_electronico = lower(correo_electronico)'],
  ['Clientes', 'clientes_intentos_otp_no_negativos', 'reset_password_attempts >= 0'],
  ['Empleados', 'empleados_correo_minusculas', 'correo_electronico = lower(correo_electronico)'],
  ['Empleados', 'empleados_intentos_otp_no_negativos', 'reset_password_attempts >= 0']
];

module.exports = {
  async up(queryInterface) {
    const sql = (texto, t) => queryInterface.sequelize.query(texto, { transaction: t });
    const t = await queryInterface.sequelize.transaction();
    try {
      for (const [tabla, nombre] of DUPLICADAS) {
        await sql(`ALTER TABLE "${tabla}" DROP CONSTRAINT IF EXISTS "${nombre}"`, t);
      }

      for (const [tabla, nombre, regla] of CHECKS) {
        await sql(`ALTER TABLE "${tabla}" ADD CONSTRAINT "${nombre}" CHECK (${regla})`, t);
      }

      // Producto y categoría de la misma sucursal.
      await sql(`ALTER TABLE "Categorias" ADD CONSTRAINT "Categorias_id_sucursal_key" UNIQUE (id, sucursal_id)`, t);
      await sql(
        `ALTER TABLE "Productos" ADD CONSTRAINT "Productos_categoria_misma_sucursal_fkey"
         FOREIGN KEY (categoria_id, sucursal_id) REFERENCES "Categorias" (id, sucursal_id)
         ON UPDATE CASCADE ON DELETE RESTRICT`,
        t
      );

      // Empleado y sucursal del mismo restaurante (sin sucursal no se comprueba:
      // superadmin o administrador del restaurante).
      await sql(`ALTER TABLE "Sucursales" ADD CONSTRAINT "Sucursales_id_restaurante_key" UNIQUE (id, restaurante_id)`, t);
      await sql(
        `ALTER TABLE "Empleados" ADD CONSTRAINT "Empleados_sucursal_mismo_restaurante_fkey"
         FOREIGN KEY (sucursal_id, restaurante_id) REFERENCES "Sucursales" (id, restaurante_id)
         ON UPDATE CASCADE ON DELETE RESTRICT`,
        t
      );
      await sql(
        `ALTER TABLE "Empleados" ADD CONSTRAINT "empleados_sucursal_con_restaurante"
         CHECK (sucursal_id IS NULL OR restaurante_id IS NOT NULL)`,
        t
      );

      await sql(
        `CREATE INDEX "clientes_restaurantes_bloqueado_por" ON "ClientesRestaurantes" (bloqueado_por)`,
        t
      );
      await t.commit();
    } catch (error) {
      await t.rollback();
      throw error;
    }
  },

  // No vuelve a crear las FK duplicadas: eran un error.
  async down(queryInterface) {
    const sql = (texto, t) => queryInterface.sequelize.query(texto, { transaction: t });
    const t = await queryInterface.sequelize.transaction();
    try {
      await sql('DROP INDEX IF EXISTS "clientes_restaurantes_bloqueado_por"', t);
      await sql('ALTER TABLE "Empleados" DROP CONSTRAINT IF EXISTS "empleados_sucursal_con_restaurante"', t);
      await sql('ALTER TABLE "Empleados" DROP CONSTRAINT IF EXISTS "Empleados_sucursal_mismo_restaurante_fkey"', t);
      await sql('ALTER TABLE "Sucursales" DROP CONSTRAINT IF EXISTS "Sucursales_id_restaurante_key"', t);
      await sql('ALTER TABLE "Productos" DROP CONSTRAINT IF EXISTS "Productos_categoria_misma_sucursal_fkey"', t);
      await sql('ALTER TABLE "Categorias" DROP CONSTRAINT IF EXISTS "Categorias_id_sucursal_key"', t);
      for (const [tabla, nombre] of [...CHECKS].reverse()) {
        await sql(`ALTER TABLE "${tabla}" DROP CONSTRAINT IF EXISTS "${nombre}"`, t);
      }
      await t.commit();
    } catch (error) {
      await t.rollback();
      throw error;
    }
  }
};
