import { MigrationInterface, QueryRunner } from 'typeorm';

export class WorkspaceSnapshots1743504000000 implements MigrationInterface {
  name = 'WorkspaceSnapshots1743504000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "workspace_snapshots" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "projectId" uuid NOT NULL,
        "workspacePath" text NOT NULL,
        "remoteUrl" text,
        "remoteName" varchar(50),
        "baseBranch" varchar(255) NOT NULL DEFAULT 'main',
        "currentBranch" varchar(255) NOT NULL,
        "headSha" varchar(40) NOT NULL,
        "isDirty" boolean NOT NULL DEFAULT false,
        "indexPayload" jsonb NOT NULL DEFAULT '{}',
        "indexedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_workspace_snapshots" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_workspace_snapshots_projectId" UNIQUE ("projectId"),
        CONSTRAINT "FK_workspace_snapshots_projectId" FOREIGN KEY ("projectId")
          REFERENCES "projects"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`CREATE INDEX "IDX_workspace_snapshots_projectId" ON "workspace_snapshots" ("projectId")`);
    await queryRunner.query(`CREATE INDEX "IDX_workspace_snapshots_headSha" ON "workspace_snapshots" ("headSha")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "workspace_snapshots" CASCADE`);
  }
}
