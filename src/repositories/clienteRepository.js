import { sinDuplicados } from '../errors/RegistroDuplicado.js';

const SIN_CONTRASENIA = { exclude: ['contrasenia'] };

/** Acceso a Clientes. `m` son los modelos (se leen al usarse). */
export const crearClienteRepository = (m) => ({
  /** Sin las cuentas eliminadas, por apellidos y nombres. */
  listarActivos: () =>
    m.Cliente.findAll({
      where: { eliminado_en: null },
      attributes: SIN_CONTRASENIA,
      order: [['apellidos', 'ASC'], ['nombres', 'ASC']]
    }),

  buscar: (id) => m.Cliente.findByPk(id),

  buscarSinContrasenia: (id) => m.Cliente.findByPk(id, { attributes: SIN_CONTRASENIA }),

  /** Con la fecha de su foto de perfil (`foto.updatedAt`), si tiene. */
  buscarConFoto: (id) =>
    m.Cliente.findByPk(id, {
      attributes: SIN_CONTRASENIA,
      include: { model: m.FotoPerfil, as: 'foto', attributes: ['updatedAt'] }
    }),

  bloquear: (id, t) => m.Cliente.findByPk(id, { lock: t.LOCK.UPDATE, transaction: t }),

  crear: (datos) => sinDuplicados(() => m.Cliente.create(datos)),

  actualizar: (cliente, datos, t) =>
    sinDuplicados(() => (t ? cliente.update(datos, { transaction: t }) : cliente.update(datos))),

  eliminar: (cliente) => cliente.destroy()
});
