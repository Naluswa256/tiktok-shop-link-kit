import {
  WebSocketGateway as WSGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { NewProductEvent } from '../events/types';

interface ClientSubscription {
  socketId: string;
  sellerHandle: string;
  joinedAt: string;
}

@WSGateway({
  cors: {
    origin: ['http://localhost:3000', 'http://localhost:8080'], // Add your frontend URLs
    credentials: true,
  },
  namespace: '/products',
})
export class WebSocketGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(WebSocketGateway.name);
  private readonly subscriptions = new Map<string, ClientSubscription[]>();

  handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
    
    // Send connection confirmation
    client.emit('connected', {
      message: 'Connected to product updates',
      clientId: client.id,
      timestamp: new Date().toISOString(),
    });
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
    
    // Remove client from all subscriptions
    for (const [sellerHandle, clients] of this.subscriptions.entries()) {
      const updatedClients = clients.filter(c => c.socketId !== client.id);
      
      if (updatedClients.length === 0) {
        this.subscriptions.delete(sellerHandle);
        this.logger.debug(`Removed empty subscription for seller: ${sellerHandle}`);
      } else {
        this.subscriptions.set(sellerHandle, updatedClients);
      }
    }
  }

  /**
   * Subscribe to product updates for a specific seller
   */
  @SubscribeMessage('subscribe_to_seller')
  handleSubscribeToSeller(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { seller_handle: string }
  ) {
    const { seller_handle } = data;
    
    if (!seller_handle) {
      client.emit('error', {
        message: 'seller_handle is required',
        timestamp: new Date().toISOString(),
      });
      return;
    }

    // Remove client from any existing subscriptions
    this.unsubscribeClientFromAll(client.id);

    // Add to new subscription
    const subscription: ClientSubscription = {
      socketId: client.id,
      sellerHandle: seller_handle,
      joinedAt: new Date().toISOString(),
    };

    if (!this.subscriptions.has(seller_handle)) {
      this.subscriptions.set(seller_handle, []);
    }
    
    this.subscriptions.get(seller_handle)!.push(subscription);

    this.logger.log(`Client ${client.id} subscribed to seller: ${seller_handle}`);
    
    client.emit('subscribed', {
      seller_handle,
      message: `Subscribed to product updates for ${seller_handle}`,
      timestamp: new Date().toISOString(),
    });

    // Join socket room for easier broadcasting
    client.join(`seller:${seller_handle}`);
  }

  /**
   * Unsubscribe from product updates
   */
  @SubscribeMessage('unsubscribe')
  handleUnsubscribe(@ConnectedSocket() client: Socket) {
    this.unsubscribeClientFromAll(client.id);
    
    client.emit('unsubscribed', {
      message: 'Unsubscribed from all product updates',
      timestamp: new Date().toISOString(),
    });

    this.logger.log(`Client ${client.id} unsubscribed from all sellers`);
  }

  /**
   * Get current subscription status
   */
  @SubscribeMessage('get_subscription_status')
  handleGetSubscriptionStatus(@ConnectedSocket() client: Socket) {
    const clientSubscriptions = this.getClientSubscriptions(client.id);
    
    client.emit('subscription_status', {
      subscriptions: clientSubscriptions,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Broadcast new product to subscribed clients
   */
  broadcastNewProduct(event: NewProductEvent): void {
    const sellerHandle = event.product.seller_handle;
    const roomName = `seller:${sellerHandle}`;
    
    this.logger.debug(`Broadcasting new product to room: ${roomName}`, {
      videoId: event.product.video_id,
      title: event.product.title,
      price: event.product.price,
    });

    // Broadcast to all clients in the seller's room
    this.server.to(roomName).emit('new_product', {
      event_type: 'new_product',
      product: event.product,
      timestamp: event.timestamp,
    });

    // Log subscription stats
    const subscribedClients = this.subscriptions.get(sellerHandle) || [];
    this.logger.log(`Broadcasted new product to ${subscribedClients.length} clients`, {
      sellerHandle,
      videoId: event.product.video_id,
      title: event.product.title,
    });
  }

  /**
   * Broadcast general system message to all connected clients
   */
  broadcastSystemMessage(message: string, data?: any): void {
    this.server.emit('system_message', {
      message,
      data,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Get subscription statistics
   */
  getSubscriptionStats(): {
    totalSubscriptions: number;
    sellerHandles: string[];
    clientsPerSeller: Record<string, number>;
  } {
    const stats = {
      totalSubscriptions: 0,
      sellerHandles: Array.from(this.subscriptions.keys()),
      clientsPerSeller: {} as Record<string, number>,
    };

    for (const [sellerHandle, clients] of this.subscriptions.entries()) {
      stats.clientsPerSeller[sellerHandle] = clients.length;
      stats.totalSubscriptions += clients.length;
    }

    return stats;
  }

  /**
   * Remove client from all subscriptions
   */
  private unsubscribeClientFromAll(clientId: string): void {
    for (const [sellerHandle, clients] of this.subscriptions.entries()) {
      const updatedClients = clients.filter(c => c.socketId !== clientId);
      
      if (updatedClients.length === 0) {
        this.subscriptions.delete(sellerHandle);
      } else {
        this.subscriptions.set(sellerHandle, updatedClients);
      }
    }

    // Leave all socket rooms
    const client = this.server.sockets.sockets.get(clientId);
    if (client) {
      client.rooms.forEach(room => {
        if (room.startsWith('seller:')) {
          client.leave(room);
        }
      });
    }
  }

  /**
   * Get all subscriptions for a specific client
   */
  private getClientSubscriptions(clientId: string): ClientSubscription[] {
    const clientSubs: ClientSubscription[] = [];
    
    for (const clients of this.subscriptions.values()) {
      const clientSub = clients.find(c => c.socketId === clientId);
      if (clientSub) {
        clientSubs.push(clientSub);
      }
    }
    
    return clientSubs;
  }
}
