import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WorkspaceSnapshot } from '../../persistence/entity/workspace-snapshot.entity';
import { Project } from '../../persistence/entity/project.entity';
import { KsmModule } from '../ksm/ksm.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([WorkspaceSnapshot, Project]),
    KsmModule,
  ],
  providers: [],
  controllers: [],
  exports: [],
})
export class WorkspaceModule {}
