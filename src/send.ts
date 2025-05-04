import { system } from "@minecraft/server";
import { InternalSendOptions, IpcTypeFlag, SendOptions } from "./common.js";
import { MAX_MESSAGE_LENGTH, STREAM_MESSAGE_PADDING } from "./constants.js";

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
        `Failed to send event '${options.event}'. The maximum payload length is ${MAX_MESSAGE_LENGTH.toString()} characters.`
      );
    }
  }

  system.sendScriptEvent(options.event, flag + options.payload);
}

/**
 * @internal
 */
export function send(options: SendOptions): void {
  sendInternal(IpcTypeFlag.Send, {
    ...options,
    payload: JSON.stringify(options.payload),
  });
}

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
  streamId: string,
  force = false
): Promise<void> {
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
 * @internal
 */
export function sendStream(
  options: SendOptions,
  streamId: string
): Promise<void> {
  return sendStreamInternal(
    IpcTypeFlag.SendStream,
    options.event,
    JSON.stringify(options.payload),
    streamId,
    options.force
  );
}
