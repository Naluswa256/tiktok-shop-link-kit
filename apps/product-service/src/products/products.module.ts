import { Module } from '@nestjs/common';
import { ProductsController } from './products.controller';
import { DynamoDBService } from '../database/dynamodb.service';
import { WebSocketGateway } from '../websocket/websocket.gateway';

@Module({
  controllers: [ProductsController],
  providers: [DynamoDBService, WebSocketGateway],
  exports: [DynamoDBService],
})
export class ProductsModule {}
