import { system } from "@minecraft/server";
import { IpcTypeFlag, overworld, SerializableValue } from "./common.js";
import {
  MAX_EVENT_ID_LENGTH,
  MAX_MESSAGE_LENGTH,
  STREAM_MESSAGE_PADDING,
} from "./constants.js";
import { getNamespace } from "./init.js";

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
  event: string,
  payload: string,
  force = false
): void {
  if (!force) {
    if (event.length > MAX_EVENT_ID_LENGTH) {
      throw new Error(
        `can't send event '${event}' as the event ID is more than ${MAX_EVENT_ID_LENGTH.toString()}`
      );
    }

    if (payload.length > MAX_MESSAGE_LENGTH) {
      throw new Error(
        `can't send event with a message longer than ${MAX_MESSAGE_LENGTH.toString()} characters`
      );
    }
  }

  sendRaw(event, flag + payload);
}

/**
 * Send a one-way IPC event.
 * @param event The event ID.
 * @param payload The payload. Ensure this can be serialized to JSON, otherwise some data may be lost.
 * @param force Ignore errors.
 * @throws Throws if the event ID is longer than {@link MAX_EVENT_ID_LENGTH}
 * @throws Throws if the serialized payload is longer than {@link MAX_MESSAGE_LENGTH}
 */
export function send(
  event: string,
  payload: SerializableValue,
  force = false
): void {
  sendInternal(IpcTypeFlag.Send, event, JSON.stringify(payload), force);
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

    sendInternal(
      flag,
      event,
      `${streamId} ${isLastPart ? "t" : "f"} ${part}`,
      force
    );

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
  force = false
): Promise<void> {
  const namespace = getNamespace();

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
 * @param event The event ID.
 * @param payload The payload. Ensure this can be serialized to JSON, otherwise some data may be lost.
 * @param force Ignore errors.
 */
export function sendStream(
  event: string,
  payload: SerializableValue,
  force = false
): Promise<void> {
  return sendStreamInternal(
    IpcTypeFlag.SendStream,
    event,
    JSON.stringify(payload),
    force
  );
}

/**
 * Send or stream a one-way IPC event. If the payload is greater than the max length then it will be streamed.
 * @param event The event ID.
 * @param payload The payload. Ensure this can be serialized to JSON, otherwise some data may be lost.
 * @param force Ignore errors.
 * @throws Throws if the event ID is longer than {@link MAX_EVENT_ID_LENGTH}.
 * @throws Throws if the serialized payload is longer than {@link MAX_MESSAGE_LENGTH}.
 */
export async function sendAuto(
  event: string,
  payload: SerializableValue,
  force = false
): Promise<void> {
  const serialized = JSON.stringify(payload);
  if (serialized.length > MAX_MESSAGE_LENGTH) {
    return sendStreamInternal(IpcTypeFlag.SendStream, event, serialized, force);
  }
  sendInternal(IpcTypeFlag.Send, event, serialized, force);
}
