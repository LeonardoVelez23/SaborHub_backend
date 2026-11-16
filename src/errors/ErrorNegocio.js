/**
 * Regla de negocio incumplida. Los servicios la lanzan con el código HTTP
 * que corresponde y el errorHandler responde `{success: false, message}`
 * con ese código. Así los servicios no conocen Express.
 */
export class ErrorNegocio extends Error {
  constructor(message, status = 400) {
    super(message);
    this.name = 'ErrorNegocio';
    this.status = status;
  }
}
