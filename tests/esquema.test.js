import { beforeEach, describe, expect, it } from 'vitest';
import { Categoria, sequelize } from '../src/models/index.js';
import { crearCliente, crearEmpleado, crearProducto, crearSucursal, limpiarBase } from './helpers.js';

/**
 * Integridad del esquema (migración 20261118000002, DERCAS 13.3.3): la base
 * rechaza por sí misma los datos inválidos, aunque no pasen por el backend.
 */
describe('Integridad del esquema', () => {
  beforeEach(limpiarBase);

  const sql = (texto, replacements = {}) => sequelize.query(texto, { replacements });
  const rechaza = (promesa, restriccion) => expect(promesa).rejects.toThrow(new RegExp(restriccion));

  it('no hay claves foráneas duplicadas', async () => {
    const [filas] = await sql(`
      SELECT conrelid::regclass::text AS tabla, pg_get_constraintdef(oid) AS def, count(*)::int AS n
      FROM pg_constraint WHERE contype = 'f' AND connamespace = 'public'::regnamespace
      GROUP BY 1, 2 HAVING count(*) > 1`);
    expect(filas).toEqual([]);
  });

  it('producto: precio positivo, stock no negativo y código de imagen válido', async () => {
    const p = await crearProducto();
    await rechaza(sql('UPDATE "Productos" SET precio = 0 WHERE id = :id', { id: p.id }), 'productos_precio_positivo');
    await rechaza(
      sql('UPDATE "Productos" SET cantidad_disponible = -1 WHERE id = :id', { id: p.id }),
      'productos_stock_no_negativo'
    );
    await rechaza(
      sql(`UPDATE "Productos" SET imagen_codigo = 'Con Espacios' WHERE id = :id`, { id: p.id }),
      'productos_imagen_codigo_formato'
    );
  });

  it('un producto no puede usar una categoría de otra sucursal', async () => {
    const p = await crearProducto();
    const otra = await crearSucursal({ nueva: true });
    const ajena = await Categoria.create({ nombre: 'Ajena', sucursal_id: otra.id });
    await rechaza(
      sql('UPDATE "Productos" SET categoria_id = :c WHERE id = :id', { c: ajena.id, id: p.id }),
      'Productos_categoria_misma_sucursal_fkey'
    );
  });

  it('un empleado no puede tener una sucursal de otro restaurante', async () => {
    const empleado = await crearEmpleado('mesero');
    const otra = await crearSucursal({ nueva: true });
    await rechaza(
      sql('UPDATE "Empleados" SET sucursal_id = :s WHERE id = :id', { s: otra.id, id: empleado.id }),
      'Empleados_sucursal_mismo_restaurante_fkey'
    );
  });

  it('correos en minúsculas y carrito de 1 a 50', async () => {
    const cliente = await crearCliente();
    await rechaza(
      sql(`UPDATE "Clientes" SET correo_electronico = 'Ana@X.COM' WHERE id = :id`, { id: cliente.id }),
      'clientes_correo_minusculas'
    );
    const p = await crearProducto();
    await rechaza(
      sql(
        `INSERT INTO "CarritoItems" (cliente_id, producto_id, cantidad, posicion, "createdAt", "updatedAt")
         VALUES (:c, :p, 51, 0, now(), now())`,
        { c: cliente.id, p: p.id }
      ),
      'carrito_cantidad_rango'
    );
  });
});
