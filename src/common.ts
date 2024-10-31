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
