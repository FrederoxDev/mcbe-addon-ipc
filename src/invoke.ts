import { system } from "@minecraft/server";
import { sendInternal, sendStreamInternal } from "./send.js";
import {
  InternalInvokeOptions,
  InvokeOptions,
  IpcTypeFlag,
  SerializableValue,
} from "./common.js";
import { Failure } from "./failure.js";
import { Router } from "./router.js";

/**
 * @internal
 */
export function invokeInternal(
  options: InternalInvokeOptions,
  router: Router,
  responseListenerId: string
): Promise<SerializableValue> {
  return new Promise((resolve, reject) => {
    const timeoutId = system.runTimeout(() => {
      router.removeListener(responseListenerId);
      reject(
        new Error(
          `invoke '${options.event}' timed out: did not recieve a response`
        )
      );
    }, 20);

    router.registerListener(responseListenerId, (payload) => {
      router.removeListener(responseListenerId);
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
 * @internal
 */
export function invoke(
  options: InvokeOptions,
  router: Router,
  responseListenerId: string
): Promise<SerializableValue> {
  return invokeInternal(
    {
      ...options,
      payload: JSON.stringify(options.payload),
    },
    router,
    responseListenerId
  );
}

/**
 * @internal
 */
export function invokeStreamInternal(
  options: InternalInvokeOptions,
  router: Router,
  responseListenerId: string,
  streamId: string
): Promise<SerializableValue> {
  let timeoutId: number | undefined;

  return new Promise((resolve, reject) => {
    router.registerListener(responseListenerId, (payload) => {
      router.removeListener(responseListenerId);
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
      streamId,
      options.force
    ).finally(() => {
      timeoutId = system.runTimeout(() => {
        router.removeListener(responseListenerId);
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
 * @internal
 */
export function invokeStream(
  options: InvokeOptions,
  router: Router,
  responseListenerId: string,
  streamId: string
): Promise<SerializableValue> {
  return invokeStreamInternal(
    {
      ...options,
      payload: JSON.stringify(options.payload),
    },
    router,
    responseListenerId,
    streamId
  );
}
