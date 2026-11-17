/** Foto de perfil del cliente (una por cliente). */
export const crearFotoPerfilRepository = (m) => ({
  buscar: (clienteId) => m.FotoPerfil.findByPk(clienteId),

  /** Crea o reemplaza; devuelve la fecha de actualización. */
  guardar: async (clienteId, datos, tipo) => {
    await m.FotoPerfil.upsert({ cliente_id: clienteId, datos, tipo });
    const foto = await m.FotoPerfil.findByPk(clienteId, { attributes: ['updatedAt'] });
    return foto.updatedAt;
  },

  eliminar: (clienteId, t) =>
    m.FotoPerfil.destroy({ where: { cliente_id: clienteId }, ...(t && { transaction: t }) })
});
