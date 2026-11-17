/**
 * Los repositorios buscan con `findOne({ where: { id, ...alcance } })` para
 * filtrar por sucursal (RN-21). En estas pruebas los modelos son simulados:
 * `findOne` con `where.id` responde lo que diga `findByPk`, así cada prueba
 * sigue configurando una sola función.
 */
export const delegarFindOne = (...modelos) => {
  for (const modelo of modelos) {
    const original = modelo.findOne.getMockImplementation();
    modelo.findOne.mockImplementation(async (opciones) =>
      opciones?.where?.id !== undefined ? modelo.findByPk(opciones.where.id) : original?.(opciones)
    );
  }
};
