import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PERMISSIONS_KEY } from '../decorators/permissions.decorator';
import {
  WorkspaceMember,
  WorkspaceRole,
} from '../../workspaces/entities/workspace-member.entity';
import { JwtPayload } from '../../auth/strategies/jwt.strategy';

// Permission matrix per role
const ROLE_PERMISSIONS: Record<WorkspaceRole, string[]> = {
  [WorkspaceRole.OWNER]: [
    'workspace:manage',
    'workspace:invite',
    'workspace:view',
    'project:create',
    'project:manage',
    'project:view',
    'task:create',
    'task:update',
    'task:delete',
    'task:view',
    'comment:create',
    'attachment:upload',
  ],
  [WorkspaceRole.ADMIN]: [
    'workspace:invite',
    'workspace:view',
    'project:create',
    'project:manage',
    'project:view',
    'task:create',
    'task:update',
    'task:delete',
    'task:view',
    'comment:create',
    'attachment:upload',
  ],
  [WorkspaceRole.MEMBER]: [
    'workspace:view',
    'project:view',
    'task:create',
    'task:update',
    'task:view',
    'comment:create',
    'attachment:upload',
  ],
  [WorkspaceRole.VIEWER]: ['workspace:view', 'project:view', 'task:view'],
};

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @InjectRepository(WorkspaceMember)
    private readonly membersRepo: Repository<WorkspaceMember>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<string[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!required?.length) return true;

    const req = context.switchToHttp().getRequest<{
      user: JwtPayload;
      params: Record<string, string>;
    }>();

    const userId = req.user?.sub;
    const workspaceId = req.params.wid ?? req.params.workspaceId;

    if (!userId || !workspaceId) throw new ForbiddenException();

    const member = await this.membersRepo.findOne({
      where: { workspaceId, userId },
    });

    if (!member) throw new ForbiddenException('Not a workspace member');

    const allowed = ROLE_PERMISSIONS[member.role] ?? [];
    if (!required.every((p) => allowed.includes(p))) {
      throw new ForbiddenException('Insufficient permissions');
    }

    return true;
  }
}
