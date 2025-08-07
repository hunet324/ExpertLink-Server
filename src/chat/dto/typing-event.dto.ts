export class TypingEventDto {
  roomId: number;
  userId: number;
  userName: string;
  isTyping: boolean;
  timestamp: Date;
}

export class JoinRoomDto {
  roomId: number;
  userId: number;
}

export class LeaveRoomDto {
  roomId: number;
  userId: number;
}

export class MarkMessageReadDto {
  messageId: number;
  roomId: number;
  readerId: number;
}