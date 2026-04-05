import { Controller, Get, Post, Body, Param, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags, ApiOperation } from '@nestjs/swagger';
import { WorkspacesService } from './workspaces.service';
import { CreateWorkspaceDto } from './dto/create-workspace.dto';
import { InviteUserDto } from './dto/invite-user.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Permissions } from '../common/decorators/permissions.decorator';
import { JwtPayload } from '../auth/strategies/jwt.strategy';

@ApiTags('workspaces')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('workspaces')
export class WorkspacesController {
  constructor(private readonly workspacesService: WorkspacesService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new workspace' })
  create(@CurrentUser() user: JwtPayload, @Body() dto: CreateWorkspaceDto) {
    return this.workspacesService.create(user.sub, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List workspaces I belong to' })
  findAll(@CurrentUser() user: JwtPayload) {
    return this.workspacesService.findAllForUser(user.sub);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get workspace details + members' })
  findOne(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.workspacesService.findOne(id, user.sub);
  }

  @Post(':wid/invite')
  @UseGuards(PermissionsGuard)
  @Permissions('workspace:invite')
  @ApiOperation({ summary: 'Invite a user to workspace (admin+)' })
  invite(@Param('wid') wid: string, @Body() dto: InviteUserDto) {
    return this.workspacesService.invite(wid, dto);
  }

  @Get(':wid/members')
  @ApiOperation({ summary: 'List workspace members' })
  members(@Param('wid') wid: string, @CurrentUser() user: JwtPayload) {
    return this.workspacesService.getMembers(wid, user.sub);
  }
}
