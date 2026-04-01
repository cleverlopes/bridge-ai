import { NotFoundException, ConflictException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { ProjectService, CreateProjectDto, UpdateProjectDto } from './project.service';
import { Project } from '../../persistence/entity/project.entity';

const makeProjectRepo = (): jest.Mocked<Repository<Project>> =>
  ({
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
    find: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
  }) as unknown as jest.Mocked<Repository<Project>>;

const makeProject = (overrides: Partial<Project> = {}): Project =>
  ({
    id: 'proj-uuid-1',
    slug: 'my-project',
    name: 'My Project',
    description: 'A sample project',
    stack: 'TypeScript + NestJS',
    status: 'active',
    settings: {},
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date(),
    ...overrides,
  }) as Project;

describe('ProjectService', () => {
  let service: ProjectService;
  let projectRepo: jest.Mocked<Repository<Project>>;

  beforeEach(() => {
    projectRepo = makeProjectRepo();
    service = new ProjectService(projectRepo);
  });

  describe('create()', () => {
    it('saves project and returns it', async () => {
      const dto: CreateProjectDto = {
        slug: 'new-project',
        name: 'New Project',
        description: 'Test',
        stack: 'React',
      };
      const project = makeProject({ slug: dto.slug, name: dto.name });

      projectRepo.findOne.mockResolvedValue(null);
      projectRepo.create.mockReturnValue(project);
      projectRepo.save.mockResolvedValue(project);

      const result = await service.create(dto);

      expect(projectRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          slug: dto.slug,
          name: dto.name,
          status: 'active',
        }),
      );
      expect(projectRepo.save).toHaveBeenCalled();
      expect(result).toBe(project);
    });

    it('throws ConflictException if slug already exists', async () => {
      projectRepo.findOne.mockResolvedValue(makeProject());

      await expect(
        service.create({ slug: 'existing', name: 'Existing' }),
      ).rejects.toThrow(ConflictException);
    });

    it('defaults settings to {} if not provided', async () => {
      const dto: CreateProjectDto = { slug: 'no-settings', name: 'No Settings' };
      const project = makeProject({ slug: 'no-settings' });

      projectRepo.findOne.mockResolvedValue(null);
      projectRepo.create.mockReturnValue(project);
      projectRepo.save.mockResolvedValue(project);

      await service.create(dto);

      const createArg = projectRepo.create.mock.calls[0]![0] as Partial<Project>;
      expect(createArg['settings']).toEqual({});
    });
  });

  describe('findOne()', () => {
    it('returns project when found', async () => {
      const project = makeProject();
      projectRepo.findOne.mockResolvedValue(project);

      const result = await service.findOne(project.id);
      expect(result).toBe(project);
    });

    it('throws NotFoundException when project not found', async () => {
      projectRepo.findOne.mockResolvedValue(null);

      await expect(service.findOne('nonexistent-id')).rejects.toThrow(NotFoundException);
    });
  });

  describe('findBySlug()', () => {
    it('returns project when found by slug', async () => {
      const project = makeProject();
      projectRepo.findOne.mockResolvedValue(project);

      const result = await service.findBySlug('my-project');
      expect(result).toBe(project);
    });

    it('throws NotFoundException when slug not found', async () => {
      projectRepo.findOne.mockResolvedValue(null);

      await expect(service.findBySlug('not-here')).rejects.toThrow(NotFoundException);
    });
  });

  describe('findAll()', () => {
    it('returns all projects ordered by createdAt DESC', async () => {
      const projects = [makeProject(), makeProject({ id: 'proj-2', slug: 'proj-2' })];
      projectRepo.find.mockResolvedValue(projects);

      const result = await service.findAll();

      expect(projectRepo.find).toHaveBeenCalledWith({ order: { createdAt: 'DESC' } });
      expect(result).toBe(projects);
    });
  });

  describe('update()', () => {
    it('merges settings correctly', async () => {
      const project = makeProject({
        settings: { providerId: 'claude', model: 'claude-3', autoApprove: false },
      });
      projectRepo.findOne.mockResolvedValue(project);
      const updatedProject = { ...project, settings: { providerId: 'openrouter', model: 'claude-3', autoApprove: false } };
      projectRepo.save.mockResolvedValue(updatedProject as Project);

      const dto: UpdateProjectDto = { settings: { providerId: 'openrouter' } };
      const result = await service.update(project.id, dto);

      expect(projectRepo.save).toHaveBeenCalled();
      const saveArg = projectRepo.save.mock.calls[0]![0] as Project;
      expect((saveArg.settings as Record<string, unknown>)['providerId']).toBe('openrouter');
      expect((saveArg.settings as Record<string, unknown>)['model']).toBe('claude-3');
    });

    it('updates non-settings fields directly', async () => {
      const project = makeProject();
      projectRepo.findOne.mockResolvedValue(project);
      const updatedProject = { ...project, name: 'Updated Name' } as Project;
      projectRepo.save.mockResolvedValue(updatedProject);

      const dto: UpdateProjectDto = { name: 'Updated Name' };
      const result = await service.update(project.id, dto);

      expect(projectRepo.save).toHaveBeenCalled();
    });

    it('throws NotFoundException if project does not exist', async () => {
      projectRepo.findOne.mockResolvedValue(null);

      await expect(service.update('nonexistent', { name: 'X' })).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove()', () => {
    it('removes the project', async () => {
      const project = makeProject();
      projectRepo.findOne.mockResolvedValue(project);
      projectRepo.remove.mockResolvedValue(project);

      await service.remove(project.id);

      expect(projectRepo.remove).toHaveBeenCalledWith(project);
    });

    it('throws NotFoundException if project not found', async () => {
      projectRepo.findOne.mockResolvedValue(null);

      await expect(service.remove('missing')).rejects.toThrow(NotFoundException);
    });
  });
});
