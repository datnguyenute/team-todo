import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags, ApiOperation, ApiParam } from '@nestjs/swagger';
import { TasksService } from './tasks.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { QueryTaskDto } from './dto/query-task.dto';
import { BulkTaskDto } from './dto/bulk-task.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtPayload } from '../auth/strategies/jwt.strategy';

@ApiTags('tasks')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller()
export class TasksController {
  constructor(private readonly tasksService: TasksService) {}

  // ── Project-scoped task endpoints ──────────────────────────────────────────

  @Post('projects/:pid/tasks')
  @ApiOperation({ summary: 'Create task in project' })
  create(
    @Param('pid') pid: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateTaskDto,
  ) {
    return this.tasksService.create(pid, user.sub, dto);
  }

  @Get('projects/:pid/tasks')
  @ApiOperation({ summary: 'List tasks in project (filter + sort + paginate)' })
  findAll(
    @Param('pid') pid: string,
    @CurrentUser() user: JwtPayload,
    @Query() query: QueryTaskDto,
  ) {
    return this.tasksService.findAll(pid, user.sub, query);
  }

  // ── Single-task endpoints ──────────────────────────────────────────────────

  @Get('tasks/:id')
  @ApiOperation({ summary: 'Get task detail' })
  findOne(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.tasksService.findOne(id, user.sub);
  }

  @Patch('tasks/:id')
  @ApiOperation({ summary: 'Update task' })
  update(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: UpdateTaskDto,
  ) {
    return this.tasksService.update(id, user.sub, dto);
  }

  @Delete('tasks/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Soft-delete task' })
  async remove(@Param('id') id: string, @CurrentUser() user: JwtPayload): Promise<void> {
    await this.tasksService.remove(id, user.sub);
  }

  @Post('tasks/:id/restore')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Restore soft-deleted task' })
  async restore(@Param('id') id: string, @CurrentUser() user: JwtPayload): Promise<void> {
    await this.tasksService.restore(id, user.sub);
  }

  // ── Bulk operations ────────────────────────────────────────────────────────

  @Post('workspaces/:wid/tasks/bulk')
  @ApiOperation({ summary: 'Bulk update/delete/restore tasks in workspace' })
  @ApiParam({ name: 'wid', description: 'Workspace ID' })
  bulk(
    @Param('wid') wid: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: BulkTaskDto,
  ) {
    return this.tasksService.bulk(wid, user.sub, dto);
  }
}
