import { system } from "@minecraft/server";
import { listeners, ScriptEventListener } from "./listeners.js";
import { IpcTypeFlag, SerializableValue } from "./common.js";
import { send } from "./send.js";
import { Failure } from "./failure.js";

/**
 * key = stream ID
 * value = cached content from previous events
 */
const pendingStreams = new Map<string, string>();

function parseRawPayload(rawPayload: string): SerializableValue {
  const payload = JSON.parse(rawPayload) as SerializableValue;

  if (
    typeof payload === "object" &&
    payload !== null &&
    "__IPCFAILURE__" in payload
  ) {
    return new Failure(payload.__IPCFAILURE__ as string);
  }

  return payload;
}

function invokeListener(
  listener: ScriptEventListener,
  responseEvent: string,
  rawPayload: string
): void {
  const payload = parseRawPayload(rawPayload);

  let response: SerializableValue = null;
  let err;

  try {
    response = listener(payload);
  } catch (e) {
    err = e;
  }

  if (response instanceof Failure) {
    response = {
      __IPCFAILURE__: response.message,
    };
  }

  send({
    event: responseEvent,
    payload: response,
  });

  if (err) {
    // eslint-disable-next-line @typescript-eslint/only-throw-error
    throw err;
  }
}

function callListener(listener: ScriptEventListener, rawPayload: string): void {
  const payload = parseRawPayload(rawPayload);
  const result = listener(payload);
  if (result instanceof Failure) {
    throw result;
  }
}

system.afterEvents.scriptEventReceive.subscribe((e) => {
  const listener = listeners.get(e.id);
  if (!listener) return;

  // the first character should be the ipc type flag
  const ipcTypeFlag = e.message[0] as IpcTypeFlag;

  // skip the ipc type flag
  const message = e.message.slice(1);

  switch (ipcTypeFlag) {
    case IpcTypeFlag.Send:
      callListener(listener, message);
      break;

    case IpcTypeFlag.Invoke: {
      const [responseEvent, payload] = message.split(/ (.*)/);
      invokeListener(listener, responseEvent, payload);
      break;
    }

    case IpcTypeFlag.InvokeStream:
    case IpcTypeFlag.SendStream: {
      const [id, afterId] = message.split(/ (.*)/);
      const [isEndRaw, content] = afterId.split(/ (.*)/);

      const isEnd = isEndRaw === "t";

      const cachedContent = pendingStreams.get(id) ?? "";

      const fullContent = cachedContent + content;

      if (!isEnd) {
        pendingStreams.set(id, fullContent);
        break;
      }

      pendingStreams.delete(id);

      if (ipcTypeFlag === IpcTypeFlag.InvokeStream) {
        const [responseEvent, payload] = fullContent.split(/ (.*)/);
        invokeListener(listener, responseEvent, payload);
        break;
      }

      callListener(listener, fullContent);

      break;
    }
  }
});
