import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getHello(): string {
    return 'TikTok Commerce Link Hub - Product Service v1.0.0';
  }
}
