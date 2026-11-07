import {
  Controller,
  Post,
  Get,
  Body,
  HttpCode,
  UseGuards,
} from '@nestjs/common';
import { HistoryService } from './history.service';
import { RecordEventDto } from './dto/record-event.dto';
import { OptionalJwtAuthGuard } from '../auth/guards/optional-jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@Controller('history')
export class HistoryController {
  constructor(private readonly historyService: HistoryService) {}

  @Post('event')
  @HttpCode(204)
  @UseGuards(OptionalJwtAuthGuard)
  async record(
    @CurrentUser('id') userId: string | undefined,
    @Body() dto: RecordEventDto,
  ): Promise<void> {
    if (!userId) return;
    await this.historyService.recordEvent(userId, dto);
  }

  @Get('profile')
  @UseGuards(OptionalJwtAuthGuard)
  async profile(@CurrentUser('id') userId: string | undefined) {
    return this.historyService.getProfile(userId);
  }
}
