import { system } from "@minecraft/server";
import { registerListener, removeListener } from "./listeners.js";
import { sendInternal, sendStreamInternal } from "./send.js";
import {
  checkNamespace,
  InternalSendOptionsWithNamespace,
  IpcTypeFlag,
  SendOptionsWithNamespace,
  SerializableValue,
} from "./common.js";
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
  options: InternalSendOptionsWithNamespace
): Promise<SerializableValue> {
  checkNamespace(options.namespace);

  // rl stands for response listener - we want to keep the event IDs short
  // because there is a command length limit
  const responseListenerId = `${options.namespace}:ipc.__rl${invokeCount.toString()}`;
  invokeCount++;

  return new Promise((resolve, reject) => {
    const timeoutId = system.runTimeout(() => {
      removeListener(responseListenerId);
      reject(
        new Error(
          `invoke '${options.event}' timed out: did not recieve a response`
        )
      );
    }, 20);

    registerListener(responseListenerId, (payload) => {
      removeListener(responseListenerId);
      system.clearRun(timeoutId);
      resolve(payload);
      return null;
    });

    sendInternal(IpcTypeFlag.Invoke, {
      ...options,
      payload: `${responseListenerId} ${options.payload}`,
    });
  });
}

/**
 * Send a two-way IPC event.
 * @returns Returns whatever the listener returns.
 * @throws Throws if a response is not recieved within 20 game ticks.
 * @throws Throws if the namespace is too long.
 * @throws Throws if the event ID is too long.
 * @throws Throws if the message is too long.
 */
export function invoke(
  options: SendOptionsWithNamespace
): Promise<SerializableValue> {
  return invokeInternal({
    ...options,
    payload: JSON.stringify(options.payload),
  });
}

/**
 * @internal
 */
function invokeStreamInternal(
  options: InternalSendOptionsWithNamespace
): Promise<SerializableValue> {
  checkNamespace(options.namespace);

  const responseListenerId = `${options.namespace}:ipc.__rl${invokeCount.toString()}`;
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
      options.event,
      `${responseListenerId} ${options.payload}`,
      options.namespace,
      options.force
    ).finally(() => {
      timeoutId = system.runTimeout(() => {
        removeListener(responseListenerId);
        reject(
          new Error(
            `invoke '${options.event}' timed out: did not recieve a response`
          )
        );
      }, 20);
    });
  });
}

/**
 * Stream a two-way IPC event. The payload has no max length since it is streamed.
 * @returns Returns whatever the listener returns.
 * @throws Throws if a response is not recieved within 20 game ticks (after the entire payload has been streamed).
 * @throws Throws if the namespace is too long.
 * @throws Throws if the event ID is too long.
 * @throws Throws if the message is too long.
 */
export function invokeStream(
  options: SendOptionsWithNamespace
): Promise<SerializableValue> {
  return invokeStreamInternal({
    ...options,
    payload: JSON.stringify(options.payload),
  });
}

/**
 * Send or stream a two-way IPC event. If the payload is greater than the max length then it will be streamed.
 * @returns Returns whatever the target listener returns.
 * @throws Throws if a response is not recieved within 20 game ticks (after the entire payload has been streamed).
 * @throws Throws if the namespace is too long.
 * @throws Throws if the event ID is too long.
 * @throws Throws if the message is too long.
 */
export function invokeAuto(
  options: SendOptionsWithNamespace
): Promise<SerializableValue> {
  const serialized = JSON.stringify(options.payload);
  if (serialized.length > MAX_MESSAGE_LENGTH) {
    return invokeStreamInternal({ ...options, payload: serialized });
  }
  return invokeInternal({ ...options, payload: serialized });
}
