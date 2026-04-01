import { Controller, Get } from '@nestjs/common';
import {
  HealthCheck,
  HealthCheckService,
  HealthIndicatorResult,
  TypeOrmHealthIndicator,
} from '@nestjs/terminus';
import { BrainService } from '../brain/brain.service';

@Controller('health')
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly db: TypeOrmHealthIndicator,
    private readonly brain: BrainService,
  ) {}

  @Get()
  @HealthCheck()
  check() {
    return this.health.check([
      () => this.db.pingCheck('db'),
      () => this.checkProviders(),
    ]);
  }

  private async checkProviders(): Promise<HealthIndicatorResult> {
    const result = await this.brain.checkProvider();
    return {
      providers: {
        status: result.healthy ? 'up' : 'down',
        provider: result.provider,
        ...(result.error ? { error: result.error } : {}),
      },
    };
  }
}
