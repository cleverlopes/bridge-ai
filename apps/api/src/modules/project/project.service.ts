import {
  Injectable,
  Logger,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Project, ProjectSettings, ProjectStatus } from '../../entities/project.entity';

export interface CreateProjectDto {
  slug: string;
  name: string;
  description?: string;
  stack?: string;
  settings?: ProjectSettings;
}

export interface UpdateProjectDto {
  name?: string;
  description?: string;
  stack?: string;
  status?: ProjectStatus;
  settings?: Partial<ProjectSettings>;
}

@Injectable()
export class ProjectService {
  private readonly logger = new Logger(ProjectService.name);

  constructor(
    @InjectRepository(Project)
    private readonly projectRepo: Repository<Project>,
  ) {}

  async create(dto: CreateProjectDto): Promise<Project> {
    const existing = await this.projectRepo.findOne({ where: { slug: dto.slug } });
    if (existing) {
      throw new ConflictException(`Project with slug '${dto.slug}' already exists`);
    }

    const project = this.projectRepo.create({
      slug: dto.slug,
      name: dto.name,
      description: dto.description ?? null,
      stack: dto.stack ?? null,
      status: 'active',
      settings: dto.settings ?? {},
    });

    const saved = await this.projectRepo.save(project);
    this.logger.log(`Created project ${saved.id} (${saved.slug})`);
    return saved;
  }

  async findAll(): Promise<Project[]> {
    return this.projectRepo.find({ order: { createdAt: 'DESC' } });
  }

  async findOne(id: string): Promise<Project> {
    const project = await this.projectRepo.findOne({ where: { id } });
    if (!project) {
      throw new NotFoundException(`Project ${id} not found`);
    }
    return project;
  }

  async findBySlug(slug: string): Promise<Project> {
    const project = await this.projectRepo.findOne({ where: { slug } });
    if (!project) {
      throw new NotFoundException(`Project '${slug}' not found`);
    }
    return project;
  }

  async update(id: string, dto: UpdateProjectDto): Promise<Project> {
    const project = await this.findOne(id);

    if (dto.settings) {
      dto.settings = { ...project.settings, ...dto.settings };
    }

    Object.assign(project, dto);
    return this.projectRepo.save(project);
  }

  async remove(id: string): Promise<void> {
    const project = await this.findOne(id);
    await this.projectRepo.remove(project);
    this.logger.log(`Removed project ${id}`);
  }
}
