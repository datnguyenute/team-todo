import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Comment } from './entities/comment.entity';
import { Task } from '../tasks/entities/task.entity';
import { WorkspaceMember } from '../workspaces/entities/workspace-member.entity';
import { CreateCommentDto } from './dto/create-comment.dto';

@Injectable()
export class CommentsService {
  constructor(
    @InjectRepository(Comment)
    private readonly commentsRepo: Repository<Comment>,
    @InjectRepository(Task)
    private readonly tasksRepo: Repository<Task>,
    @InjectRepository(WorkspaceMember)
    private readonly membersRepo: Repository<WorkspaceMember>,
  ) {}

  private async resolveTask(taskId: string, userId: string): Promise<Task> {
    const task = await this.tasksRepo.findOneBy({ id: taskId });
    if (!task) throw new NotFoundException('Task not found');

    const member = await this.membersRepo.findOne({
      where: { workspaceId: task.workspaceId, userId },
    });
    if (!member) throw new ForbiddenException('Not a workspace member');

    return task;
  }

  async create(taskId: string, userId: string, dto: CreateCommentDto): Promise<Comment> {
    await this.resolveTask(taskId, userId);
    const comment = this.commentsRepo.create({ taskId, authorId: userId, content: dto.content });
    return this.commentsRepo.save(comment);
  }

  async findAll(taskId: string, userId: string): Promise<Comment[]> {
    await this.resolveTask(taskId, userId);
    return this.commentsRepo.find({
      where: { taskId },
      relations: { author: true },
      order: { createdAt: 'ASC' },
      select: {
        id: true,
        content: true,
        createdAt: true,
        taskId: true,
        author: { id: true, name: true, email: true },
      },
    });
  }

  async remove(id: string, userId: string): Promise<void> {
    const comment = await this.commentsRepo.findOne({
      where: { id },
      relations: { task: true },
    });
    if (!comment) throw new NotFoundException('Comment not found');

    const member = await this.membersRepo.findOne({
      where: { workspaceId: comment.task.workspaceId, userId },
    });

    const canDelete =
      comment.authorId === userId ||
      member?.role === 'OWNER' ||
      member?.role === 'ADMIN';

    if (!canDelete) throw new ForbiddenException('Cannot delete this comment');

    await this.commentsRepo.remove(comment);
  }
}
