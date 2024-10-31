// the total limit including the event ID and the message is 498

// 427 to allow 70 characters for the event ID and 1 character for the ipc type flag
export const MAX_MESSAGE_LENGTH = 427;
export const MAX_NAMESPACE_LENGTH = 30;
export const MAX_EVENT_ID_LENGTH = 70; // including the namespace

/**
 * @internal
 */
export const STREAM_MESSAGE_PADDING = MAX_NAMESPACE_LENGTH + 7;
