import { Op } from 'sequelize';
import { sequelize, CarritoItem, Producto } from '../models/index.js';

/** Igual que en los pedidos (RN-06). */
const MAX_POR_PRODUCTO = 50;
const MAX_PRODUCTOS = 100;

const ATRIBUTOS_PRODUCTO = ['id', 'nombre', 'precio', 'cantidad_disponible', 'estado', 'imagen_codigo'];

/** Carrito del cliente con los datos vigentes de cada producto. */
const leerCarrito = async (clienteId) => {
  const items = await CarritoItem.findAll({
    where: { cliente_id: clienteId },
    include: { model: Producto, as: 'producto', attributes: ATRIBUTOS_PRODUCTO },
    order: [['posicion', 'ASC'], ['producto_id', 'ASC']]
  });
  return {
    items: items.map((item) => ({
      producto_id: item.producto_id,
      cantidad: item.cantidad,
      producto: item.producto
    }))
  };
};

/** Valida `items` del cuerpo; devuelve el mensaje de error o null. */
const errorEnItems = (items) => {
  if (!Array.isArray(items)) return 'items debe ser una lista';
  if (items.length > MAX_PRODUCTOS) return `El carrito admite como máximo ${MAX_PRODUCTOS} productos`;
  const vistos = new Set();
  for (const item of items) {
    const { producto_id: id, cantidad } = item ?? {};
    if (!Number.isInteger(id) || id <= 0) return 'producto_id debe ser un entero positivo';
    if (!Number.isInteger(cantidad) || cantidad < 1 || cantidad > MAX_POR_PRODUCTO) {
      return `La cantidad de cada producto debe ser un entero entre 1 y ${MAX_POR_PRODUCTO}`;
    }
    if (vistos.has(id)) return 'Un producto aparece más de una vez en el carrito';
    vistos.add(id);
  }
  return null;
};

export const getCarrito = async (req, res, next) => {
  try {
    res.status(200).json({ success: true, data: await leerCarrito(req.user.id) });
  } catch (error) {
    next(error);
  }
};

/**
 * Reemplaza el carrito completo por el que envía la app (la última versión
 * gana). Los productos que ya no existen se ignoran; el stock y la
 * disponibilidad se validan al crear el pedido.
 */
export const putCarrito = async (req, res, next) => {
  try {
    const { items } = req.body ?? {};
    const error = errorEnItems(items);
    if (error) return res.status(400).json({ success: false, message: error });

    const clienteId = req.user.id;
    const existentes = new Set(
      (await Producto.findAll({
        where: { id: { [Op.in]: items.map((i) => i.producto_id) } },
        attributes: ['id']
      })).map((p) => p.id)
    );

    await sequelize.transaction(async (transaction) => {
      await CarritoItem.destroy({ where: { cliente_id: clienteId }, transaction });
      await CarritoItem.bulkCreate(
        items
          .filter((i) => existentes.has(i.producto_id))
          .map((i, posicion) => ({
            cliente_id: clienteId,
            producto_id: i.producto_id,
            cantidad: i.cantidad,
            posicion
          })),
        { transaction }
      );
    });

    res.status(200).json({ success: true, data: await leerCarrito(clienteId) });
  } catch (error) {
    next(error);
  }
};
