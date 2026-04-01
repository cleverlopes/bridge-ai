import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WorkspaceSnapshot } from '../../persistence/entity/workspace-snapshot.entity';
import { Project } from '../../persistence/entity/project.entity';
import { KsmModule } from '../ksm/ksm.module';
import { WorkspaceOnboardingService } from './workspace-onboarding.service';
import { RepoIndexerService } from './repo-indexer.service';
import { EphemeralWorkspaceService } from './ephemeral-workspace.service';
import { PromotionService } from './promotion.service';
import { WorkspaceController } from './workspace.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([WorkspaceSnapshot, Project]),
    KsmModule,
  ],
  controllers: [WorkspaceController],
  providers: [WorkspaceOnboardingService, RepoIndexerService, EphemeralWorkspaceService, PromotionService],
  exports: [WorkspaceOnboardingService, RepoIndexerService, EphemeralWorkspaceService, PromotionService],
})
export class WorkspaceModule {}
