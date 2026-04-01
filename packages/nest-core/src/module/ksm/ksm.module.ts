import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Secret } from '../../persistence/entity/secret.entity';
import { SecretAudit } from '../../persistence/entity/secret-audit.entity';
import { KsmService } from './ksm.service';

@Module({
  imports: [TypeOrmModule.forFeature([Secret, SecretAudit])],
  providers: [KsmService],
  exports: [KsmService],
})
export class KsmModule {}
