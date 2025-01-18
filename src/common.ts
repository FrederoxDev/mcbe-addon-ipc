import { world } from "@minecraft/server";

/**
 * @internal
 */
export const overworld = world.getDimension("overworld");

/**
 * @internal
 */
export enum IpcTypeFlag {
  Send = "0",
  SendStream = "1",
  Invoke = "2",
  InvokeStream = "3",
}

export interface SendOptions {
  /**
   * The event ID.
   */
  event: string;
  /**
   * The payload. Ensure this can be serialized to JSON, otherwise some data may be lost.
   */
  payload: SerializableValue;
  /**
   * Ignore (most) errors.
   */
  force?: boolean;
}

export interface InvokeOptions extends SendOptions {
  /**
   * If `true`, {@link Failure}s will be thrown rather than returned.
   */
  throwFailures?: boolean;
}

/**
 * @internal
 */
export interface InternalSendOptions extends SendOptions {
  payload: string;
}

/**
 * @internal
 */
export interface InternalInvokeOptions extends InvokeOptions {
  payload: string;
}

/**
 * Values that can be serialized and sent using IPC.
 * Note that this is not completely typesafe.
 */
export type SerializableValue = string | number | boolean | null | object;

export type ScriptEventListener = (
  payload: SerializableValue
) => SerializableValue;
