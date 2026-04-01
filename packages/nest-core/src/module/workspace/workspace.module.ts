import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WorkspaceController } from './workspace.controller';
import { WorkspaceOnboardingService } from './workspace-onboarding.service';
import { RepoIndexerService } from './repo-indexer.service';
import { EphemeralWorkspaceService } from './ephemeral-workspace.service';
import { PromotionService } from './promotion.service';
import { WorkspaceSnapshot } from '../../persistence/entity/workspace-snapshot.entity';
import { Project } from '../../persistence/entity/project.entity';
import { KsmModule } from '../ksm/ksm.module';
import { BrainModule } from '../brain/brain.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([WorkspaceSnapshot, Project]),
    KsmModule,
    BrainModule,
  ],
  controllers: [WorkspaceController],
  providers: [
    WorkspaceOnboardingService,
    RepoIndexerService,
    EphemeralWorkspaceService,
    PromotionService,
  ],
  exports: [
    WorkspaceOnboardingService,
    RepoIndexerService,
    EphemeralWorkspaceService,
    PromotionService,
  ],
})
export class WorkspaceModule {}
