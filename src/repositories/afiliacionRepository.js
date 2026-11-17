import { Op } from 'sequelize';

const DATOS_CLIENTE = ['id', 'identificacion', 'nombres', 'apellidos', 'correo_electronico', 'telefono', 'tipo_cliente'];
const DATOS_AFILIACION = ['restaurante_id', 'estado', 'origen', 'afiliado_en', 'bloqueado_en', 'motivo_bloqueo'];

/**
 * Afiliaciones de clientes a restaurantes (DERCAS 12, RF-43 a RF-45). Los
 * filtros por restaurante salen del servicio, que los toma de la sesión
 * (RN-26), nunca de la petición.
 */
export const crearAfiliacionRepository = (m) => ({
  buscar: (clienteId, restauranteId, t) =>
    m.ClienteRestaurante.findOne({
      where: { cliente_id: clienteId, restaurante_id: restauranteId },
      ...(t && { transaction: t, lock: t.LOCK.UPDATE })
    }),

  crear: (datos, t) => m.ClienteRestaurante.create(datos, t ? { transaction: t } : {}),

  actualizar: (fila, datos, t) => fila.update(datos, t ? { transaction: t } : {}),

  /** Las del cliente con el nombre del restaurante (Mis restaurantes). */
  delCliente: (clienteId) =>
    m.ClienteRestaurante.findAll({
      where: { cliente_id: clienteId },
      attributes: ['restaurante_id', 'estado', 'origen', 'legal_version', 'afiliado_en'],
      include: { model: m.Restaurante, as: 'restaurante', attributes: ['id', 'nombre', 'estado'] },
      order: [['afiliado_en', 'DESC']]
    }),

  /**
   * Clientes activos (sin eliminar) con afiliación activa o bloqueada en el
   * restaurante, con esa afiliación. Sin restaurante (superadmin), todos.
   */
  clientes: (restauranteId) =>
    m.Cliente.findAll({
      where: { eliminado_en: null },
      attributes: DATOS_CLIENTE,
      include: restauranteId
        ? {
            model: m.ClienteRestaurante,
            as: 'afiliaciones',
            required: true,
            attributes: DATOS_AFILIACION,
            where: { restaurante_id: restauranteId, estado: { [Op.in]: ['activo', 'bloqueado'] } }
          }
        : undefined,
      order: [['apellidos', 'ASC'], ['nombres', 'ASC']]
    }),

  /** Un cliente activo por identificación o correo exactos. */
  porIdentificacionOCorreo: (valor) =>
    m.Cliente.findOne({
      where: {
        eliminado_en: null,
        [Op.or]: [{ identificacion: valor }, { correo_electronico: valor.toLowerCase() }]
      },
      attributes: ['id', 'nombres', 'apellidos']
    }),

  /** Al eliminar la cuenta: ningún restaurante conserva el consentimiento. */
  eliminarDelCliente: (clienteId, t) =>
    m.ClienteRestaurante.destroy({ where: { cliente_id: clienteId }, transaction: t })
});
