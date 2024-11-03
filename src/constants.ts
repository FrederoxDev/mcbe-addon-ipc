// actual max is 2048, but we need to allow one character for the ipc type flag
/**
 * Max serialized message length.
 */
export const MAX_MESSAGE_LENGTH = 2047;

/**
 * Max namespace length.
 */
export const MAX_NAMESPACE_LENGTH = 48;

/**
 * @internal
 */
export const STREAM_MESSAGE_PADDING = MAX_NAMESPACE_LENGTH + 10;
