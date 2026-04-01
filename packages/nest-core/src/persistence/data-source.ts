import "reflect-metadata";
import { DataSource } from "typeorm";
import { AppEvent } from "./entity/event.entity";
import { ExecutionMetric } from "./entity/execution-metric.entity";
import { Phase } from "./entity/phase.entity";
import { Plan } from "./entity/plan.entity";
import { Project } from "./entity/project.entity";
import { SecretAudit } from "./entity/secret-audit.entity";
import { Secret } from "./entity/secret.entity";

const DATABASE_URL =
  process.env["DATABASE_URL"] ??
  "postgresql://bridge:bridge@localhost:5432/bridge";

export const AppDataSource = new DataSource({
  type: "postgres",
  url: DATABASE_URL,
  entities: [
    Project,
    Plan,
    Phase,
    ExecutionMetric,
    AppEvent,
    Secret,
    SecretAudit,
  ],
  migrations: ["src/migrations/*.ts"],
  synchronize: false,
  logging: process.env["NODE_ENV"] !== "production",
});
