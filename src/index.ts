import { system, world } from "@minecraft/server";

// important note: try to keep script event messages as short as possible
// as there is a command length limit

// the total limit including the event ID and the message is 498

// 428 to allow 70 characters for the event ID
export const MAX_MESSAGE_LENGTH = 428;
export const MAX_NAMESPACE_LENGTH = 30;
export const MAX_EVENT_ID_LENGTH = 70;

/**
 * Message padding for handler messages.
 * Ensure you allow this much padding in your handler messages, otherwise an error may be thrown.
 */
export const HANDLER_MESSAGE_PADDING = MAX_NAMESPACE_LENGTH + 25;

/**
 * Message padding for stream messages. This is automatically accounted for by {@link streamScriptEvent}.
 */
export const STREAM_MESSAGE_PADDING = MAX_NAMESPACE_LENGTH + 5;

const overworld = world.getDimension("overworld");

export type ScriptEventListener<TPayload> = (payload: TPayload) => void;
export type ScriptEventHandler<TPayload, TResponse> = (
  payload: TPayload
) => TResponse;

interface HandlerPayload {
  /**
   * response event
   */
  re: string;
  /**
   * payload
   */
  pl: unknown;
}

const listeners = new Map<string, ScriptEventListener<any>>();
const streamListeners = new Map<string, ScriptEventListener<any>>();
const handlers = new Map<string, ScriptEventHandler<any, any>>();

function eventHasAnythingRegistered(event: string): boolean {
  return (
    listeners.has(event) || streamListeners.has(event) || handlers.has(event)
  );
}

/**
 * Registers a script event listener. This is one-way event, nothing will be returned to the sender.
 * Use {@link registerScriptEventHandler} to register a two-way event handler.
 * @param event The event ID.
 * @param callback The callback.
 * @throws Throws if another listener, stream listener, or handler is registered for `event`.
 * @throws Throws if the event ID is longer than {@link MAX_EVENT_ID_LENGTH}
 */
export function registerScriptEventListener<TPayload>(
  event: string,
  callback: ScriptEventListener<TPayload>
): void {
  if (eventHasAnythingRegistered(event)) {
    throw new Error(
      `can't register script event listener for event '${event}': a listener, stream listener, or handler for this event has already been registered`
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
export function removeScriptEventListener(event: string): boolean {
  return listeners.delete(event);
}

/**
 * Registers a script event stream listener. This is one-way event, nothing will be returned to the sender.
 * Use {@link registerScriptEventListener} to register a non-stream listener.
 * Use {@link registerScriptEventHandler} to register a two-way event handler.
 * @param event The event ID.
 * @param callback The callback.
 * @throws Throws if another listener, stream listener, or handler is registered for `event`.
 * @throws Throws if the event ID is longer than {@link MAX_EVENT_ID_LENGTH}
 */
export function registerScriptEventStreamListener<TPayload>(
  event: string,
  callback: ScriptEventListener<TPayload>
): void {
  if (eventHasAnythingRegistered(event)) {
    throw new Error(
      `can't register script event stream listener for event '${event}': a listener, stream listener, or handler for this event has already been registered`
    );
  }
  if (event.length > MAX_EVENT_ID_LENGTH) {
    throw new Error(
      `can't register stream listener for event '${event}': '${event}' is longer than ${MAX_EVENT_ID_LENGTH.toString()}`
    );
  }
  streamListeners.set(event, callback);
}

/**
 * Removes a stream listener for an event.
 * @param event The event ID.
 * @returns Returns a boolean indicating whether the stream listener was removed or not.
 */
export function removeScriptEventStreamListener(event: string): boolean {
  return streamListeners.delete(event);
}

/**
 * Registers a script event handler. This is two-way event, whatever the callback returns will be returned to the sender.
 * Use {@link registerScriptEventListener} to register a one-way event listener.
 * @param event The event ID.
 * @param callback The callback.
 * @throws Throws if another listener, stream listener, or handler is registered for `event`.
 * @throws Throws if the event ID is longer than {@link MAX_EVENT_ID_LENGTH}
 */
export function registerScriptEventHandler<TPayload, TResponse>(
  event: string,
  callback: ScriptEventHandler<TPayload, TResponse>
): void {
  if (eventHasAnythingRegistered(event)) {
    throw new Error(
      `can't register script event handler for event '${event}': a listener, stream listener, or handler for this event has already been registered`
    );
  }
  if (event.length > MAX_EVENT_ID_LENGTH) {
    throw new Error(
      `can't register handler for event '${event}': '${event}' is longer than ${MAX_EVENT_ID_LENGTH.toString()}`
    );
  }
  handlers.set(event, callback);
}

/**
 * Removes a handler for an event.
 * @param event The event ID.
 * @returns Returns a boolean indicating whether the handler was removed or not.
 */
export function removeScriptEventHandler(event: string): boolean {
  return handlers.delete(event);
}

/**
 * Dispatch a script event without performing any checks.
 * In most cases, use {@link dispatchScriptEvent} instead.
 */
export function dispatchScriptEventRaw(event: string, message: string): void {
  overworld.runCommand(`scriptevent ${event} ${message}`);
}

/**
 * Dispatch a script event.
 * Use {@link invokeScriptEvent} to call a handler.
 * Use {@link streamScriptEvent} to call a stream listener.
 * @param event The event ID.
 * @param payload The payload. Ensure this can be serialized to JSON, otherwise some data may be lost.
 * @param force Ignore errors.
 * @throws Throws if the event ID is longer than {@link MAX_EVENT_ID_LENGTH}
 * @throws Throws if the serialized payload is longer than {@link MAX_MESSAGE_LENGTH}
 */
export function dispatchScriptEvent(
  event: string,
  payload: unknown,
  force = false
): void {
  const stringifiedPayload = JSON.stringify(payload);

  if (!force) {
    if (event.length > MAX_EVENT_ID_LENGTH) {
      throw new Error(
        `can't dispatch script event for event '${event}' as the event ID is more than ${MAX_EVENT_ID_LENGTH.toString()}`
      );
    }

    if (stringifiedPayload.length > MAX_MESSAGE_LENGTH) {
      throw new Error(
        `can't dispatch script event with a message longer than ${MAX_MESSAGE_LENGTH.toString()} characters`
      );
    }
  }

  dispatchScriptEventRaw(event, stringifiedPayload);
}

// total number of invokes this session, used to create a unique response listener ID
let invokeCount = 0;

/**
 * Invoke a script event handler.
 * Use {@link dispatchScriptEvent} to call a listener.
 * Use {@link streamScriptEvent} to call a stream listener.
 * @param event The event ID.
 * @param namespace The namespace of this add-on. Used to create a response listener ID.
 * @param payload The payload. Ensure this can be serialized to JSON, otherwise some data may be lost.
 * @param force Ignore errors, not including timeout.
 * @returns Returns whatever the handler returns.
 * @throws Throws if the namespace is longer than {@link MAX_NAMESPACE_LENGTH}.
 * @throws Throws if a response is not recieved within 20 game ticks.
 */
export async function invokeScriptEvent(
  event: string,
  namespace: string,
  payload: unknown,
  force = false
): Promise<unknown> {
  if (!force && namespace.length > MAX_NAMESPACE_LENGTH) {
    throw new Error(
      `can't invoke script event '${event}' using namespace '${namespace}': '${namespace}' is longer than ${MAX_NAMESPACE_LENGTH.toString()} characters`
    );
  }

  // hrl stands for handler response listener - we want to keep the event IDs short
  // because there is a command length limit
  const responseListenerId = `${namespace}:ipc.__hrl${invokeCount.toString()}`;
  invokeCount++;

  return new Promise((resolve, reject) => {
    const timeoutId = system.runTimeout(() => {
      removeScriptEventListener(responseListenerId);
      reject(
        new Error(
          `invoke script event '${event}' timed out: did not recieve a response`
        )
      );
    }, 20);

    registerScriptEventListener(responseListenerId, (payload) => {
      removeScriptEventListener(responseListenerId);
      system.clearRun(timeoutId);
      resolve(payload);
    });

    const handlerPayload: HandlerPayload = {
      re: responseListenerId,
      pl: payload,
    };

    dispatchScriptEvent(event, handlerPayload, force);
  });
}

// total number of streams this session, used to create a unique stream ID
let streamCount = 0;

/**
 * Streams the payload to a stream listener. The payload has no max length, since it is streamed.
 * Use {@link dispatchScriptEvent} to call a listener.
 * Use {@link invokeScriptEvent} to call a handler.
 * @param event The event ID.
 * @param namespace The namespace of this add-on. Used to create a response listener ID.
 * @param payload The payload. Ensure this can be serialized to JSON, otherwise some data may be lost.
 * @param force Ignore errors.
 * @throws Throws if the namespace is longer than {@link MAX_NAMESPACE_LENGTH}
 */
export function* streamScriptEvent(
  event: string,
  namespace: string,
  payload: unknown,
  force = false
): Generator<void, void, void> {
  if (!force && namespace.length > MAX_NAMESPACE_LENGTH) {
    throw new Error(
      `can't stream script event '${event}' using namespace '${namespace}': '${namespace}' is longer than ${MAX_NAMESPACE_LENGTH.toString()} characters`
    );
  }

  const streamId = namespace + streamCount.toString();
  streamCount++;

  const stringifiedPayload = JSON.stringify(payload);

  const parts = [stringifiedPayload];

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

  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    const isLastPart = i >= parts.length - 1;

    dispatchScriptEventRaw(
      event,
      `${streamId} ${isLastPart ? "t" : "f"} ${part}`
    );

    yield;
  }
}

/**
 * key = stream ID
 * value = cached content from previous events
 */
const pendingStreams = new Map<string, string>();

system.afterEvents.scriptEventReceive.subscribe((e) => {
  const listener = listeners.get(e.id);
  if (listener) {
    listener(JSON.parse(e.message));
    return;
  }

  const handler = handlers.get(e.id);
  if (handler) {
    const payload = JSON.parse(e.message) as HandlerPayload;
    const response = handler(payload.pl);
    dispatchScriptEvent(payload.re, response);
  }

  if (streamListeners.has(e.id)) {
    const [id, afterId] = e.message.split(/ (.*)/);
    const [isEndRaw, content] = afterId.split(/ (.*)/);

    const isEnd = isEndRaw === "t";

    const cachedContent = pendingStreams.get(id) ?? "";

    if (isEnd) {
      pendingStreams.delete(id);
      const streamListener = streamListeners.get(e.id)!;
      streamListener(JSON.parse(cachedContent + content));
    } else {
      pendingStreams.set(id, cachedContent + content);
    }
  }
});
