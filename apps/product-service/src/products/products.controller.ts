import {
  Controller,
  Get,
  Post,
  Logger,
  NotFoundException,
  UseInterceptors,
  UsePipes,
  ValidationPipe,
  Param,
  Query,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiOkResponse,
  ApiBadRequestResponse,
  ApiNotFoundResponse,
  ApiInternalServerErrorResponse,
} from '@nestjs/swagger';
import { WebSocketGateway } from '../websocket/websocket.gateway';
import { DynamoDBService } from '../database/dynamodb.service';
import { AssembledProduct } from '../events/types';
import { ResponseInterceptor } from '../common/interceptors/response.interceptor';
import { GetShopProductsDto, GetProductDto } from './dto/get-shop-products.dto';
import {
  ProductDto,
  ShopProductsResponseDto,
  DatabaseHealthDto
} from './dto/product-response.dto';

@ApiTags('products')
@Controller()
@UseInterceptors(ResponseInterceptor)
@UsePipes(new ValidationPipe({
  transform: true,
  whitelist: true,
  forbidNonWhitelisted: true,
  transformOptions: {
    enableImplicitConversion: true,
  },
}))
export class ProductsController {
  private readonly logger = new Logger(ProductsController.name);

  constructor(
    private readonly webSocketGateway: WebSocketGateway,
    private readonly dynamoDBService: DynamoDBService,
  ) {}

  /**
   * Get products for a specific shop/seller
   * This is the main endpoint for the React frontend
   */
  @Get('shop/:handle/products')
  @ApiOperation({
    summary: 'Get products for a specific shop/seller',
    description: 'Retrieve paginated list of products for a specific TikTok seller. Supports incremental updates and pagination.',
  })
  @ApiOkResponse({
    description: 'Products retrieved successfully',
    type: ShopProductsResponseDto,
  })
  @ApiBadRequestResponse({
    description: 'Invalid request parameters',
    schema: {
      example: {
        success: false,
        statusCode: 400,
        error: {
          type: 'VALIDATION_ERROR',
          message: 'Seller handle must contain only letters, numbers, dots, underscores, and hyphens',
          code: 'E400001',
        },
        timestamp: '2024-01-15T10:30:00.000Z',
        path: '/shop/invalid-handle/products',
      },
    },
  })
  @ApiNotFoundResponse({
    description: 'No products found for this seller',
    schema: {
      example: {
        success: false,
        statusCode: 404,
        error: {
          type: 'RESOURCE_NOT_FOUND',
          message: 'No products found for seller: nalu-fashion',
          code: 'E404001',
        },
        timestamp: '2024-01-15T10:30:00.000Z',
        path: '/shop/nalu-fashion/products',
      },
    },
  })
  async getShopProducts(
    @Param() params: GetShopProductsDto,
    @Query() query: GetShopProductsDto,
  ): Promise<ShopProductsResponseDto> {
    const { handle } = params;
    const { limit, lastKey, since } = query;

    try {
      // Parse lastKey if provided (validation already done by DTO)
      let lastEvaluatedKey: any = undefined;
      if (lastKey) {
        lastEvaluatedKey = JSON.parse(decodeURIComponent(lastKey));
      }

      this.logger.log(`Fetching products for seller: ${handle}`, {
        limit: limit || 20,
        since,
        hasLastKey: !!lastKey,
      });

      const result = await this.dynamoDBService.getProductsBySellerHandle(handle, {
        limit: limit || 20,
        lastEvaluatedKey,
        since,
      });

      // Check if no products found
      if (result.products.length === 0 && !lastKey) {
        throw new NotFoundException(`No products found for seller: ${handle}`);
      }

      return {
        products: result.products,
        pagination: {
          hasMore: !!result.lastEvaluatedKey,
          lastEvaluatedKey: result.lastEvaluatedKey
            ? encodeURIComponent(JSON.stringify(result.lastEvaluatedKey))
            : null,
          count: result.count,
        },
        metadata: {
          sellerHandle: handle,
          since: since || null,
          timestamp: new Date().toISOString(),
        },
      };
    } catch (error) {
      this.logger.error('Failed to fetch shop products', {
        error: error.message,
        sellerHandle: handle,
        limit: limit || 20,
        since,
      });
      throw error;
    }
  }

  /**
   * Get a specific product by seller handle and video ID
   */
  @Get('shop/:handle/products/:videoId')
  @ApiOperation({
    summary: 'Get a specific product',
    description: 'Retrieve detailed information about a specific product by seller handle and video ID.',
  })
  @ApiOkResponse({
    description: 'Product retrieved successfully',
    type: ProductDto,
  })
  @ApiBadRequestResponse({
    description: 'Invalid parameters',
    schema: {
      example: {
        success: false,
        statusCode: 400,
        error: {
          type: 'VALIDATION_ERROR',
          message: 'Video ID must contain only letters, numbers, underscores, and hyphens',
          code: 'E400001',
        },
        timestamp: '2024-01-15T10:30:00.000Z',
        path: '/shop/nalu-fashion/products/invalid-id',
      },
    },
  })
  @ApiNotFoundResponse({
    description: 'Product not found',
    schema: {
      example: {
        success: false,
        statusCode: 404,
        error: {
          type: 'RESOURCE_NOT_FOUND',
          message: 'Product not found: nalu-fashion/abc123',
          code: 'E404001',
        },
        timestamp: '2024-01-15T10:30:00.000Z',
        path: '/shop/nalu-fashion/products/abc123',
      },
    },
  })
  async getProduct(
    @Param() params: GetProductDto,
  ): Promise<AssembledProduct> {
    const { handle, videoId } = params;

    try {
      this.logger.log(`Fetching product: ${handle}/${videoId}`);

      const product = await this.dynamoDBService.getProduct(handle, videoId);

      if (!product) {
        this.logger.warn(`Product not found: ${handle}/${videoId}`);
        throw new NotFoundException(`Product not found: ${handle}/${videoId}`);
      }

      return product;
    } catch (error) {
      this.logger.error('Failed to fetch product', {
        error: error.message,
        sellerHandle: handle,
        videoId,
      });
      throw error;
    }
  }

  /**
   * Get WebSocket subscription statistics (for monitoring)
   */
  @Get('websocket/stats')
  @ApiOperation({
    summary: 'Get WebSocket subscription statistics',
    description: 'Retrieve real-time WebSocket connection and subscription statistics for monitoring.',
  })
  @ApiOkResponse({
    description: 'Statistics retrieved successfully',
    schema: {
      example: {
        totalSubscriptions: 15,
        sellerHandles: ['nalu-fashion', 'tech-dealer'],
        clientsPerSeller: {
          'nalu-fashion': 8,
          'tech-dealer': 7,
        },
      },
    },
  })
  getWebSocketStats() {
    return this.webSocketGateway.getSubscriptionStats();
  }

  /**
   * Database health check endpoint
   */
  @Get('health/database')
  @ApiOperation({
    summary: 'Check DynamoDB health and connectivity',
    description: 'Perform health check on DynamoDB tables and return connectivity status.',
  })
  @ApiOkResponse({
    description: 'Database health status',
    type: DatabaseHealthDto,
  })
  @ApiInternalServerErrorResponse({
    description: 'Database connectivity issues',
    schema: {
      example: {
        success: false,
        statusCode: 500,
        error: {
          type: 'EXTERNAL_SERVICE_ERROR',
          message: 'Database connectivity check failed',
          code: 'E502001',
        },
        timestamp: '2024-01-15T10:30:00.000Z',
        path: '/health/database',
      },
    },
  })
  async getDatabaseHealth(): Promise<DatabaseHealthDto> {
    return this.dynamoDBService.healthCheck();
  }

  /**
   * Get staging table statistics for monitoring
   */
  @Get('admin/staging-stats')
  @ApiOperation({
    summary: 'Get staging table statistics (admin only)',
    description: 'Retrieve detailed statistics about the product assembly staging table.',
  })
  @ApiOkResponse({
    description: 'Staging table statistics',
    schema: {
      example: {
        totalItems: 45,
        completeItems: 38,
        incompleteItems: 5,
        expiredItems: 2,
      },
    },
  })
  async getStagingStats() {
    return this.dynamoDBService.getStagingTableStats();
  }

  /**
   * Legacy endpoint notice - products are created via event processing
   */
  @Post('products')
  @ApiOperation({
    summary: 'Create product (not supported)',
    description: 'This endpoint is not supported. Products are automatically created via AI worker event processing.',
  })
  @ApiBadRequestResponse({
    description: 'Direct product creation not supported',
    schema: {
      example: {
        success: false,
        statusCode: 400,
        error: {
          type: 'BUSINESS_LOGIC_ERROR',
          message: 'Direct product creation is not supported. Products are automatically created when AI workers process TikTok videos.',
          code: 'E422001',
        },
        timestamp: '2024-01-15T10:30:00.000Z',
        path: '/products',
      },
    },
  })
  createProduct() {
    throw new NotFoundException(
      'Direct product creation is not supported. Products are automatically created when AI workers process TikTok videos.'
    );
  }

  /**
   * Legacy cross-seller product search (not optimized for our use case)
   */
  @Get('products')
  @ApiOperation({
    summary: 'Search products across all sellers (legacy)',
    description: 'Cross-seller search is not implemented. Use shop-specific endpoints instead.',
  })
  @ApiBadRequestResponse({
    description: 'Cross-seller search not implemented',
    schema: {
      example: {
        success: false,
        statusCode: 400,
        error: {
          type: 'BUSINESS_LOGIC_ERROR',
          message: 'Cross-seller product search is not implemented. Use /shop/{handle}/products for seller-specific products.',
          code: 'E422001',
        },
        timestamp: '2024-01-15T10:30:00.000Z',
        path: '/products',
      },
    },
  })
  findAllProducts() {
    throw new NotFoundException(
      'Cross-seller product search is not implemented. Use /shop/{handle}/products for seller-specific products.'
    );
  }

}
