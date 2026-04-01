import { Controller, Get, HttpCode, HttpStatus } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import {
  HealthCheckService,
  TypeOrmHealthIndicator,
} from '@nestjs/terminus';
import type { Queue } from 'bullmq';
import { QUEUE_PROJECT_EVENTS } from '../events/events.service';

interface HealthResponse {
  status: 'ok' | 'error';
  db: 'connected' | 'error';
  redis: 'connected' | 'error';
}

@Controller('health')
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly db: TypeOrmHealthIndicator,
    @InjectQueue(QUEUE_PROJECT_EVENTS) private readonly projectEventsQueue: Queue,
  ) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  async check(): Promise<HealthResponse> {
    let dbStatus: 'connected' | 'error' = 'error';
    let redisStatus: 'connected' | 'error' = 'error';

    try {
      await this.health.check([() => this.db.pingCheck('db')]);
      dbStatus = 'connected';
    } catch {
      dbStatus = 'error';
    }

    try {
      const client = (this.projectEventsQueue as unknown as { client?: { ping: () => Promise<string> } }).client;
      if (client?.ping) {
        await client.ping();
        redisStatus = 'connected';
      }
    } catch {
      redisStatus = 'error';
    }

    const overallStatus = dbStatus === 'connected' && redisStatus === 'connected' ? 'ok' : 'error';
    return { status: overallStatus, db: dbStatus, redis: redisStatus };
  }
}
