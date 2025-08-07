import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { ChatRoom } from './chat-room.entity';
import { User } from './user.entity';

export enum MessageType {
  TEXT = 'text',
  IMAGE = 'image',
  FILE = 'file',
  SYSTEM = 'system',
  EMOJI = 'emoji'
}

@Entity('chat_messages')
export class ChatMessage {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  room_id: number;

  @ManyToOne(() => ChatRoom, (room) => room.messages)
  @JoinColumn({ name: 'room_id' })
  room: ChatRoom;

  @Column({ nullable: true })
  sender_id: number;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'sender_id' })
  sender: User;

  @Column({
    type: 'enum',
    enum: MessageType,
    default: MessageType.TEXT
  })
  message_type: MessageType;

  @Column('text')
  content: string;

  @Column({ length: 500, nullable: true })
  file_url: string;

  @Column({ length: 100, nullable: true })
  file_name: string;

  @Column({ type: 'int', nullable: true })
  file_size: number;

  @Column({ default: false })
  is_read: boolean;

  @Column({ type: 'timestamp', nullable: true })
  read_at: Date;

  @Column({ default: false })
  is_edited: boolean;

  @Column({ type: 'timestamp', nullable: true })
  edited_at: Date;

  @CreateDateColumn()
  created_at: Date;
}