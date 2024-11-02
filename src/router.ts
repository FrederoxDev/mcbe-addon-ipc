import { system } from "@minecraft/server";
import { listeners } from "./listeners.js";
import { IpcTypeFlag, SerializableValue } from "./common.js";
import { send } from "./send.js";

/**
 * key = stream ID
 * value = cached content from previous events
 */
const pendingStreams = new Map<string, string>();

system.afterEvents.scriptEventReceive.subscribe((e) => {
  const listener = listeners.get(e.id);
  if (!listener) return;

  // the first character should be the ipc type flag
  const ipcTypeFlag = e.message[0] as IpcTypeFlag;

  // skip the ipc type flag
  const message = e.message.slice(1);

  if (ipcTypeFlag === IpcTypeFlag.Send) {
    listener(JSON.parse(message) as SerializableValue);
    return;
  }

  if (ipcTypeFlag === IpcTypeFlag.Invoke) {
    const [responseEvent, payload] = message.split(/ (.*)/);
    const response = listener(JSON.parse(payload) as SerializableValue);
    send({
      event: responseEvent,
      payload: response,
    });
  }

  if (
    ipcTypeFlag === IpcTypeFlag.SendStream ||
    ipcTypeFlag === IpcTypeFlag.InvokeStream
  ) {
    const [id, afterId] = message.split(/ (.*)/);
    const [isEndRaw, content] = afterId.split(/ (.*)/);

    const isEnd = isEndRaw === "t";

    const cachedContent = pendingStreams.get(id) ?? "";

    const fullContent = cachedContent + content;

    if (!isEnd) {
      pendingStreams.set(id, fullContent);
      return;
    }

    pendingStreams.delete(id);

    if (ipcTypeFlag === IpcTypeFlag.InvokeStream) {
      const [responseEvent, payload] = fullContent.split(/ (.*)/);
      const response = listener(JSON.parse(payload) as SerializableValue);
      send({
        event: responseEvent,
        payload: response,
      });
      return;
    }

    listener(JSON.parse(fullContent) as SerializableValue);
  }
});
