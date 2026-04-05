import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WorkspaceMember } from '../workspaces/entities/workspace-member.entity';
import { PermissionsGuard } from './guards/permissions.guard';

@Module({
  imports: [TypeOrmModule.forFeature([WorkspaceMember])],
  providers: [PermissionsGuard],
  exports: [PermissionsGuard],
})
export class CommonModule {}
