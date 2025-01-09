import { system } from "@minecraft/server";
import { registerListener, removeListener } from "./listeners.js";
import { sendInternal, sendStreamInternal } from "./send.js";
import {
  checkNamespace,
  InternalInvokeOptions,
  InvokeOptions,
  IpcTypeFlag,
  SerializableValue,
} from "./common.js";
import { MAX_MESSAGE_LENGTH } from "./constants.js";
import { Failure } from "./failure.js";

/**
 * total number of invokes this session, used to create a unique response listener ID
 * @internal
 */
let invokeCount = 0;

/**
 * @internal
 */
function invokeInternal(
  options: InternalInvokeOptions
): Promise<SerializableValue> {
  checkNamespace(options.namespace);

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

      if (payload instanceof Failure && options.throwFailures) {
        reject(payload);
      } else {
        resolve(payload);
      }

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
 * @throws Throws if the message is too long.
 */
export function invoke(options: InvokeOptions): Promise<SerializableValue> {
  return invokeInternal({
    ...options,
    payload: JSON.stringify(options.payload),
  });
}

/**
 * @internal
 */
function invokeStreamInternal(
  options: InternalInvokeOptions
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

      if (payload instanceof Failure && options.throwFailures) {
        reject(payload);
      } else {
        resolve(payload);
      }

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
 * @throws Throws if the message is too long.
 */
export function invokeStream(
  options: InvokeOptions
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
 */
export function invokeAuto(options: InvokeOptions): Promise<SerializableValue> {
  const serialized = JSON.stringify(options.payload);
  if (serialized.length > MAX_MESSAGE_LENGTH) {
    return invokeStreamInternal({ ...options, payload: serialized });
  }
  return invokeInternal({ ...options, payload: serialized });
}
