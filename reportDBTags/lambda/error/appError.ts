export class AppError extends Error {
  funcName: string;

  constructor(funcName: string, message: string) {
    super(message);
    this.funcName = funcName;
    this.name = "AppError";
  }
}
