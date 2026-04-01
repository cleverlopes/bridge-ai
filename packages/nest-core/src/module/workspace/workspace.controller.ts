import {
  Controller,
  Post,
  Body,
  BadRequestException,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import type { InitWorkspaceDto, InitWorkspaceResult } from './types';

@Controller('workspaces')
export class WorkspaceController {
  // WorkspaceOnboardingService will be injected here once implemented (plans 01-04).
  // For now the controller returns 400 to indicate the endpoint exists but
  // the service layer is not yet wired. The CLI and REST surface are
  // established; the implementation follows in subsequent plans.

  @Post('init')
  @HttpCode(HttpStatus.CREATED)
  async initWorkspace(@Body() dto: InitWorkspaceDto): Promise<InitWorkspaceResult> {
    if (!dto.workspacePath) {
      throw new BadRequestException('workspacePath is required');
    }
    // TODO: inject WorkspaceOnboardingService (added in plan 8.5-01)
    // return this.onboardingService.initWorkspace(dto);
    throw new BadRequestException(
      'WorkspaceOnboardingService not yet wired — run plans 8.5-01 through 8.5-04 first',
    );
  }
}
