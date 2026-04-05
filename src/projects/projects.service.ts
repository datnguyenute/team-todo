import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Project } from './entities/project.entity';
import { WorkspaceMember, WorkspaceRole } from '../workspaces/entities/workspace-member.entity';
import { CreateProjectDto } from './dto/create-project.dto';

@Injectable()
export class ProjectsService {
  constructor(
    @InjectRepository(Project)
    private readonly projectsRepo: Repository<Project>,
    @InjectRepository(WorkspaceMember)
    private readonly membersRepo: Repository<WorkspaceMember>,
  ) {}

  private async assertMember(workspaceId: string, userId: string) {
    const member = await this.membersRepo.findOne({ where: { workspaceId, userId } });
    if (!member) throw new ForbiddenException('Not a workspace member');
    return member;
  }

  async create(workspaceId: string, userId: string, dto: CreateProjectDto): Promise<Project> {
    const member = await this.assertMember(workspaceId, userId);
    if (member.role === WorkspaceRole.VIEWER) {
      throw new ForbiddenException('Viewers cannot create projects');
    }
    return this.projectsRepo.save(
      this.projectsRepo.create({ ...dto, workspaceId, createdById: userId }),
    );
  }

  async findAll(workspaceId: string, userId: string): Promise<Project[]> {
    await this.assertMember(workspaceId, userId);
    return this.projectsRepo.find({ where: { workspaceId } });
  }

  async findOne(id: string, workspaceId: string, userId: string): Promise<Project> {
    await this.assertMember(workspaceId, userId);
    const project = await this.projectsRepo.findOne({ where: { id, workspaceId } });
    if (!project) throw new NotFoundException('Project not found');
    return project;
  }

  async remove(id: string, workspaceId: string, userId: string): Promise<void> {
    const member = await this.assertMember(workspaceId, userId);
    const project = await this.projectsRepo.findOne({ where: { id, workspaceId } });
    if (!project) throw new NotFoundException('Project not found');

    const canDelete =
      project.createdById === userId ||
      member.role === WorkspaceRole.OWNER ||
      member.role === WorkspaceRole.ADMIN;

    if (!canDelete) throw new ForbiddenException('Cannot delete this project');

    await this.projectsRepo.remove(project);
  }
}
