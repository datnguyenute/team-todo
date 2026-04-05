import { IsOptional, IsEnum, IsUUID, IsDateString, IsInt, Min, Max, IsIn } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { TaskStatus, TaskPriority } from '../entities/task.entity';

export class QueryTaskDto {
  @ApiProperty({ enum: TaskStatus, required: false })
  @IsOptional()
  @IsEnum(TaskStatus)
  status?: TaskStatus;

  @ApiProperty({ enum: TaskPriority, required: false })
  @IsOptional()
  @IsEnum(TaskPriority)
  priority?: TaskPriority;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsUUID()
  assignee?: string;

  @ApiProperty({ required: false, description: 'Full-text search on title/description' })
  @IsOptional()
  q?: string;

  @ApiProperty({ required: false, example: '2026-04-01' })
  @IsOptional()
  @IsDateString()
  dueFrom?: string;

  @ApiProperty({ required: false, example: '2026-04-30' })
  @IsOptional()
  @IsDateString()
  dueTo?: string;

  @ApiProperty({ required: false, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiProperty({ required: false, default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @ApiProperty({
    required: false,
    example: 'createdAt:desc',
    description: 'field:asc|desc — allowed fields: createdAt, dueDate, priority, status',
  })
  @IsOptional()
  @IsIn([
    'createdAt:asc', 'createdAt:desc',
    'dueDate:asc', 'dueDate:desc',
    'priority:asc', 'priority:desc',
    'status:asc', 'status:desc',
  ])
  sort?: string = 'createdAt:desc';
}
