import { system } from "@minecraft/server";
import { registerListener, removeListener } from "./listeners.js";
import { sendInternal, sendStreamInternal } from "./send.js";
import { IpcTypeFlag, SerializableValue } from "./common.js";
import { getNamespace } from "./init.js";
import { MAX_MESSAGE_LENGTH } from "./constants.js";

/**
 * total number of invokes this session, used to create a unique response listener ID
 * @internal
 */
let invokeCount = 0;

/**
 * @internal
 */
function invokeInternal(
  event: string,
  payload: string,
  force = false
): Promise<SerializableValue> {
  const namespace = getNamespace();

  // rl stands for response listener - we want to keep the event IDs short
  // because there is a command length limit
  const responseListenerId = `${namespace}:ipc.__rl${invokeCount.toString()}`;
  invokeCount++;

  return new Promise((resolve, reject) => {
    const timeoutId = system.runTimeout(() => {
      removeListener(responseListenerId);
      reject(
        new Error(`invoke '${event}' timed out: did not recieve a response`)
      );
    }, 20);

    registerListener(responseListenerId, (payload) => {
      removeListener(responseListenerId);
      system.clearRun(timeoutId);
      resolve(payload);
      return null;
    });

    sendInternal(
      IpcTypeFlag.Invoke,
      event,
      `${responseListenerId} ${payload}`,
      force
    );
  });
}

/**
 * Send a two-way IPC event.
 * @param event The event ID.
 * @param payload The payload. Ensure this can be serialized to JSON, otherwise some data may be lost.
 * @param force Ignore errors, not including timeout.
 * @returns Returns whatever the listener returns.
 * @throws Throws if a response is not recieved within 20 game ticks.
 */
export function invoke(
  event: string,
  payload: SerializableValue,
  force = false
): Promise<SerializableValue> {
  return invokeInternal(event, JSON.stringify(payload), force);
}

/**
 * @internal
 */
function invokeStreamInternal(
  event: string,
  payload: string,
  force = false
): Promise<SerializableValue> {
  const namespace = getNamespace();

  const responseListenerId = `${namespace}:ipc.__rl${invokeCount.toString()}`;
  invokeCount++;

  let timeoutId: number | undefined;

  return new Promise((resolve, reject) => {
    registerListener(responseListenerId, (payload) => {
      removeListener(responseListenerId);
      if (timeoutId !== undefined) {
        system.clearRun(timeoutId);
      }
      resolve(payload);
      return null;
    });

    void sendStreamInternal(
      IpcTypeFlag.InvokeStream,
      event,
      `${responseListenerId} ${payload}`,
      force
    ).then(() => {
      timeoutId = system.runTimeout(() => {
        removeListener(responseListenerId);
        reject(
          new Error(`invoke '${event}' timed out: did not recieve a response`)
        );
      }, 20);
    });
  });
}

/**
 * Stream a two-way IPC event. The payload has no max length since it is streamed.
 * @param event The event ID.
 * @param payload The payload. Ensure this can be serialized to JSON, otherwise some data may be lost.
 * @param force Ignore errors, not including timeout.
 * @returns Returns whatever the listener returns.
 * @throws Throws if a response is not recieved within 20 game ticks (after the entire payload has been streamed).
 */
export function invokeStream(
  event: string,
  payload: SerializableValue,
  force = false
): Promise<SerializableValue> {
  return invokeStreamInternal(event, JSON.stringify(payload), force);
}

/**
 * Send or stream a two-way IPC event. If the payload is greater than the max length then it will be streamed.
 * @param event The event ID.
 * @param payload The payload. Ensure this can be serialized to JSON, otherwise some data may be lost.
 * @param force Ignore errors, not including timeout.
 * @returns Returns whatever the target listener returns.
 * @throws Throws if the event ID is longer than {@link MAX_EVENT_ID_LENGTH}.
 * @throws Throws if the serialized payload is longer than {@link MAX_MESSAGE_LENGTH}.
 * @throws Throws if a response is not recieved within 20 game ticks (after the entire payload has been streamed).
 */
export function invokeAuto(
  event: string,
  payload: SerializableValue,
  force = false
): Promise<SerializableValue> {
  const serialized = JSON.stringify(payload);
  if (serialized.length > MAX_MESSAGE_LENGTH) {
    return invokeStreamInternal(event, serialized, force);
  }
  return invokeInternal(event, serialized, force);
}
