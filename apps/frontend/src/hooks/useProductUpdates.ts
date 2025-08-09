import { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { toast } from 'sonner';
import { useUpdateProductCache } from './useProducts';
import { AssembledProduct } from '@/lib/api';

interface NewProductEvent {
  event_type: 'new_product';
  product: AssembledProduct;
  timestamp: string;
}

interface WebSocketStatus {
  connected: boolean;
  subscribed: boolean;
  error: string | null;
  reconnectAttempts: number;
}

const PRODUCT_SERVICE_URL = (import.meta as any).env?.VITE_PRODUCT_SERVICE_URL || 'http://localhost:3002';
const MAX_RECONNECT_ATTEMPTS = 5;
const RECONNECT_DELAY = 2000; // 2 seconds

export const useProductUpdates = (sellerHandle: string | null) => {
  const socketRef = useRef<Socket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [status, setStatus] = useState<WebSocketStatus>({
    connected: false,
    subscribed: false,
    error: null,
    reconnectAttempts: 0,
  });

  const { addNewProduct } = useUpdateProductCache();

  const connect = () => {
    if (socketRef.current?.connected) {
      return;
    }

    try {
      const socket = io(`${PRODUCT_SERVICE_URL}/products`, {
        transports: ['websocket', 'polling'],
        timeout: 10000,
        reconnection: false, // We'll handle reconnection manually
      });

      socketRef.current = socket;

      socket.on('connect', () => {
        console.log('Connected to product updates WebSocket');
        setStatus((prev: WebSocketStatus) => ({
          ...prev,
          connected: true,
          error: null,
          reconnectAttempts: 0,
        }));

        // Subscribe to seller if handle is provided
        if (sellerHandle) {
          socket.emit('subscribe_to_seller', { seller_handle: sellerHandle });
        }
      });

      socket.on('connected', (data) => {
        console.log('WebSocket connection confirmed:', data);
      });

      socket.on('subscribed', (data: any) => {
        console.log('Subscribed to seller updates:', data);
        setStatus((prev: WebSocketStatus) => ({
          ...prev,
          subscribed: true,
          error: null,
        }));
        toast.success(`Connected to live updates for ${data.seller_handle}`);
      });

      socket.on('new_product', (event: NewProductEvent) => {
        console.log('New product received:', event);
        
        // Only process if it's for the current seller
        if (event.product.seller_handle === sellerHandle) {
          addNewProduct(sellerHandle, event.product);
          toast.success(`New product added: ${event.product.title}`);
        }
      });

      socket.on('error', (error: any) => {
        console.error('WebSocket error:', error);
        setStatus((prev: WebSocketStatus) => ({
          ...prev,
          error: error.message || 'WebSocket error',
        }));
        toast.error('Connection error. Retrying...');
      });

      socket.on('disconnect', (reason: string) => {
        console.log('WebSocket disconnected:', reason);
        setStatus((prev: WebSocketStatus) => ({
          ...prev,
          connected: false,
          subscribed: false,
        }));

        // Attempt to reconnect if not manually disconnected
        if (reason !== 'io client disconnect' && status.reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
          scheduleReconnect();
        }
      });

      socket.on('connect_error', (error: any) => {
        console.error('WebSocket connection error:', error);
        setStatus((prev: WebSocketStatus) => ({
          ...prev,
          error: error.message || 'Connection failed',
          reconnectAttempts: prev.reconnectAttempts + 1,
        }));

        if (status.reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
          scheduleReconnect();
        } else {
          toast.error('Unable to connect to live updates. Please refresh the page.');
        }
      });

    } catch (error) {
      console.error('Failed to create WebSocket connection:', error);
      setStatus((prev: WebSocketStatus) => ({
        ...prev,
        error: 'Failed to initialize connection',
      }));
    }
  };

  const scheduleReconnect = () => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }

    reconnectTimeoutRef.current = setTimeout(() => {
      console.log(`Attempting to reconnect... (attempt ${status.reconnectAttempts + 1})`);
      connect();
    }, RECONNECT_DELAY * Math.pow(2, status.reconnectAttempts)); // Exponential backoff
  };

  const disconnect = () => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
    }

    setStatus({
      connected: false,
      subscribed: false,
      error: null,
      reconnectAttempts: 0,
    });
  };

  const subscribe = (handle: string) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('subscribe_to_seller', { seller_handle: handle });
    }
  };

  const unsubscribe = () => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('unsubscribe');
      setStatus((prev: WebSocketStatus) => ({ ...prev, subscribed: false }));
    }
  };

  // Connect when component mounts or sellerHandle changes
  useEffect(() => {
    if (sellerHandle) {
      connect();
    }

    return () => {
      disconnect();
    };
  }, [sellerHandle]);

  // Subscribe when connection is established and handle is available
  useEffect(() => {
    if (status.connected && sellerHandle && !status.subscribed) {
      subscribe(sellerHandle);
    }
  }, [status.connected, sellerHandle, status.subscribed]);

  return {
    status,
    connect,
    disconnect,
    subscribe,
    unsubscribe,
  };
};
