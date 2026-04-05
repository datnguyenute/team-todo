import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Workspace } from './entities/workspace.entity';
import { WorkspaceMember, WorkspaceRole } from './entities/workspace-member.entity';
import { CreateWorkspaceDto } from './dto/create-workspace.dto';
import { InviteUserDto } from './dto/invite-user.dto';
import { UsersService } from '../users/users.service';

@Injectable()
export class WorkspacesService {
  constructor(
    @InjectRepository(Workspace)
    private readonly workspacesRepo: Repository<Workspace>,
    @InjectRepository(WorkspaceMember)
    private readonly membersRepo: Repository<WorkspaceMember>,
    private readonly usersService: UsersService,
  ) {}

  async create(userId: string, dto: CreateWorkspaceDto): Promise<Workspace> {
    const slug =
      dto.slug ??
      dto.name
        .toLowerCase()
        .replace(/\s+/g, '-')
        .replace(/[^a-z0-9-]/g, '');

    const exists = await this.workspacesRepo.findOneBy({ slug });
    if (exists) throw new ConflictException('Slug already in use');

    const workspace = await this.workspacesRepo.save(
      this.workspacesRepo.create({ name: dto.name, slug, ownerId: userId }),
    );

    await this.membersRepo.save(
      this.membersRepo.create({
        workspaceId: workspace.id,
        userId,
        role: WorkspaceRole.OWNER,
        joinedAt: new Date(),
      }),
    );

    return workspace;
  }

  findAllForUser(userId: string): Promise<Workspace[]> {
    return this.workspacesRepo
      .createQueryBuilder('ws')
      .innerJoin('ws.members', 'wm', 'wm.userId = :userId', { userId })
      .leftJoinAndSelect('ws.owner', 'owner')
      .select(['ws', 'owner.id', 'owner.name', 'owner.email'])
      .getMany();
  }

  async findOne(id: string, userId: string): Promise<Workspace> {
    const ws = await this.workspacesRepo
      .createQueryBuilder('ws')
      .innerJoin('ws.members', 'myMembership', 'myMembership.userId = :userId', { userId })
      .leftJoinAndSelect('ws.members', 'members')
      .leftJoinAndSelect('members.user', 'memberUser')
      .select(['ws', 'members', 'memberUser.id', 'memberUser.name', 'memberUser.email'])
      .where('ws.id = :id', { id })
      .getOne();

    if (!ws) throw new NotFoundException('Workspace not found');
    return ws;
  }

  async invite(workspaceId: string, dto: InviteUserDto): Promise<WorkspaceMember> {
    const user = await this.usersService.findByEmail(dto.email);
    if (!user) throw new NotFoundException('User not found');

    const existing = await this.membersRepo.findOne({
      where: { workspaceId, userId: user.id },
    });
    if (existing) throw new ConflictException('User already in workspace');

    return this.membersRepo.save(
      this.membersRepo.create({
        workspaceId,
        userId: user.id,
        role: dto.role ?? WorkspaceRole.MEMBER,
        joinedAt: new Date(),
      }),
    );
  }

  async getMembers(workspaceId: string, userId: string): Promise<WorkspaceMember[]> {
    const isMember = await this.membersRepo.findOne({ where: { workspaceId, userId } });
    if (!isMember) throw new ForbiddenException('Not a workspace member');

    return this.membersRepo.find({
      where: { workspaceId },
      relations: { user: true },
      select: {
        workspaceId: true,
        userId: true,
        role: true,
        joinedAt: true,
        user: { id: true, name: true, email: true },
      },
    });
  }
}
