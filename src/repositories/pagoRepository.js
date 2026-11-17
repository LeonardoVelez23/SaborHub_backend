import { sinDuplicados } from '../errors/RegistroDuplicado.js';
import { filtroSucursal } from './alcance.js';

const PEDIDO_RESUMEN = ['id', 'fecha', 'valor_total', 'estado'];

/** Acceso a Pagos. */
export const crearPagoRepository = (m) => ({
  /** Del alcance: los pagos se filtran por la sucursal de su pedido. */
  listar: (alcance) =>
    m.Pago.findAll({
      include: {
        model: m.Pedido,
        as: 'pedido',
        attributes: ['id', 'fecha', 'hora', 'valor_total', 'estado', 'modalidad'],
        where: filtroSucursal(alcance),
        required: true,
        include: { model: m.Cliente, as: 'cliente', attributes: ['id', 'nombres', 'apellidos', 'identificacion'] }
      },
      order: [['fecha', 'DESC']]
    }),

  /** Pagos de los pedidos de un cliente, del más reciente al más antiguo. */
  listarDeCliente: (clienteId) =>
    m.Pago.findAll({
      attributes: ['id', 'fecha', 'valor', 'metodo_pago', 'numero_referencia', 'estado'],
      include: {
        model: m.Pedido,
        as: 'pedido',
        attributes: ['id', 'fecha', 'hora', 'estado', 'valor_total', 'sucursal_id'],
        where: { cliente_id: clienteId },
        required: true,
        include: {
          model: m.Sucursal,
          as: 'sucursal',
          attributes: ['id', 'nombre'],
          include: { model: m.Restaurante, as: 'restaurante', attributes: ['id', 'nombre'] }
        }
      },
      order: [['fecha', 'DESC'], ['id', 'DESC']]
    }),

  /** Con el pedido y su cliente (para comprobar de quién es). */
  buscarDetallado: (id, alcance) =>
    m.Pago.findByPk(id, {
      include: {
        model: m.Pedido,
        as: 'pedido',
        attributes: ['id', 'fecha', 'hora', 'valor_total', 'estado', 'modalidad', 'cliente_id'],
        where: filtroSucursal(alcance),
        required: true,
        include: {
          model: m.Cliente,
          as: 'cliente',
          attributes: ['id', 'nombres', 'apellidos', 'identificacion', 'correo_electronico']
        }
      }
    }),

  /** Con el resumen del pedido (respuesta de crear y actualizar). */
  buscarConResumen: (id) =>
    m.Pago.findByPk(id, { include: { model: m.Pedido, as: 'pedido', attributes: PEDIDO_RESUMEN } }),

  /** Con el pedido completo (para validar contra su total y estado). */
  buscarConPedido: (id, alcance) =>
    m.Pago.findByPk(id, { include: { model: m.Pedido, as: 'pedido', where: filtroSucursal(alcance), required: true } }),

  buscar: (id, alcance) =>
    m.Pago.findByPk(id, {
      include: { model: m.Pedido, as: 'pedido', attributes: ['id'], where: filtroSucursal(alcance), required: true }
    }),

  delPedido: (pedidoId, alcance) =>
    m.Pago.findOne({
      where: { pedido_id: pedidoId },
      include: {
        model: m.Pedido,
        as: 'pedido',
        attributes: PEDIDO_RESUMEN,
        where: filtroSucursal(alcance),
        required: true
      }
    }),

  existeDelPedido: async (pedidoId) => Boolean(await m.Pago.findOne({ where: { pedido_id: pedidoId } })),

  aprobadoDelPedido: (pedidoId) => m.Pago.findOne({ where: { pedido_id: pedidoId, estado: 'aprobado' } }),

  contarDelPedido: (pedidoId, t) => m.Pago.count({ where: { pedido_id: pedidoId }, transaction: t }),

  /** Pago del pedido bloqueado hasta terminar `t` (o null). */
  bloquearDelPedido: (pedidoId, t) =>
    m.Pago.findOne({ where: { pedido_id: pedidoId }, lock: t.LOCK.UPDATE, transaction: t }),

  crear: (datos, t) => sinDuplicados(() => (t ? m.Pago.create(datos, { transaction: t }) : m.Pago.create(datos))),

  actualizar: (pago, datos, t) => (t ? pago.update(datos, { transaction: t }) : pago.update(datos)),

  eliminar: (pago) => pago.destroy()
});
