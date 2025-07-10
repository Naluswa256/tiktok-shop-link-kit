import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getHello(): string {
    return 'TikTok Commerce Link Hub - Ingestion API v1.0.0';
  }
}
