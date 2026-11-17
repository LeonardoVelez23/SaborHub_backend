/** Credenciales del ingreso con huella (una por dispositivo). */
export const crearCredencialRepository = (m) => ({
  crear: (datos) => m.CredencialBiometrica.create(datos),

  buscar: (id) => m.CredencialBiometrica.findByPk(id),

  /** Deja solo las `maximo` más recientes del cliente. */
  conservarRecientes: async (clienteId, maximo) => {
    const sobrantes = await m.CredencialBiometrica.findAll({
      where: { cliente_id: clienteId },
      order: [['ultimo_uso', 'DESC'], ['id', 'DESC']],
      offset: maximo,
      attributes: ['id']
    });
    if (sobrantes.length > 0) {
      await m.CredencialBiometrica.destroy({ where: { id: sobrantes.map((c) => c.id) } });
    }
  },

  /**
   * Cambia el hash solo si sigue siendo `hashAnterior` (nadie la usó a la
   * vez). Devuelve true si la cambió.
   */
  rotar: async (id, hashAnterior, datos) => {
    const [actualizadas] = await m.CredencialBiometrica.update(datos, {
      where: { id, token_hash: hashAnterior }
    });
    return actualizadas === 1;
  },

  eliminar: (credencial) => credencial.destroy(),

  eliminarDeCliente: (id, clienteId) => m.CredencialBiometrica.destroy({ where: { id, cliente_id: clienteId } })
});
