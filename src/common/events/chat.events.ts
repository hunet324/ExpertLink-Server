export enum ChatEventType {
  ROOM_CREATED = 'chat.room.created',
  ROOM_JOINED = 'chat.room.joined',
  ROOM_LEFT = 'chat.room.left',
  MESSAGE_SENT = 'chat.message.sent',
  MESSAGE_READ = 'chat.message.read',
  USER_ONLINE = 'chat.user.online',
  USER_OFFLINE = 'chat.user.offline',
  TYPING_START = 'chat.typing.start',
  TYPING_END = 'chat.typing.end',
}

export interface ChatRoomCreatedEvent {
  roomId: number;
  counselingId?: number;
  participants: number[];
  roomName?: string;
  createdAt: Date;
}

export interface ChatRoomJoinedEvent {
  roomId: number;
  userId: number;
  joinedAt: Date;
}

export interface ChatRoomLeftEvent {
  roomId: number;
  userId: number;
  leftAt: Date;
}

export interface ChatMessageSentEvent {
  messageId: number;
  roomId: number;
  senderId: number;
  messageType: string;
  content: string;
  fileUrl?: string;
  fileName?: string;
  fileSize?: number;
  sentAt: Date;
}

export interface ChatMessageReadEvent {
  messageId: number;
  roomId: number;
  readerId: number;
  readAt: Date;
}

export interface ChatUserStatusEvent {
  userId: number;
  status: 'online' | 'offline';
  timestamp: Date;
}

export interface ChatTypingEvent {
  roomId: number;
  userId: number;
  userName: string;
  isTyping: boolean;
  timestamp: Date;
}