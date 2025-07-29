/**
 * ShopLinkGeneratedEvent - Emitted when a new shop link is created
 */
export interface ShopLinkGeneratedEvent {
  handle: string;
  phone?: string; // Optional for password-based auth
  shop_link: string;
  subscription_status: 'trial' | 'paid';
  created_at: string;
}

export interface Shop {
  handle: string;
  phone?: string; // Optional for password-based auth
  shop_link: string;
  subscription_status: 'trial' | 'paid';
  created_at: string;
  updated_at?: string;
  user_id?: string;
  display_name?: string;
  profile_photo_url?: string;
  follower_count?: number;
  is_verified?: boolean;
}

export interface CreateShopInput {
  handle: string;
  phone?: string; // Optional for password-based auth
  subscription_status?: 'trial' | 'paid';
  userId?: string; // Support both userId and user_id
  user_id?: string;
  display_name?: string;
  profile_photo_url?: string;
  follower_count?: number;
  is_verified?: boolean;
  isActive?: boolean; // Add active status
  createdAt?: string; // Add created at
}

export interface ShopServiceInterface {
  createShop(shopData: CreateShopInput): Promise<Shop>;
  getShopByHandle(handle: string): Promise<Shop | null>;
  getShopByPhone(phone: string): Promise<Shop | null>;
  updateShopSubscription(handle: string, subscriptionStatus: 'trial' | 'paid'): Promise<void>;
  getShopsBySubscriptionStatus(subscriptionStatus: 'trial' | 'paid'): Promise<Shop[]>;
}
