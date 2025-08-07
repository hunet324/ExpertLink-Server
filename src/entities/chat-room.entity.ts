import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, OneToOne, OneToMany, JoinColumn } from 'typeorm';
import { Counseling } from './counseling.entity';
import { ChatMessage } from './chat-message.entity';

export enum ChatRoomStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  ARCHIVED = 'archived'
}

@Entity('chat_rooms')
export class ChatRoom {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ nullable: true })
  counseling_id: number;

  @OneToOne(() => Counseling)
  @JoinColumn({ name: 'counseling_id' })
  counseling: Counseling;

  @Column('int', { array: true })
  participants: number[];

  @Column({ length: 200, nullable: true })
  room_name: string;

  @Column({
    type: 'enum',
    enum: ChatRoomStatus,
    default: ChatRoomStatus.ACTIVE
  })
  status: ChatRoomStatus;

  @Column({ type: 'timestamp', nullable: true })
  last_message_at: Date;

  @OneToMany(() => ChatMessage, (message) => message.room)
  messages: ChatMessage[];

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}