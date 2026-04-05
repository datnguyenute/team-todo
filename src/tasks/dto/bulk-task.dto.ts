import { IsArray, IsEnum, IsOptional, IsUUID, ArrayMinSize } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { TaskStatus } from '../entities/task.entity';

export enum BulkAction {
  STATUS = 'status',
  ASSIGNEE = 'assignee',
  DELETE = 'delete',
  RESTORE = 'restore',
}

export class BulkTaskDto {
  @ApiProperty({ enum: BulkAction })
  @IsEnum(BulkAction)
  action: BulkAction;

  @ApiProperty({ type: [String] })
  @IsArray()
  @ArrayMinSize(1)
  @IsUUID('all', { each: true })
  ids: string[];

  @ApiProperty({ enum: TaskStatus, required: false })
  @IsOptional()
  @IsEnum(TaskStatus)
  status?: TaskStatus;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsUUID()
  assigneeId?: string;
}
