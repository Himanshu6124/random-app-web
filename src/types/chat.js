/**
 * @file chat.js
 * TypeScript & JSDoc Type Definitions matching backend chat-backend DTOs.
 * Direct copy from FRONTEND_INTEGRATION_GUIDE.md (Appendix Section 9).
 */

/**
 * @typedef {'SENT' | 'SEEN' | 'DELETED'} MessageStatus
 * @typedef {'TEXT' | 'IMAGE' | 'VIDEO' | 'AUDIO'} MessageType
 * @typedef {'NONE' | 'PENDING_SENT' | 'PENDING_RECEIVED' | 'ACCEPTED' | 'BLOCKED'} FriendshipStatus
 * @typedef {'MESSAGE' | 'TYPING' | 'ONLINE_STATUS' | 'CONVERSATION_DTO' | 'DISCONNECTED_DTO' | 'SEEN'} WebSocketEventType
 */

/**
 * @typedef {Object} LoginResponseDto
 * @property {string} jwt
 * @property {string} userId
 */

/**
 * @typedef {Object} UserResponseDto
 * @property {string} username
 * @property {string} name
 * @property {string} email
 * @property {string} gender
 * @property {string | null} location
 * @property {boolean} isOnline
 * @property {string | null} bio
 * @property {string | null} photoUrl
 * @property {string | null} lastOnline
 */

/**
 * @typedef {Object} ConversationResponseDto
 * @property {string} id
 * @property {string} user1Id
 * @property {string} user2Id
 * @property {string} startedAt
 * @property {string | null} endedAt
 * @property {'USER1' | 'USER2' | 'BOTH' | 'NO'} typing
 * @property {string | null} lastMessage
 * @property {string | null} lastMessageSenderId
 * @property {string | null} lastMessageTime
 * @property {MessageType | null} lastMessageType
 * @property {string | null} user1LastSeenMessageId
 * @property {string | null} user1LastSeenAt
 * @property {string | null} user2LastSeenMessageId
 * @property {string | null} user2LastSeenAt
 */

/**
 * @typedef {Object} UserConversationDTO
 * @property {string} conversationId
 * @property {string} friendUserName
 * @property {string} friendUserId
 * @property {string | null} photoUrl
 * @property {string | null} lastMessage
 * @property {boolean | null} isByYou
 * @property {MessageStatus | null} messageStatus
 * @property {string | null} lastMessageTime
 * @property {MessageType | null} messageType
 * @property {string | null} friendLastSeenMessageId
 * @property {string | null} friendLastSeenAt
 * @property {number} unseenCount
 */

/**
 * @typedef {Object} SendMessageRequestDto
 * @property {string} conversationId
 * @property {string} message
 * @property {MessageType} [type]
 * @property {string | null} [objectUri]
 * @property {string | null} [referredMessageId]
 */

/**
 * @typedef {Object} MessageResponseDto
 * @property {string} id
 * @property {string} conversationId
 * @property {string} senderId
 * @property {string} message
 * @property {string | null} objectUri
 * @property {string | null} referredMessageId
 * @property {string | null} reactEmojiSender
 * @property {string | null} reactEmojiReceiver
 * @property {string} timeStamp
 * @property {MessageStatus} status
 * @property {MessageType} type
 */

/**
 * @typedef {Object} FriendDto
 * @property {string} username
 * @property {string} name
 * @property {string} email
 * @property {string} gender
 * @property {string | null} location
 * @property {string | null} bio
 * @property {string | null} photoUrl
 * @property {boolean} isOnline
 * @property {string | null} lastOnline
 */

/**
 * @typedef {Object} FriendshipStatusDto
 * @property {string} username
 * @property {FriendshipStatus} status
 */

/**
 * @template T
 * @typedef {Object} ApiResponse
 * @property {boolean} success
 * @property {string} message
 * @property {T} data
 * @property {string} timestamp
 */

/**
 * @template T
 * @typedef {Object} WebSocketEventDTO
 * @property {WebSocketEventType} type
 * @property {T} payload
 */

/**
 * @typedef {Object} TypingStatusDTO
 * @property {string} senderId
 * @property {string} conversationId
 * @property {boolean} typing
 */

/**
 * @typedef {Object} OnlineStatusDTO
 * @property {string} senderId
 * @property {string} conversationId
 * @property {boolean} online
 */

/**
 * @typedef {Object} SeenMessageDTO
 * @property {string} senderId
 * @property {string} conversationId
 * @property {string} messageId
 * @property {string} seenAt
 */

/**
 * @typedef {Object} DisconnectedDTO
 * @property {string} senderId
 * @property {string} conversationId
 */

/**
 * @typedef {Object} ApiError
 * @property {string} timeStamp
 * @property {string} error
 * @property {string} statusCode
 */

export {};
