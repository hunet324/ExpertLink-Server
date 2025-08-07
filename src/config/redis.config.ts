import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class RedisService {
  private readonly client: Redis;

  constructor(private configService: ConfigService) {
    this.client = new Redis({
      host: this.configService.get('REDIS_HOST', 'localhost'),
      port: this.configService.get('REDIS_PORT', 6379),
      retryDelayOnFailover: 100,
      maxRetriesPerRequest: 3,
    });

    this.client.on('connect', () => {
      console.log('Redis connected successfully');
    });

    this.client.on('error', (error) => {
      console.error('Redis connection error:', error);
    });
  }

  getClient(): Redis {
    return this.client;
  }

  async set(key: string, value: string, ttl?: number): Promise<void> {
    if (ttl) {
      await this.client.set(key, value, 'EX', ttl);
    } else {
      await this.client.set(key, value);
    }
  }

  async get(key: string): Promise<string | null> {
    return await this.client.get(key);
  }

  async delete(key: string): Promise<number> {
    return await this.client.del(key);
  }

  async exists(key: string): Promise<number> {
    return await this.client.exists(key);
  }

  async increment(key: string): Promise<number> {
    return await this.client.incr(key);
  }

  async decrement(key: string): Promise<number> {
    return await this.client.decr(key);
  }

  async setAdd(key: string, value: string): Promise<number> {
    return await this.client.sadd(key, value);
  }

  async setRemove(key: string, value: string): Promise<number> {
    return await this.client.srem(key, value);
  }

  async setMembers(key: string): Promise<string[]> {
    return await this.client.smembers(key);
  }
}