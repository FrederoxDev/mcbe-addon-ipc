// the total limit including the event ID and the message is 498

// 427 to allow 70 characters for the event ID and 1 character for the ipc type flag
/**
 * Max serialized message length.
 */
export const MAX_MESSAGE_LENGTH = 427;
/**
 * Max namespace length.
 */
export const MAX_NAMESPACE_LENGTH = 30;
/**
 * Max event ID length, including the namespace.
 */
export const MAX_EVENT_ID_LENGTH = 70;

/**
 * @internal
 */
export const STREAM_MESSAGE_PADDING = MAX_NAMESPACE_LENGTH + 7;
