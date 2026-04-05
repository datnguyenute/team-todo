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
import { CommentsService } from './comments.service';
import { CreateCommentDto } from './dto/create-comment.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtPayload } from '../auth/strategies/jwt.strategy';

@ApiTags('comments')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('tasks/:tid/comments')
export class CommentsController {
  constructor(private readonly commentsService: CommentsService) {}

  @Post()
  @ApiOperation({ summary: 'Add comment to task' })
  create(
    @Param('tid') tid: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateCommentDto,
  ) {
    return this.commentsService.create(tid, user.sub, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List comments on task' })
  findAll(@Param('tid') tid: string, @CurrentUser() user: JwtPayload) {
    return this.commentsService.findAll(tid, user.sub);
  }

  @Delete(':cid')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete comment (author / admin / owner)' })
  async remove(
    @Param('cid') cid: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<void> {
    await this.commentsService.remove(cid, user.sub);
  }
}
