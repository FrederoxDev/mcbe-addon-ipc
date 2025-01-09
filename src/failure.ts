/**
 * An error object that can be returned from IPC listeners.
 * @remarks
 * This will automatically be logged as a warning if the listener is not invoked because values can only be returned on invoke.
 * @example
 * ```ts
 * ipc.registerListener("example:alwaysError", () => {
 *  // do something ...
 *  return new ipc.Failure("An error has occured.");
 * })
 * ```
 */
export class Failure extends Error {
  constructor(message: string) {
    super(message);
    this.name = "Failure";
  }
}
