import { SerializableValue } from "./common.js";
import { MAX_EVENT_ID_LENGTH } from "./constants.js";

export type ScriptEventListener<TPayload, TResponse> = (
  payload: TPayload
) => TResponse;

/**
 * @internal
 */
export const listeners = new Map<
  string,
  ScriptEventListener<any, SerializableValue>
>();

/**
 * Registers an IPC listener.
 * @param event The event ID.
 * @param callback The callback.
 * @throws Throws if another listener is registered for `event`.
 * @throws Throws if the event ID is longer than {@link MAX_EVENT_ID_LENGTH}
 */
export function registerListener<
  TPayload extends SerializableValue,
  TResponse extends SerializableValue,
>(event: string, callback: ScriptEventListener<TPayload, TResponse>): void {
  if (listeners.has(event)) {
    throw new Error(
      `can't register listener for event '${event}': a listener for this event has already been registered`
    );
  }
  if (event.length > MAX_EVENT_ID_LENGTH) {
    throw new Error(
      `can't register listener for event '${event}': '${event}' is longer than ${MAX_EVENT_ID_LENGTH.toString()}`
    );
  }
  listeners.set(event, callback);
}

/**
 * Removes a listener for an event.
 * @param event The event ID.
 * @returns Returns a boolean indicating whether the listener was removed or not.
 */
export function removeListener(event: string): boolean {
  return listeners.delete(event);
}
