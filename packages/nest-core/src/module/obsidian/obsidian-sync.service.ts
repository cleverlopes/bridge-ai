import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { mkdir, writeFile, copyFile, rename, access, readdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import type { GSDPhaseCompleteEvent } from '@bridge-ai/gsd-sdk';
import { ExecutionMetric } from '../../persistence/entity/execution-metric.entity';
import { Phase } from '../../persistence/entity/phase.entity';
import { Plan } from '../../persistence/entity/plan.entity';
import { Project } from '../../persistence/entity/project.entity';
import { ExecutionMetricsService } from '../metrics/metrics.service';
import { VAULT_TEMPLATES, RULES_AND_CONVENTIONS_CONTENT } from './obsidian.templates';

const VAULT_PATH = resolve(process.cwd(), 'volumes', 'obsidian');
const WORKSPACES_PATH = resolve(process.cwd(), 'volumes', 'workspaces');

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function safeCopyFile(src: string, dest: string): Promise<void> {
  if (await fileExists(src)) {
    await copyFile(src, dest);
  }
}

function todayIso(): string {
  return new Date().toISOString().split('T')[0] ?? new Date().toISOString();
}

function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
}

@Injectable()
export class ObsidianSyncService {
  private readonly logger = new Logger(ObsidianSyncService.name);

  constructor(
    @InjectRepository(Project)
    private readonly projectRepo: Repository<Project>,
    @InjectRepository(Plan)
    private readonly planRepo: Repository<Plan>,
    @InjectRepository(Phase)
    private readonly phaseRepo: Repository<Phase>,
    @InjectRepository(ExecutionMetric)
    private readonly metricRepo: Repository<ExecutionMetric>,
    private readonly metricsService: ExecutionMetricsService,
  ) {}

  async getProjectSlug(projectId: string): Promise<string | null> {
    const project = await this.projectRepo.findOne({ where: { id: projectId } });
    return project?.slug ?? null;
  }

  async ensureVaultStructure(): Promise<void> {
    try {
      const dirs = [
        'projects', 'areas', 'resources', 'archive', 'inbox',
        'Assets', 'Attachments', 'Templates',
      ];
      for (const dir of dirs) {
        await mkdir(join(VAULT_PATH, dir), { recursive: true });
      }

      const rulesPath = join(VAULT_PATH, 'RULES-AND-CONVENTIONS.md');
      if (!(await fileExists(rulesPath))) {
        await writeFile(rulesPath, RULES_AND_CONVENTIONS_CONTENT(todayIso()), 'utf8');
      }

      const indexPath = join(VAULT_PATH, 'index.md');
      if (!(await fileExists(indexPath))) {
        await this.generateIndex();
      }
    } catch (err) {
      this.logger.error(`ensureVaultStructure failed: ${err instanceof Error ? err.message : err}`);
    }
  }

  async syncProject(projectId: string): Promise<void> {
    try {
      const project = await this.projectRepo.findOne({ where: { id: projectId } });
      if (!project) {
        this.logger.warn(`syncProject: project ${projectId} not found`);
        return;
      }

      const latestPlan = await this.planRepo.findOne({
        where: { projectId },
        order: { createdAt: 'DESC' },
      });

      const phases = latestPlan
        ? await this.phaseRepo.find({
            where: { planId: latestPlan.id },
            order: { phaseNumber: 'ASC' },
          })
        : [];

      const metrics = await this.metricRepo.find({ where: { projectId } });
      const totalCost = metrics.reduce((sum, m) => sum + (m.costUsd ?? 0), 0);

      const projectVaultDir = join(VAULT_PATH, 'projects', project.slug);
      const phasesDir = join(projectVaultDir, 'phases');
      await mkdir(phasesDir, { recursive: true });

      const latestPhase = phases[phases.length - 1];
      const moc = this.buildMoc(project, latestPlan, latestPhase, totalCost);
      await writeFile(join(projectVaultDir, 'MOC.md'), moc, 'utf8');

      const workspaceDir = join(WORKSPACES_PATH, projectId);
      await safeCopyFile(
        join(workspaceDir, '.planning', 'ROADMAP.md'),
        join(projectVaultDir, 'ROADMAP.md'),
      );
      await safeCopyFile(
        join(workspaceDir, '.planning', 'STATE.md'),
        join(projectVaultDir, 'STATE.md'),
      );

      const requirementsPath = join(projectVaultDir, 'REQUIREMENTS.md');
      if (!(await fileExists(requirementsPath))) {
        await writeFile(requirementsPath, this.buildRequirementsStub(project), 'utf8');
      }

      const configPath = join(projectVaultDir, 'CONFIG.md');
      await writeFile(configPath, this.buildConfig(project, latestPlan), 'utf8');

      const readmePath = join(projectVaultDir, 'README.md');
      if (!(await fileExists(readmePath))) {
        await writeFile(readmePath, this.buildReadme(project), 'utf8');
      }

      for (const phase of phases) {
        const phaseSlug = `${String(phase.phaseNumber).padStart(2, '0')}-${phase.phaseName.toLowerCase().replace(/\s+/g, '-')}`;
        const phaseDir = join(phasesDir, phaseSlug);
        await mkdir(phaseDir, { recursive: true });

        const contextPath = join(phaseDir, 'CONTEXT.md');
        if (!(await fileExists(contextPath))) {
          await writeFile(contextPath, this.buildPhaseContext(phase, project), 'utf8');
        }

        const wsPhaseDir = join(workspaceDir, '.planning', 'phases', phaseSlug);
        const fixedArtifacts = ['PLAN.md', 'VERIFICATION.md', 'SUMMARY.md'];
        for (const artifact of fixedArtifacts) {
          await safeCopyFile(join(wsPhaseDir, artifact), join(phaseDir, artifact));
        }
        try {
          const entries = await readdir(wsPhaseDir).catch(() => [] as string[]);
          for (const entry of entries) {
            if (/^PLAN[-_]/.test(entry) && entry.endsWith('.md')) {
              await safeCopyFile(join(wsPhaseDir, entry), join(phaseDir, entry));
            }
          }
        } catch {
          // Best-effort: directory may not exist yet
        }
      }
    } catch (err) {
      this.logger.error(`syncProject(${projectId}) failed: ${err instanceof Error ? err.message : err}`);
    }
  }

  async generateIndex(): Promise<void> {
    try {
      const today = todayIso();
      const content = `---
type: index
title: "Bridge-AI Brain"
updated: ${today}
---

# Bridge-AI Brain

## Active Projects
\`\`\`dataview
TABLE file.link AS "Project", status, phase, cost_usd
FROM "projects"
WHERE contains(tags, "status/active") OR contains(tags, "status/executing")
SORT updated DESC
\`\`\`

## Recent Projects
\`\`\`dataview
TABLE file.link AS "Project", status, phase_name, cost_usd
FROM "projects"
WHERE type = "project"
SORT updated DESC
LIMIT 10
\`\`\`

## Inbox
\`\`\`dataview
LIST
FROM "inbox"
SORT created DESC
\`\`\`
`;
      await writeFile(join(VAULT_PATH, 'index.md'), content, 'utf8');
    } catch (err) {
      this.logger.error(`generateIndex failed: ${err instanceof Error ? err.message : err}`);
    }
  }

  async generateMetricsDashboard(): Promise<void> {
    try {
      const agg = await this.metricsService.getAggregatedMetrics();
      const today = todayIso();
      const timestamp = new Date().toISOString();

      const projectRows = agg.byProject
        .map(p => `| ${p.slug} | ${p.phases} | $${p.totalCostUsd.toFixed(4)} | ${formatDuration(p.avgDurationMs)} |`)
        .join('\n');

      const modelRows = agg.byModel
        .map(m => `| ${m.model} | ${m.uses} | $${m.totalCostUsd.toFixed(4)} |`)
        .join('\n');

      const content = `---
type: resource
title: "Execution Metrics"
updated: ${today}
---

# Execution Metrics

**Last updated:** ${timestamp}

## Summary
| Metric | Value |
|--------|-------|
| Total Phases | ${agg.totalPhases} |
| Total Cost | $${agg.totalCostUsd.toFixed(4)} |
| Success Rate | ${agg.successRate.toFixed(1)}% |
| Total Duration | ${formatDuration(agg.totalDurationMs)} |

## Cost by Project
| Project | Phases | Cost | Avg Duration |
|---------|--------|------|-------------|
${projectRows || '| — | — | — | — |'}

## Cost by Model
| Model | Uses | Total Cost |
|-------|------|-----------|
${modelRows || '| — | — | — |'}
`;
      await writeFile(join(VAULT_PATH, 'metrics.md'), content, 'utf8');
    } catch (err) {
      this.logger.error(`generateMetricsDashboard failed: ${err instanceof Error ? err.message : err}`);
    }
  }

  async ensureTemplates(): Promise<void> {
    try {
      const templatesDir = join(VAULT_PATH, 'Templates');
      await mkdir(templatesDir, { recursive: true });

      for (const [filename, content] of Object.entries(VAULT_TEMPLATES)) {
        const templatePath = join(templatesDir, filename);
        if (!(await fileExists(templatePath))) {
          await writeFile(templatePath, content, 'utf8');
        }
      }
    } catch (err) {
      this.logger.error(`ensureTemplates failed: ${err instanceof Error ? err.message : err}`);
    }
  }

  async archiveProject(projectId: string): Promise<void> {
    try {
      const project = await this.projectRepo.findOne({ where: { id: projectId } });
      if (!project) return;

      const latestPlan = await this.planRepo.findOne({
        where: { projectId },
        order: { createdAt: 'DESC' },
      });

      const archivable = latestPlan?.status === 'completed' || latestPlan?.status === 'archived';
      if (!archivable) return;

      const src = join(VAULT_PATH, 'projects', project.slug);
      const archiveDir = join(VAULT_PATH, 'archive', 'projects');
      await mkdir(archiveDir, { recursive: true });
      const dest = join(archiveDir, project.slug);

      if (await fileExists(src)) {
        await rename(src, dest);
        this.logger.log(`Archived project ${project.slug} to archive/projects/`);
      }
    } catch (err) {
      this.logger.error(`archiveProject(${projectId}) failed: ${err instanceof Error ? err.message : err}`);
    }
  }

  async onPhaseComplete(
    event: GSDPhaseCompleteEvent,
    planId: string,
    projectId: string,
  ): Promise<void> {
    try {
      await this.metricsService.recordPhaseFromGsdEvent(event, planId, projectId);
    } catch (err) {
      this.logger.error(`onPhaseComplete recordPhaseFromGsdEvent failed: ${err instanceof Error ? err.message : err}`);
    }
    await this.syncProject(projectId);
    await this.generateIndex();
    await this.generateMetricsDashboard();
  }

  async onPlanComplete(planId: string, projectId: string): Promise<void> {
    void planId;
    await this.syncProject(projectId);
    await this.generateIndex();
    await this.generateMetricsDashboard();
  }

  async onMilestoneComplete(projectId: string): Promise<void> {
    await this.syncProject(projectId);
    await this.generateIndex();
    await this.generateMetricsDashboard();
  }

  private buildMoc(
    project: Project,
    plan: Plan | null,
    latestPhase: Phase | undefined,
    totalCost: number,
  ): string {
    const today = todayIso();
    const status = plan?.status ?? 'draft';
    const phaseNumber = latestPhase ? String(latestPhase.phaseNumber) : '0';
    const phaseName = latestPhase?.phaseName ?? '';

    return `---
type: project
scope: project
project: ${project.slug}
status: ${status}
phase: "${phaseNumber}"
phase_name: "${phaseName}"
cost_usd: ${totalCost.toFixed(4)}
created: ${project.createdAt.toISOString().split('T')[0]}
updated: ${today}
tags:
  - status/${status}
  - project/${project.slug}
links: []
---

# ${project.name}

${project.description ?? ''}

## Overview
- **Status:** ${status}
- **Current Phase:** ${phaseNumber}${phaseName ? ` — ${phaseName}` : ''}
- **Total Cost:** $${totalCost.toFixed(4)}
- **Stack:** ${project.stack ?? 'Not specified'}

## Navigation
- [[ROADMAP]] — Execution roadmap
- [[STATE]] — Current state
- [[CONFIG]] — Project configuration
- [[phases/]] — Phase artifacts
`;
  }

  private buildReadme(project: Project): string {
    const today = todayIso();
    return `---
type: project
title: "${project.name}"
created: ${project.createdAt.toISOString().split('T')[0]}
updated: ${today}
tags:
  - project/${project.slug}
---

# ${project.name}

${project.description ?? ''}

**Stack:** ${project.stack ?? 'Not specified'}

See [[MOC]] for the full project map.
`;
  }

  private buildRequirementsStub(project: Project): string {
    const today = todayIso();
    return `---
type: resource
title: "${project.name} Requirements"
project: ${project.slug}
created: ${today}
updated: ${today}
tags:
  - project/${project.slug}
---

# Requirements

> Requirements will be populated during project planning.
`;
  }

  private buildConfig(project: Project, plan: Plan | null): string {
    const today = todayIso();
    const settings = { ...project.settings };
    return `---
type: resource
title: "${project.name} Config"
project: ${project.slug}
updated: ${today}
tags:
  - project/${project.slug}
---

# Project Configuration

| Field | Value |
|-------|-------|
| ID | ${project.id} |
| Slug | ${project.slug} |
| Status | ${project.status} |
| Provider | ${settings.providerId ?? 'default'} |
| Model | ${settings.model ?? 'default'} |
| Auto Approve | ${String(settings.autoApprove ?? false)} |
| Max Budget | ${settings.maxBudgetUsd != null ? `$${settings.maxBudgetUsd}` : 'unlimited'} |
| Max Turns | ${settings.maxTurnsPerStep ?? 'default'} |
${plan ? `| Active Plan | ${plan.id} |` : ''}
`;
  }

  private buildPhaseContext(phase: Phase, project: Project): string {
    const today = todayIso();
    return `---
type: resource
title: "Phase ${phase.phaseNumber}: ${phase.phaseName}"
project: ${project.slug}
phase: ${phase.phaseNumber}
phase_name: "${phase.phaseName}"
status: ${phase.status}
created: ${today}
updated: ${today}
tags:
  - project/${project.slug}
  - phase/${phase.phaseNumber}
---

# Phase ${phase.phaseNumber}: ${phase.phaseName}

## Objective

> Describe the phase objective here.

## Context

> Add relevant context, dependencies, and constraints.

## Notes

> Free-form notes, decisions, discoveries.
`;
  }
}
