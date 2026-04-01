import { Module } from '@nestjs/common';
import { RepoIndexerService } from './repo-indexer.service';

@Module({
  imports: [],
  providers: [RepoIndexerService],
  controllers: [],
  exports: [RepoIndexerService],
})
export class WorkspaceModule {}
