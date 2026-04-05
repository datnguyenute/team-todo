import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Task } from './entities/task.entity';
import { Project } from '../projects/entities/project.entity';
import { WorkspaceMember, WorkspaceRole } from '../workspaces/entities/workspace-member.entity';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { QueryTaskDto } from './dto/query-task.dto';
import { BulkTaskDto, BulkAction } from './dto/bulk-task.dto';

const SORT_FIELDS = new Set(['createdAt', 'dueDate', 'priority', 'status']);

@Injectable()
export class TasksService {
  constructor(
    @InjectRepository(Task)
    private readonly tasksRepo: Repository<Task>,
    @InjectRepository(Project)
    private readonly projectsRepo: Repository<Project>,
    @InjectRepository(WorkspaceMember)
    private readonly membersRepo: Repository<WorkspaceMember>,
  ) {}

  private async resolveProject(projectId: string, userId: string): Promise<Project> {
    const project = await this.projectsRepo.findOneBy({ id: projectId });
    if (!project) throw new NotFoundException('Project not found');

    const member = await this.membersRepo.findOne({
      where: { workspaceId: project.workspaceId, userId },
    });
    if (!member) throw new ForbiddenException('Not a workspace member');

    return project;
  }

  async create(projectId: string, userId: string, dto: CreateTaskDto): Promise<Task> {
    const project = await this.resolveProject(projectId, userId);
    const member = await this.membersRepo.findOne({
      where: { workspaceId: project.workspaceId, userId },
    });
    if (member?.role === WorkspaceRole.VIEWER) {
      throw new ForbiddenException('Viewers cannot create tasks');
    }

    return this.tasksRepo.save(
      this.tasksRepo.create({
        ...dto,
        projectId,
        workspaceId: project.workspaceId,
        createdById: userId,
      }),
    );
  }

  async findAll(
    projectId: string,
    userId: string,
    query: QueryTaskDto,
  ): Promise<{ data: Task[]; total: number; page: number; limit: number }> {
    const project = await this.resolveProject(projectId, userId);

    const qb = this.tasksRepo
      .createQueryBuilder('t')
      .where('t.projectId = :projectId', { projectId })
      .andWhere('t.workspaceId = :workspaceId', { workspaceId: project.workspaceId });

    if (query.status) qb.andWhere('t.status = :status', { status: query.status });
    if (query.priority) qb.andWhere('t.priority = :priority', { priority: query.priority });
    if (query.assignee) qb.andWhere('t.assigneeId = :assignee', { assignee: query.assignee });
    if (query.dueFrom) qb.andWhere('t.dueDate >= :dueFrom', { dueFrom: query.dueFrom });
    if (query.dueTo) qb.andWhere('t.dueDate <= :dueTo', { dueTo: query.dueTo });
    if (query.q) {
      qb.andWhere('(t.title ILIKE :q OR t.description ILIKE :q)', {
        q: `%${query.q}%`,
      });
    }

    const [field, dir] = (query.sort ?? 'createdAt:desc').split(':');
    const safeField = SORT_FIELDS.has(field) ? field : 'createdAt';
    const safeDir = dir === 'asc' ? 'ASC' : 'DESC';
    qb.orderBy(`t.${safeField}`, safeDir);

    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    qb.skip((page - 1) * limit).take(limit);

    const [data, total] = await qb.getManyAndCount();
    return { data, total, page, limit };
  }

  async findOne(id: string, userId: string): Promise<Task> {
    const task = await this.tasksRepo.findOne({
      where: { id },
      relations: { assignee: true, createdBy: true, tags: true },
    });
    if (!task) throw new NotFoundException('Task not found');

    const member = await this.membersRepo.findOne({
      where: { workspaceId: task.workspaceId, userId },
    });
    if (!member) throw new ForbiddenException();

    return task;
  }

  async update(id: string, userId: string, dto: UpdateTaskDto): Promise<Task> {
    const task = await this.findOne(id, userId);

    const member = await this.membersRepo.findOne({
      where: { workspaceId: task.workspaceId, userId },
    });
    if (member?.role === WorkspaceRole.VIEWER) {
      throw new ForbiddenException('Viewers cannot update tasks');
    }

    Object.assign(task, dto);
    return this.tasksRepo.save(task);
  }

  async remove(id: string, userId: string): Promise<void> {
    const task = await this.findOne(id, userId);

    const member = await this.membersRepo.findOne({
      where: { workspaceId: task.workspaceId, userId },
    });

    const canDelete =
      task.createdById === userId ||
      task.assigneeId === userId ||
      member?.role === WorkspaceRole.OWNER ||
      member?.role === WorkspaceRole.ADMIN;

    if (!canDelete) throw new ForbiddenException('Cannot delete this task');

    await this.tasksRepo.softDelete(id);
  }

  async restore(id: string, userId: string): Promise<void> {
    const task = await this.tasksRepo.findOne({
      where: { id },
      withDeleted: true,
    });
    if (!task || !task.deletedAt) throw new NotFoundException('Task not found in trash');

    const member = await this.membersRepo.findOne({
      where: { workspaceId: task.workspaceId, userId },
    });
    if (!member) throw new ForbiddenException();

    await this.tasksRepo.restore(id);
  }

  async bulk(workspaceId: string, userId: string, dto: BulkTaskDto): Promise<{ affected: number }> {
    const member = await this.membersRepo.findOne({ where: { workspaceId, userId } });
    if (!member) throw new ForbiddenException('Not a workspace member');

    if (dto.action === BulkAction.STATUS && dto.status) {
      const result = await this.tasksRepo
        .createQueryBuilder()
        .update(Task)
        .set({ status: dto.status })
        .whereInIds(dto.ids)
        .andWhere('workspaceId = :workspaceId', { workspaceId })
        .execute();
      return { affected: result.affected ?? 0 };
    }

    if (dto.action === BulkAction.ASSIGNEE) {
      const result = await this.tasksRepo
        .createQueryBuilder()
        .update(Task)
        .set({ assigneeId: dto.assigneeId ?? null })
        .whereInIds(dto.ids)
        .andWhere('workspaceId = :workspaceId', { workspaceId })
        .execute();
      return { affected: result.affected ?? 0 };
    }

    if (dto.action === BulkAction.DELETE) {
      const result = await this.tasksRepo
        .createQueryBuilder()
        .softDelete()
        .whereInIds(dto.ids)
        .andWhere('workspaceId = :workspaceId', { workspaceId })
        .execute();
      return { affected: result.affected ?? 0 };
    }

    if (dto.action === BulkAction.RESTORE) {
      const result = await this.tasksRepo
        .createQueryBuilder()
        .restore()
        .whereInIds(dto.ids)
        .andWhere('workspaceId = :workspaceId', { workspaceId })
        .execute();
      return { affected: result.affected ?? 0 };
    }

    return { affected: 0 };
  }
}
