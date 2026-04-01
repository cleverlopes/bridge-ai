import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialSchema1711843200000 implements MigrationInterface {
  name = 'InitialSchema1711843200000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "projects" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "slug" varchar(100) NOT NULL,
        "name" varchar(255) NOT NULL,
        "description" text,
        "stack" text,
        "status" varchar(20) NOT NULL DEFAULT 'active',
        "settings" jsonb NOT NULL DEFAULT '{}',
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_projects" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_projects_slug" UNIQUE ("slug")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "plans" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "projectId" uuid NOT NULL,
        "status" varchar(30) NOT NULL DEFAULT 'draft',
        "prompt" text,
        "conversationId" varchar(100),
        "roadmapPath" text,
        "workspacePath" text,
        "providerId" varchar(100),
        "failReason" text,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_plans" PRIMARY KEY ("id"),
        CONSTRAINT "FK_plans_projectId" FOREIGN KEY ("projectId")
          REFERENCES "projects"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "phases" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "planId" uuid NOT NULL,
        "phaseNumber" smallint NOT NULL,
        "phaseName" varchar(255) NOT NULL,
        "status" varchar(20) NOT NULL DEFAULT 'pending',
        "startedAt" TIMESTAMP WITH TIME ZONE,
        "completedAt" TIMESTAMP WITH TIME ZONE,
        CONSTRAINT "PK_phases" PRIMARY KEY ("id"),
        CONSTRAINT "FK_phases_planId" FOREIGN KEY ("planId")
          REFERENCES "plans"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "execution_metrics" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "phaseId" uuid NOT NULL,
        "projectId" uuid NOT NULL,
        "durationMs" integer NOT NULL DEFAULT 0,
        "costUsd" numeric(10,6),
        "tokensIn" integer NOT NULL DEFAULT 0,
        "tokensOut" integer NOT NULL DEFAULT 0,
        "modelUsed" varchar(100),
        "iterationCount" smallint NOT NULL DEFAULT 0,
        "success" boolean NOT NULL DEFAULT false,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_execution_metrics" PRIMARY KEY ("id"),
        CONSTRAINT "FK_execution_metrics_phaseId" FOREIGN KEY ("phaseId")
          REFERENCES "phases"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_execution_metrics_projectId" FOREIGN KEY ("projectId")
          REFERENCES "projects"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "events" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "type" varchar(100) NOT NULL,
        "channel" varchar(100) NOT NULL,
        "correlationId" uuid,
        "conversationId" uuid,
        "payload" jsonb NOT NULL DEFAULT '{}',
        "status" varchar(20) NOT NULL DEFAULT 'pending',
        "processedAt" TIMESTAMP WITH TIME ZONE,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_events" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`CREATE INDEX "IDX_events_type" ON "events" ("type")`);
    await queryRunner.query(`CREATE INDEX "IDX_events_channel" ON "events" ("channel")`);
    await queryRunner.query(`CREATE INDEX "IDX_events_correlationId" ON "events" ("correlationId")`);

    await queryRunner.query(`
      CREATE TABLE "secrets" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "name" varchar(200) NOT NULL,
        "scope" varchar(20) NOT NULL DEFAULT 'global',
        "scopeId" uuid,
        "encryptedValue" text NOT NULL,
        "algorithm" varchar(20) NOT NULL DEFAULT 'aes-256-gcm',
        "keyVersion" smallint NOT NULL DEFAULT 1,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_secrets" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_secrets_name_scope_scopeId" UNIQUE ("name", "scope", "scopeId")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "secret_audit" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "secretId" uuid NOT NULL,
        "action" varchar(20) NOT NULL,
        "callerModule" varchar(200) NOT NULL,
        "callerProjectId" uuid,
        "accessedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_secret_audit" PRIMARY KEY ("id"),
        CONSTRAINT "FK_secret_audit_secretId" FOREIGN KEY ("secretId")
          REFERENCES "secrets"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`CREATE INDEX "IDX_secret_audit_secretId" ON "secret_audit" ("secretId")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "secret_audit" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "secrets" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "events" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "execution_metrics" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "phases" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "plans" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "projects" CASCADE`);
  }
}
