import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as amqp from 'amqplib';
import { AmqpConnectionManager, connect, ChannelWrapper } from 'amqp-connection-manager';

@Injectable()
export class RabbitMQService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RabbitMQService.name);
  private connection: AmqpConnectionManager;
  private publisherChannel: ChannelWrapper;
  private consumerChannel: ChannelWrapper;

  constructor(private configService: ConfigService) {}

  async onModuleInit() {
    await this.connect();
    await this.setupExchangesAndQueues();
  }

  async onModuleDestroy() {
    await this.disconnect();
  }

  private async connect(): Promise<void> {
    try {
      const url = this.configService.get('RABBITMQ_URL', 'amqp://admin:password123@localhost:5672/expertlink');
      
      this.connection = connect([url], {
        reconnectTimeInSeconds: 5,
        heartbeatIntervalInSeconds: 5,
      });

      this.connection.on('connect', () => {
        this.logger.log('RabbitMQ connected successfully');
      });

      this.connection.on('disconnect', (err) => {
        this.logger.warn('RabbitMQ disconnected', err);
      });

      this.connection.on('connectFailed', (err) => {
        this.logger.error('RabbitMQ connection failed', err);
      });

      // Publisher 채널
      this.publisherChannel = this.connection.createChannel({
        name: 'publisher',
        setup: async (channel: amqp.Channel) => {
          return channel;
        },
      });

      // Consumer 채널
      this.consumerChannel = this.connection.createChannel({
        name: 'consumer',
        setup: async (channel: amqp.Channel) => {
          await channel.prefetch(10);
          return channel;
        },
      });

    } catch (error) {
      this.logger.error('Failed to connect to RabbitMQ', error);
      throw error;
    }
  }

  private async setupExchangesAndQueues(): Promise<void> {
    await this.publisherChannel.addSetup(async (channel: amqp.Channel) => {
      // Exchange 생성
      await channel.assertExchange('counseling.events', 'topic', {
        durable: true,
      });

      // STOMP WebSocket용 Direct Exchange 생성
      await channel.assertExchange('chat.direct', 'direct', {
        durable: false, // 실시간 메시지는 비영속적
      });

      // Queue 생성 및 바인딩
      const queues = [
        { name: 'counseling.booking', routingKey: 'counseling.booking.*' },
        { name: 'counseling.notifications', routingKey: 'counseling.*' },
        { name: 'counseling.payments', routingKey: 'counseling.payment.*' },
        { name: 'counseling.analytics', routingKey: 'counseling.*' },
      ];

      for (const queue of queues) {
        await channel.assertQueue(queue.name, {
          durable: true,
          arguments: {
            'x-dead-letter-exchange': 'counseling.dlx',
            'x-dead-letter-routing-key': 'dead-letter',
            'x-message-ttl': 24 * 60 * 60 * 1000, // 24시간
          },
        });

        await channel.bindQueue(queue.name, 'counseling.events', queue.routingKey);
      }

      // Dead Letter Exchange
      await channel.assertExchange('counseling.dlx', 'direct', { durable: true });
      await channel.assertQueue('counseling.dead-letters', { durable: true });
      await channel.bindQueue('counseling.dead-letters', 'counseling.dlx', 'dead-letter');

      this.logger.log('RabbitMQ exchanges and queues setup completed');
    });
  }

  async publishEvent(routingKey: string, data: any): Promise<void> {
    try {
      const message = {
        ...data,
        timestamp: new Date().toISOString(),
        eventId: this.generateEventId(),
      };

      await this.publisherChannel.publish(
        'counseling.events',
        routingKey,
        Buffer.from(JSON.stringify(message)),
        {
          persistent: true,
          messageId: message.eventId,
          timestamp: Date.now(),
        },
      );

      this.logger.log(`Event published: ${routingKey}`, { eventId: message.eventId });
    } catch (error) {
      this.logger.error(`Failed to publish event: ${routingKey}`, error);
      throw error;
    }
  }

  async subscribe(
    queueName: string,
    handler: (data: any, message: amqp.ConsumeMessage) => Promise<void>,
  ): Promise<void> {
    await this.consumerChannel.addSetup(async (channel: amqp.Channel) => {
      await channel.consume(queueName, async (message) => {
        if (message) {
          try {
            const data = JSON.parse(message.content.toString());
            await handler(data, message);
            channel.ack(message);
            this.logger.log(`Message processed: ${queueName}`, { messageId: message.properties.messageId });
          } catch (error) {
            this.logger.error(`Error processing message: ${queueName}`, error);
            // 재시도 로직 또는 DLQ로 전송
            channel.nack(message, false, false);
          }
        }
      });
    });
  }

  private async disconnect(): Promise<void> {
    if (this.connection) {
      await this.connection.close();
      this.logger.log('RabbitMQ connection closed');
    }
  }

  // STOMP WebSocket용 direct exchange에 메시지 발행
  async publishToExchange(exchange: string, routingKey: string, data: any): Promise<void> {
    try {
      const message = {
        ...data,
        timestamp: new Date().toISOString(),
        messageId: this.generateEventId(),
      };

      await this.publisherChannel.publish(
        exchange,
        routingKey,
        Buffer.from(JSON.stringify(message)),
        {
          persistent: false, // 실시간 메시지는 비영속적
          messageId: message.messageId,
          timestamp: Date.now(),
          headers: {
            'content-type': 'application/json',
          },
        },
      );

      this.logger.log(`Message published to exchange: ${exchange}/${routingKey}`, { messageId: message.messageId });
    } catch (error) {
      this.logger.error(`Failed to publish to exchange: ${exchange}/${routingKey}`, error);
      throw error;
    }
  }

  private generateEventId(): string {
    return `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
  }

  // Getter methods for direct channel access if needed
  getPublisherChannel(): ChannelWrapper {
    return this.publisherChannel;
  }

  getConsumerChannel(): ChannelWrapper {
    return this.consumerChannel;
  }
}