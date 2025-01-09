import { system } from "@minecraft/server";
import {
  InternalSendOptions,
  IpcTypeFlag,
  overworld,
  SendOptions,
  SendOptionsWithNamespace,
} from "./common.js";
import { MAX_MESSAGE_LENGTH, STREAM_MESSAGE_PADDING } from "./constants.js";

/**
 * @internal
 */
function sendRaw(event: string, message: string): void {
  overworld.runCommand(`scriptevent ${event} ${message}`);
}

/**
 * @internal
 */
export function sendInternal(
  flag: IpcTypeFlag,
  options: InternalSendOptions
): void {
  if (!options.force) {
    if (options.payload.length > MAX_MESSAGE_LENGTH) {
      throw new Error(
        `can't send event with a message longer than ${MAX_MESSAGE_LENGTH.toString()} characters`
      );
    }
  }

  sendRaw(options.event, flag + options.payload);
}

/**
 * Send a one-way IPC event.
 * @throws Throws if the message is too long.
 */
export function send(options: SendOptions): void {
  sendInternal(IpcTypeFlag.Send, {
    ...options,
    payload: JSON.stringify(options.payload),
  });
}

// total number of streams this session, used to create a unique stream ID
let streamCount = 0;

/**
 * @internal
 */
function* streamGenerator(
  flag: IpcTypeFlag,
  event: string,
  streamId: string,
  parts: string[],
  callback: () => void,
  force?: boolean
): Generator<void, void, void> {
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    const isLastPart = i >= parts.length - 1;

    sendInternal(flag, {
      event,
      payload: `${streamId} ${isLastPart ? "t" : "f"} ${part}`,
      force,
    });

    yield;
  }

  callback();
}

/**
 * @internal
 */
export function sendStreamInternal(
  flag: IpcTypeFlag,
  event: string,
  payload: string,
  namespace: string,
  force = false
): Promise<void> {
  const streamId = namespace + streamCount.toString();
  streamCount++;

  const parts = [payload];

  const maxMessageLengthWithPadding =
    MAX_MESSAGE_LENGTH - STREAM_MESSAGE_PADDING;

  for (;;) {
    const lastPart = parts.at(-1)!;

    if (lastPart.length <= maxMessageLengthWithPadding) {
      break;
    }

    const left = lastPart.slice(0, maxMessageLengthWithPadding);
    const right = lastPart.slice(maxMessageLengthWithPadding);

    parts[parts.length - 1] = left;
    if (right.length) {
      parts.push(right);
    }
  }

  return new Promise((resolve) => {
    system.runJob(
      streamGenerator(flag, event, streamId, parts, resolve, force)
    );
  });
}

/**
 * Stream a one-way IPC event. The payload has no max length, since it is streamed.
 */
export function sendStream(options: SendOptionsWithNamespace): Promise<void> {
  return sendStreamInternal(
    IpcTypeFlag.SendStream,
    options.event,
    JSON.stringify(options.payload),
    options.namespace,
    options.force
  );
}

/**
 * Send or stream a one-way IPC event. If the payload is greater than the max length then it will be streamed.
 */
export async function sendAuto(
  options: SendOptionsWithNamespace
): Promise<void> {
  const serialized = JSON.stringify(options.payload);
  if (serialized.length > MAX_MESSAGE_LENGTH) {
    return sendStreamInternal(
      IpcTypeFlag.SendStream,
      options.event,
      serialized,
      options.namespace,
      options.force
    );
  }
  sendInternal(IpcTypeFlag.Send, {
    ...options,
    payload: serialized,
  });
}
