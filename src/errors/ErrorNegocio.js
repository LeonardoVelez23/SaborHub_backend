/**
 * Regla de negocio incumplida. Los servicios la lanzan con el código HTTP
 * que corresponde y el errorHandler responde `{success: false, message}`
 * con ese código. Así los servicios no conocen Express.
 *
 * `codigo` (opcional) es un identificador estable para que la app reaccione
 * sin depender del texto (p. ej. `codigo_invalido`), y `datos` lo que
 * necesita para hacerlo; ambos se agregan a la respuesta.
 */
export class ErrorNegocio extends Error {
  constructor(message, status = 400, { codigo, datos } = {}) {
    super(message);
    this.name = 'ErrorNegocio';
    this.status = status;
    if (codigo) this.codigo = codigo;
    if (datos) this.datos = datos;
  }
}
