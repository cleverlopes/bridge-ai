import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Secret } from '../../entities/secret.entity';
import { SecretAudit } from '../../entities/secret-audit.entity';
import { KsmService } from './ksm.service';

@Module({
  imports: [TypeOrmModule.forFeature([Secret, SecretAudit])],
  providers: [KsmService],
  exports: [KsmService],
})
export class KsmModule {}
