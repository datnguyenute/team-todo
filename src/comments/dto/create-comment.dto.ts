import { IsString, MinLength, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateCommentDto {
  @ApiProperty({ example: 'Looking into this now.' })
  @IsString()
  @MinLength(1)
  @MaxLength(5000)
  content: string;
}
