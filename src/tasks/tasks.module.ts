import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Task } from './entities/task.entity';
import { Project } from '../projects/entities/project.entity';
import { WorkspaceMember } from '../workspaces/entities/workspace-member.entity';
import { TasksService } from './tasks.service';
import { TasksController } from './tasks.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Task, Project, WorkspaceMember])],
  providers: [TasksService],
  controllers: [TasksController],
})
export class TasksModule {}
