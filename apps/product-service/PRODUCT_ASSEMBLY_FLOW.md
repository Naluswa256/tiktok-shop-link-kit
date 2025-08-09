# 🛍️ Product Assembly & Save Flow

This document describes the **Product Assembly & Save Flow** implementation for the TikTok Commerce Link Hub.

## 🎯 Overview

The Product Assembly & Save Flow is responsible for:
1. **Consuming events** from Caption Parser and Thumbnail Generator AI workers
2. **Merging data** from both workers for the same video
3. **Persisting complete products** in DynamoDB
4. **Notifying the frontend** via WebSocket for real-time updates

## 🏗️ Architecture

```
┌─────────────────┐    ┌─────────────────┐
│  Caption Parser │    │Thumbnail Generator│
│   AI Worker     │    │   AI Worker      │
└─────────┬───────┘    └─────────┬───────┘
          │                      │
          ▼                      ▼
    ┌─────────────┐        ┌─────────────┐
    │Caption Queue│        │Thumbnail Q. │
    │    (SQS)    │        │    (SQS)    │
    └─────────────┘        └─────────────┘
          │                      │
          └──────────┬───────────┘
                     ▼
            ┌─────────────────┐
            │ Event Processor │
            │    Service      │
            └─────────┬───────┘
                      │
                      ▼
            ┌─────────────────┐
            │ Product Assembly│
            │ Staging (DDB)   │
            └─────────┬───────┘
                      │
                      ▼
            ┌─────────────────┐
            │ Complete Product│
            │  Storage (DDB)  │
            └─────────┬───────┘
                      │
                      ▼
            ┌─────────────────┐
            │   WebSocket     │
            │   Broadcast     │
            └─────────────────┘
                      │
                      ▼
            ┌─────────────────┐
            │ React Frontend  │
            │ Real-time UI    │
            └─────────────────┘
```

## 📊 Event Schemas

### Caption Parsed Event
```typescript
{
  video_id: string;
  seller_handle: string;
  title: string;
  price: number | null;
  sizes: string | null;
  tags: string[];
  confidence_score?: number;
  raw_caption?: string;
  timestamp: string;
}
```

### Thumbnail Generated Event
```typescript
{
  video_id: string;
  seller_handle: string;
  thumbnails: ThumbnailInfo[]; // Array of 5 thumbnails
  primary_thumbnail: ThumbnailInfo;
  processing_metadata: {
    video_duration: number;
    frames_analyzed: number;
    thumbnails_generated: number;
    processing_time_ms: number;
  };
  timestamp: string;
}
```

### Assembled Product
```typescript
{
  seller_handle: string;        // PK
  video_id: string;            // SK
  title: string;
  price: number | null;
  sizes: string | null;
  tags: string[];
  thumbnails: ThumbnailInfo[];
  primary_thumbnail: ThumbnailInfo;
  confidence_score?: number;
  raw_caption?: string;
  processing_metadata: {...};
  created_at: string;
  updated_at: string;
}
```

## 🔄 Processing Flow

### 1. Event Reception
- **EventProcessorService** polls both SQS queues continuously
- Processes messages in parallel for optimal throughput
- Implements proper error handling and retry logic

### 2. Data Staging
- Incomplete products stored in **staging table** with TTL (24 hours)
- Each event updates the staging record
- Tracks completion status (`is_complete` flag)

### 3. Product Assembly
- When both caption and thumbnail data are available:
  - Merge data into complete product
  - Save to **products table** with idempotency check
  - Clean up staging data
  - Broadcast to WebSocket subscribers

### 4. Frontend Notification
- **Real-time**: WebSocket broadcast to subscribed clients
- **Polling**: REST API for initial load and fallback

## 🌐 API Endpoints

### Shop Products
```http
GET /api/v1/shop/{handle}/products
```
**Query Parameters:**
- `limit`: Items per page (default: 20, max: 50)
- `lastKey`: Pagination key (URL-encoded JSON)
- `since`: ISO timestamp for incremental updates

**Response:**
```json
{
  "products": [...],
  "pagination": {
    "hasMore": boolean,
    "lastEvaluatedKey": string | null,
    "count": number
  },
  "metadata": {
    "sellerHandle": string,
    "since": string | null,
    "timestamp": string
  }
}
```

### Specific Product
```http
GET /api/v1/shop/{handle}/products/{videoId}
```

### WebSocket Stats
```http
GET /api/v1/websocket/stats
```

## 🔌 WebSocket Integration

### Connection
```javascript
const socket = io('ws://localhost:3002/products');
```

### Subscribe to Seller
```javascript
socket.emit('subscribe_to_seller', { seller_handle: 'nalu-fashion' });
```

### Receive New Products
```javascript
socket.on('new_product', (event) => {
  console.log('New product:', event.product);
  // Update React Query cache or state
});
```

### Events
- `connected`: Connection confirmation
- `subscribed`: Subscription confirmation
- `new_product`: New product available
- `error`: Error messages

## 🗄️ Database Schema

### Products Table
- **PK**: `seller_handle` (string)
- **SK**: `video_id` (string)
- **Attributes**: All product fields
- **GSI**: None (query by seller_handle is primary access pattern)

### Staging Table
- **PK**: `video_id` (string)
- **SK**: `seller_handle` (string)
- **TTL**: `ttl` (number, 24 hours)
- **Attributes**: Assembly data with completion status

## 🛡️ Error Handling & Edge Cases

### Missing AI Worker Output
- **Timeout**: 24-hour TTL on staging data
- **Cleanup**: Scheduled task removes orphaned records
- **Monitoring**: Log incomplete assemblies for investigation

### Duplicate Events
- **Idempotency**: DynamoDB conditional writes prevent duplicates
- **SQS**: Message deduplication where possible
- **Logging**: Track duplicate attempts for monitoring

### WebSocket Failures
- **Graceful degradation**: Frontend falls back to polling
- **Reconnection**: Automatic reconnection with subscription restoration
- **Buffering**: No server-side buffering (stateless design)

## 🚀 Frontend Integration

### React Query Setup
```typescript
// Initial load
const { data: products } = useQuery({
  queryKey: ['shop-products', sellerHandle],
  queryFn: () => fetchShopProducts(sellerHandle),
});

// WebSocket updates
useEffect(() => {
  const socket = io('/products');
  
  socket.emit('subscribe_to_seller', { seller_handle: sellerHandle });
  
  socket.on('new_product', (event) => {
    queryClient.setQueryData(['shop-products', sellerHandle], (old) => ({
      ...old,
      products: [event.product, ...old.products],
    }));
  });
  
  return () => socket.disconnect();
}, [sellerHandle]);
```

### Incremental Updates
```typescript
// Fetch only new products since last update
const { data: newProducts } = useQuery({
  queryKey: ['shop-products-since', sellerHandle, lastUpdate],
  queryFn: () => fetchShopProducts(sellerHandle, { since: lastUpdate }),
  enabled: !!lastUpdate,
});
```

## 📈 Performance Considerations

### Throughput
- **Parallel processing**: Caption and thumbnail queues processed concurrently
- **Batch operations**: DynamoDB batch writes where applicable
- **Connection pooling**: Reuse AWS SDK clients

### Latency
- **WebSocket**: Sub-second notification delivery
- **DynamoDB**: Single-digit millisecond reads/writes
- **SQS**: Long polling reduces empty receives

### Scalability
- **Horizontal**: Multiple service instances can process events
- **Vertical**: Increase memory/CPU for higher throughput
- **Database**: DynamoDB auto-scaling based on demand

## 🔧 Configuration

### Environment Variables
See `.env.example` for complete configuration options.

### Key Settings
- `SQS_*_QUEUE_URL`: AI worker output queues
- `DYNAMODB_*_TABLE`: Product and staging tables
- `SNS_NEW_PRODUCT_TOPIC_ARN`: Optional SNS notifications
- `WEBSOCKET_CORS_ORIGINS`: Frontend origins for WebSocket

## 🧪 Testing

### Unit Tests
```bash
npm test
```

### Integration Tests
```bash
npm run test:e2e
```

### Manual Testing
1. Start the service: `npm run start:dev`
2. Send test events to SQS queues
3. Monitor WebSocket connections
4. Verify product assembly and storage

## 📊 Monitoring

### Metrics
- Event processing rate
- Assembly completion rate
- WebSocket connection count
- DynamoDB read/write capacity

### Logs
- Structured logging with correlation IDs
- Error tracking with stack traces
- Performance metrics for optimization

### Alerts
- Failed event processing
- High error rates
- DynamoDB throttling
- WebSocket connection issues
