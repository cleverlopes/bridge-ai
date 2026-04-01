import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WorkspaceSnapshot } from '../../persistence/entity/workspace-snapshot.entity';
import { Project } from '../../persistence/entity/project.entity';
import { KsmModule } from '../ksm/ksm.module';
import { WorkspaceOnboardingService } from './workspace-onboarding.service';
import { RepoIndexerService } from './repo-indexer.service';
import { EphemeralWorkspaceService } from './ephemeral-workspace.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([WorkspaceSnapshot, Project]),
    KsmModule,
  ],
  providers: [WorkspaceOnboardingService, RepoIndexerService, EphemeralWorkspaceService],
  controllers: [],
  exports: [WorkspaceOnboardingService, RepoIndexerService, EphemeralWorkspaceService],
})
export class WorkspaceModule {}
