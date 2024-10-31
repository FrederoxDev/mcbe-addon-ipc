import { MAX_NAMESPACE_LENGTH } from "./constants.js";

let initNamespace: string | undefined;

/**
 * Initialize the library. Some functions require this to be called.
 * @param namespace The namespace of this add-on to use in script event IDs. Must be less than {@link MAX_NAMESPACE_LENGTH} characters.
 */
export function init(namespace: string): void {
  if (initNamespace !== undefined) {
    throw new Error("Library already initialized.");
  }
  if (!namespace || namespace.length > MAX_NAMESPACE_LENGTH) {
    throw new Error(
      `Namespace must be at least one character and less than ${MAX_NAMESPACE_LENGTH.toString()} characters.`
    );
  }
  initNamespace = namespace;
}

/**
 * @returns Returns a boolean indicating if {@link init} has been called.
 */
export function isInitialized(): boolean {
  return !!initNamespace;
}

/**
 * Get the namespace supplied to {@link init}.
 * @throws Throws if {@link init} was not called.
 */
export function getNamespace(): string {
  if (!initNamespace) {
    throw new Error("Library not initialized.");
  }
  return initNamespace;
}
