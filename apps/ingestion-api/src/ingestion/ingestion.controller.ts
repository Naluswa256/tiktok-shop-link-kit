import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBody } from '@nestjs/swagger';
import { IngestionService } from './ingestion.service';
import { TikTokLinkDto } from './dto/tiktok-link.dto';

@ApiTags('ingestion')
@Controller('ingestion')
export class IngestionController {
  constructor(private readonly ingestionService: IngestionService) {}

  @Post('tiktok-link')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ 
    summary: 'Ingest TikTok link for processing',
    description: 'Accepts a TikTok link and triggers the processing workflow'
  })
  @ApiBody({ type: TikTokLinkDto })
  @ApiResponse({ 
    status: 202, 
    description: 'TikTok link accepted for processing',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Processing job ID' },
        status: { type: 'string', description: 'Job status' },
        message: { type: 'string', description: 'Status message' }
      }
    }
  })
  @ApiResponse({ status: 400, description: 'Invalid TikTok link format' })
  @ApiResponse({ status: 429, description: 'Rate limit exceeded' })
  async ingestTikTokLink(@Body() tiktokLinkDto: TikTokLinkDto) {
    return this.ingestionService.processTikTokLink(tiktokLinkDto);
  }
}
