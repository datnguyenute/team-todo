import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags, ApiOperation } from '@nestjs/swagger';
import { ProjectsService } from './projects.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtPayload } from '../auth/strategies/jwt.strategy';

@ApiTags('projects')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('workspaces/:wid/projects')
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  @Post()
  @ApiOperation({ summary: 'Create project in workspace' })
  create(
    @Param('wid') wid: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateProjectDto,
  ) {
    return this.projectsService.create(wid, user.sub, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List projects in workspace' })
  findAll(@Param('wid') wid: string, @CurrentUser() user: JwtPayload) {
    return this.projectsService.findAll(wid, user.sub);
  }

  @Get(':pid')
  @ApiOperation({ summary: 'Get project detail' })
  findOne(
    @Param('wid') wid: string,
    @Param('pid') pid: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.projectsService.findOne(pid, wid, user.sub);
  }

  @Delete(':pid')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete project (owner/admin/creator)' })
  async remove(
    @Param('wid') wid: string,
    @Param('pid') pid: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<void> {
    await this.projectsService.remove(pid, wid, user.sub);
  }
}
