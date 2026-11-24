import { QueryTypes } from 'sequelize';
import { sinDuplicados } from '../errors/RegistroDuplicado.js';
import { filtroSucursal, porId } from './alcance.js';

/** Acceso a Mesas (DERCAS M9, RN-39). `m` son los modelos. */
export const crearMesaRepository = (m) => ({
  /** Mesas de la sucursal por nombre (orden natural: "Mesa 2" antes que "Mesa 10"). */
  listar: (sucursalId, { incluirInactivas = false } = {}) =>
    m.Mesa.findAll({
      where: { sucursal_id: sucursalId, ...(incluirInactivas ? {} : { activa: true }) },
      order: [
        [m.sequelize.fn('length', m.sequelize.col('nombre')), 'ASC'],
        ['nombre', 'ASC']
      ]
    }),

  /**
   * Por mesa: pedidos abiertos (no cancelados y que no estén entregados
   * con pago aprobado) y la suma de su total. Map mesa_id → {pedidos, total}.
   */
  abiertos: async (mesaIds) => {
    if (mesaIds.length === 0) return new Map();
    const filas = await m.sequelize.query(
      `SELECT p.mesa_id, COUNT(*)::int AS pedidos, COALESCE(SUM(p.valor_total), 0) AS total
         FROM "Pedidos" p
        WHERE p.mesa_id IN (:mesaIds)
          AND p.estado <> 'cancelado'
          AND NOT (p.estado = 'entregado' AND EXISTS (
                SELECT 1 FROM "Pagos" g WHERE g.pedido_id = p.id AND g.estado = 'aprobado'))
        GROUP BY p.mesa_id`,
      { replacements: { mesaIds }, type: QueryTypes.SELECT }
    );
    return new Map(filas.map((f) => [f.mesa_id, { pedidos: f.pedidos, total: Number(f.total) }]));
  },

  /** Una mesa dentro del alcance del personal (o null). */
  buscar: (id, alcance) => m.Mesa.findOne({ where: porId(id, filtroSucursal(alcance)) }),

  crear: (datos) => sinDuplicados(() => m.Mesa.create(datos)),

  actualizar: (mesa, datos) => sinDuplicados(() => mesa.update(datos)),

  contarPedidos: (mesaId) => m.Pedido.count({ where: { mesa_id: mesaId } }),

  eliminar: (mesa) => mesa.destroy()
});
