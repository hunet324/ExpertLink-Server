import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { LoggerUtil } from '../utils/logger.util';

@Injectable()
export class CacheService {
  private redis: Redis;
  private readonly logger = new Logger(CacheService.name);
  private readonly defaultTtl: number;
  private readonly keyPrefix: string;
  private readonly isEnabled: boolean;

  constructor(private configService: ConfigService) {
    this.defaultTtl = parseInt(this.configService.get('REDIS_TTL_DEFAULT', '300'));
    this.keyPrefix = this.configService.get('REDIS_KEY_PREFIX', 'expertlink:');
    this.isEnabled = this.configService.get('CACHE_ENABLED', 'true') === 'true';

    if (this.isEnabled) {
      this.redis = new Redis({
        host: this.configService.get('REDIS_HOST', 'localhost'),
        port: parseInt(this.configService.get('REDIS_PORT', '6379')),
        password: this.configService.get('REDIS_PASSWORD') || undefined,
        db: parseInt(this.configService.get('REDIS_DB', '0')),
        maxRetriesPerRequest: 3,
        lazyConnect: true,
      });

      this.redis.on('connect', () => {
        LoggerUtil.info('Redis 연결됨');
      });

      this.redis.on('error', (error) => {
        LoggerUtil.error('Redis 연결 오류', error);
      });
    }
  }

  /**
   * 캐시에서 데이터 조회 또는 함수 실행 후 캐싱
   */
  async getOrSet<T>(
    key: string,
    fetchFunction: () => Promise<T>,
    ttl: number = this.defaultTtl,
    tags: string[] = []
  ): Promise<T> {
    if (!this.isEnabled) {
      return await fetchFunction();
    }

    const fullKey = this.buildKey(key);

    try {
      // 캐시에서 조회 시도
      const cachedData = await this.redis.get(fullKey);
      if (cachedData) {
        LoggerUtil.debug(`캐시 HIT: ${key}`);
        return JSON.parse(cachedData);
      }

      LoggerUtil.debug(`캐시 MISS: ${key}`);

      // 캐시에 없으면 함수 실행
      const data = await fetchFunction();
      
      // 캐시에 저장
      await this.set(key, data, ttl, tags);
      
      return data;
    } catch (error) {
      LoggerUtil.error('캐시 조회/설정 오류', { key, error: error.message });
      // 캐시 오류 시 원본 함수 실행
      return await fetchFunction();
    }
  }

  /**
   * 캐시에 데이터 저장
   */
  async set<T>(
    key: string,
    data: T,
    ttl: number = this.defaultTtl,
    tags: string[] = []
  ): Promise<void> {
    if (!this.isEnabled) return;

    const fullKey = this.buildKey(key);

    try {
      const serializedData = JSON.stringify(data);
      
      if (ttl > 0) {
        await this.redis.setex(fullKey, ttl, serializedData);
      } else {
        await this.redis.set(fullKey, serializedData);
      }

      // 태그 설정 (무효화를 위해)
      if (tags.length > 0) {
        await this.setTags(fullKey, tags);
      }

      LoggerUtil.debug(`캐시 저장됨: ${key} (TTL: ${ttl}초)`);
    } catch (error) {
      LoggerUtil.error('캐시 저장 오류', { key, error: error.message });
    }
  }

  /**
   * 캐시에서 데이터 조회
   */
  async get<T>(key: string): Promise<T | null> {
    if (!this.isEnabled) return null;

    const fullKey = this.buildKey(key);

    try {
      const cachedData = await this.redis.get(fullKey);
      if (cachedData) {
        return JSON.parse(cachedData);
      }
      return null;
    } catch (error) {
      LoggerUtil.error('캐시 조회 오류', { key, error: error.message });
      return null;
    }
  }

  /**
   * 캐시 삭제
   */
  async del(key: string): Promise<void> {
    if (!this.isEnabled) return;

    const fullKey = this.buildKey(key);

    try {
      await this.redis.del(fullKey);
      LoggerUtil.debug(`캐시 삭제됨: ${key}`);
    } catch (error) {
      LoggerUtil.error('캐시 삭제 오류', { key, error: error.message });
    }
  }

  /**
   * 패턴으로 캐시 삭제 (태그 기반 무효화)
   */
  async invalidateByTag(tag: string): Promise<void> {
    if (!this.isEnabled) return;

    try {
      const tagKey = `${this.keyPrefix}tag:${tag}`;
      const keys = await this.redis.smembers(tagKey);
      
      if (keys.length > 0) {
        await this.redis.del(...keys);
        await this.redis.del(tagKey);
        LoggerUtil.debug(`태그로 캐시 무효화됨: ${tag} (${keys.length}개 키)`);
      }
    } catch (error) {
      LoggerUtil.error('태그 기반 캐시 무효화 오류', { tag, error: error.message });
    }
  }

  /**
   * 패턴으로 캐시 삭제
   */
  async invalidateByPattern(pattern: string): Promise<void> {
    if (!this.isEnabled) return;

    try {
      const fullPattern = this.buildKey(pattern);
      const keys = await this.redis.keys(fullPattern);
      
      if (keys.length > 0) {
        await this.redis.del(...keys);
        LoggerUtil.debug(`패턴으로 캐시 무효화됨: ${pattern} (${keys.length}개 키)`);
      }
    } catch (error) {
      LoggerUtil.error('패턴 기반 캐시 무효화 오류', { pattern, error: error.message });
    }
  }

  /**
   * 캐시 통계 조회
   */
  async getStats(): Promise<{
    hits: number;
    misses: number;
    keys: number;
    memory: string;
  }> {
    if (!this.isEnabled) {
      return { hits: 0, misses: 0, keys: 0, memory: '0B' };
    }

    try {
      const info = await this.redis.info('stats');
      const keyspaceInfo = await this.redis.info('keyspace');
      
      const hits = this.extractStat(info, 'keyspace_hits') || 0;
      const misses = this.extractStat(info, 'keyspace_misses') || 0;
      
      // 키 개수 추출
      const dbMatch = keyspaceInfo.match(/db0:keys=(\d+)/);
      const keys = dbMatch ? parseInt(dbMatch[1]) : 0;
      
      // 메모리 사용량
      let memory = 0;
      try {
        const memoryInfo = await this.redis.info('memory');
        const memoryMatch = memoryInfo.match(/used_memory:(\d+)/);
        memory = memoryMatch ? parseInt(memoryMatch[1]) : 0;
      } catch (error) {
        memory = 0;
      }
      
      return {
        hits,
        misses,
        keys,
        memory: `${Math.round(memory / 1024 / 1024 * 100) / 100}MB`
      };
    } catch (error) {
      LoggerUtil.error('캐시 통계 조회 오류', error);
      return { hits: 0, misses: 0, keys: 0, memory: '0B' };
    }
  }

  /**
   * 모든 캐시 삭제 (개발용)
   */
  async flush(): Promise<void> {
    if (!this.isEnabled) return;

    try {
      await this.redis.flushdb();
      LoggerUtil.info('모든 캐시가 삭제되었습니다');
    } catch (error) {
      LoggerUtil.error('캐시 플러시 오류', error);
    }
  }

  private buildKey(key: string): string {
    return `${this.keyPrefix}${key}`;
  }

  private async setTags(key: string, tags: string[]): Promise<void> {
    try {
      for (const tag of tags) {
        const tagKey = `${this.keyPrefix}tag:${tag}`;
        await this.redis.sadd(tagKey, key);
        // 태그 자체도 TTL 설정 (1시간)
        await this.redis.expire(tagKey, 3600);
      }
    } catch (error) {
      LoggerUtil.error('태그 설정 오류', { key, tags, error: error.message });
    }
  }

  private extractStat(info: string, statName: string): number {
    const match = info.match(new RegExp(`${statName}:(\\d+)`));
    return match ? parseInt(match[1]) : 0;
  }

  async onModuleDestroy() {
    if (this.redis) {
      await this.redis.quit();
      LoggerUtil.info('Redis 연결이 종료되었습니다');
    }
  }
}