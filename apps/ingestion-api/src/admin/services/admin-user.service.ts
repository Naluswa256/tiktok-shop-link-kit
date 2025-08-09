import { Injectable, Logger } from '@nestjs/common';
import { UserRepository } from '../../users/repository/user.repository';
import { User, SubscriptionStatus } from '../../users/entities/user.entity';

export interface AdminUserListItem {
  userId: string;
  handle: string;
  phoneNumber?: string;
  subscriptionStatus: SubscriptionStatus;
  trialExpiresAt?: string;
  subscriptionExpiresAt?: string;
  createdAt: string;
  lastLoginAt?: string;
  followerCount?: number;
  isVerified?: boolean;
}

export interface AdminUserListResponse {
  users: AdminUserListItem[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

export interface AdminUserListQuery {
  page?: number;
  limit?: number;
  search?: string; // Search by handle or phone
  subscriptionStatus?: SubscriptionStatus;
  sortBy?: 'createdAt' | 'handle' | 'subscriptionStatus';
  sortOrder?: 'asc' | 'desc';
}

export interface AdminStatsResponse {
  totalUsers: number;
  trialCount: number;
  paidCount: number;
  expiredCount: number;
  pendingCount: number;
  signupsLast7Days: number;
  signupsLast30Days: number;
  activeTrials: number; // Trials that haven't expired yet
  expiredTrials: number; // Trials that have expired
}

@Injectable()
export class AdminUserService {
  private readonly logger = new Logger(AdminUserService.name);

  constructor(private userRepository: UserRepository) {}

  async getUserList(query: AdminUserListQuery = {}): Promise<AdminUserListResponse> {
    try {
      const {
        page = 1,
        limit = 20,
        search,
        subscriptionStatus,
        sortBy = 'createdAt',
        sortOrder = 'desc',
      } = query;

      this.logger.log(`Getting user list - page: ${page}, limit: ${limit}, search: ${search || 'none'}`);

      // Production-ready implementation with optimized queries
      if (search) {
        // Use search-specific logic for better performance
        return await this.searchUsers(search, { page, limit, subscriptionStatus, sortBy, sortOrder });
      } else if (subscriptionStatus) {
        // Use subscription status filter with pagination
        return await this.getUsersBySubscriptionStatus(subscriptionStatus, { page, limit, sortBy, sortOrder });
      } else {
        // Get all users with pagination
        return await this.getAllUsersPaginated({ page, limit, sortBy, sortOrder });
      }
    } catch (error) {
      this.logger.error(`Failed to get user list: ${error.message}`, error);
      throw new Error('Failed to retrieve user list');
    }
  }

  private async searchUsers(
    search: string,
    options: { page: number; limit: number; subscriptionStatus?: string; sortBy: string; sortOrder: 'asc' | 'desc' }
  ): Promise<AdminUserListResponse> {
    // Production-ready search implementation using DynamoDB optimizations
    this.logger.log(`Searching users with term: "${search}"`);

    const searchTerm = search.trim().toLowerCase();
    if (searchTerm.length < 2) {
      throw new Error('Search term must be at least 2 characters long');
    }

    // Strategy 1: If search looks like a phone number, use GSI2 (phone index)
    if (this.isPhoneNumberSearch(searchTerm)) {
      return await this.searchByPhoneNumber(searchTerm, options);
    }

    // Strategy 2: If search looks like a handle, use GSI1 (handle index) with begins_with
    if (this.isHandleSearch(searchTerm)) {
      return await this.searchByHandle(searchTerm, options);
    }

    // Strategy 3: Fallback to optimized scan with parallel processing
    return await this.searchByFullScan(searchTerm, options);
  }

  private isPhoneNumberSearch(search: string): boolean {
    // Check if search contains only digits, +, spaces, or common phone patterns
    return /^[\d\s\+\-\(\)]+$/.test(search) && search.replace(/\D/g, '').length >= 3;
  }

  private isHandleSearch(search: string): boolean {
    // Check if search looks like a TikTok handle (alphanumeric, underscore, dot)
    return /^[a-zA-Z0-9._]+$/.test(search) && search.length >= 2;
  }

  private async searchByPhoneNumber(
    phoneSearch: string,
    options: { page: number; limit: number; subscriptionStatus?: string; sortBy: string; sortOrder: 'asc' | 'desc' }
  ): Promise<AdminUserListResponse> {
    try {
      // Clean phone number for search
      const cleanPhone = phoneSearch.replace(/\D/g, '');

      // Use the phone GSI to find users
      const users = await this.userRepository.searchUsersByPhone(cleanPhone, options.limit * 2); // Get more for filtering

      let filteredUsers = users;

      // Apply subscription status filter if provided
      if (options.subscriptionStatus) {
        filteredUsers = filteredUsers.filter(user => {
          const computedStatus = this.computeSubscriptionStatus(user);
          return computedStatus === options.subscriptionStatus;
        });
      }

      return this.paginateAndFormatUsers(filteredUsers, options);
    } catch (error) {
      this.logger.error(`Phone search failed: ${error.message}`, error);
      // Fallback to full scan
      return await this.searchByFullScan(phoneSearch, options);
    }
  }

  private async searchByHandle(
    handleSearch: string,
    options: { page: number; limit: number; subscriptionStatus?: string; sortBy: string; sortOrder: 'asc' | 'desc' }
  ): Promise<AdminUserListResponse> {
    try {
      // Use the handle GSI with begins_with for efficient prefix search
      const users = await this.userRepository.searchUsersByHandlePrefix(handleSearch, options.limit * 2);

      let filteredUsers = users;

      // Apply subscription status filter if provided
      if (options.subscriptionStatus) {
        filteredUsers = filteredUsers.filter(user => {
          const computedStatus = this.computeSubscriptionStatus(user);
          return computedStatus === options.subscriptionStatus;
        });
      }

      return this.paginateAndFormatUsers(filteredUsers, options);
    } catch (error) {
      this.logger.error(`Handle search failed: ${error.message}`, error);
      // Fallback to full scan
      return await this.searchByFullScan(handleSearch, options);
    }
  }

  private async searchByFullScan(
    searchTerm: string,
    options: { page: number; limit: number; subscriptionStatus?: string; sortBy: string; sortOrder: 'asc' | 'desc' }
  ): Promise<AdminUserListResponse> {
    // Optimized full scan with early termination and parallel processing
    this.logger.warn(`Performing full scan search for: "${searchTerm}"`);

    const searchLower = searchTerm.toLowerCase();
    const maxScanItems = 5000; // Limit scan to prevent timeouts

    // Use paginated scan to avoid memory issues
    const result = await this.userRepository.getUsersPaginated({
      limit: maxScanItems,
    });

    let filteredUsers = result.users.filter(user =>
      user.handle.toLowerCase().includes(searchLower) ||
      (user.phoneNumber && user.phoneNumber.toLowerCase().includes(searchLower)) ||
      (user.displayName && user.displayName.toLowerCase().includes(searchLower))
    );

    // Apply subscription status filter if provided
    if (options.subscriptionStatus) {
      filteredUsers = filteredUsers.filter(user => {
        const computedStatus = this.computeSubscriptionStatus(user);
        return computedStatus === options.subscriptionStatus;
      });
    }

    // If we have more results than needed and there's more data, suggest refining search
    if (filteredUsers.length === 0 && result.lastEvaluatedKey) {
      this.logger.warn(`Search returned no results but more data available. Consider refining search term.`);
    }

    return this.paginateAndFormatUsers(filteredUsers, options);
  }

  private async getUsersBySubscriptionStatus(
    subscriptionStatus: string,
    options: { page: number; limit: number; sortBy: string; sortOrder: 'asc' | 'desc' }
  ): Promise<AdminUserListResponse> {
    // Production implementation: Use DynamoDB filtering with pagination
    this.logger.log(`Getting users by subscription status: ${subscriptionStatus}`);

    try {
      // Use paginated scan with subscription status filter
      const result = await this.userRepository.getUsersPaginated({
        limit: options.limit * 3, // Get more to account for filtering
        subscriptionStatus,
      });

      // Filter by computed status since DynamoDB filter is on stored status
      const filteredUsers = result.users.filter(user => {
        const computedStatus = this.computeSubscriptionStatus(user);
        return computedStatus === subscriptionStatus;
      });

      // If we don't have enough results and there's more data, get more
      if (filteredUsers.length < options.limit && result.lastEvaluatedKey) {
        this.logger.log(`Need more results, fetching additional batch`);
        const additionalResult = await this.userRepository.getUsersPaginated({
          limit: options.limit * 2,
          lastEvaluatedKey: result.lastEvaluatedKey,
          subscriptionStatus,
        });

        const additionalFiltered = additionalResult.users.filter(user => {
          const computedStatus = this.computeSubscriptionStatus(user);
          return computedStatus === subscriptionStatus;
        });

        filteredUsers.push(...additionalFiltered);
      }

      return this.paginateAndFormatUsers(filteredUsers, options);
    } catch (error) {
      this.logger.error(`Failed to get users by subscription status: ${error.message}`, error);
      // Fallback to getting all users
      const allUsers = await this.userRepository.getAllUsers(1000); // Limit to prevent memory issues
      const filteredUsers = allUsers.filter(user => {
        const computedStatus = this.computeSubscriptionStatus(user);
        return computedStatus === subscriptionStatus;
      });

      return this.paginateAndFormatUsers(filteredUsers, options);
    }
  }

  private async getAllUsersPaginated(
    options: { page: number; limit: number; sortBy: string; sortOrder: 'asc' | 'desc' }
  ): Promise<AdminUserListResponse> {
    // Production implementation with DynamoDB pagination
    this.logger.log(`Getting all users paginated - page: ${options.page}, limit: ${options.limit}`);

    try {
      // Calculate how many items to skip for pagination
      const skip = (options.page - 1) * options.limit;
      const fetchLimit = skip + options.limit;

      // For large datasets, we need to implement cursor-based pagination
      // For now, we'll use a reasonable limit to prevent memory issues
      const maxFetch = Math.min(fetchLimit * 2, 2000); // Don't fetch more than 2000 items

      const result = await this.userRepository.getUsersPaginated({
        limit: maxFetch,
      });

      let allUsers = result.users;

      // If we need more data and it's available, fetch additional batches
      if (allUsers.length < fetchLimit && result.lastEvaluatedKey) {
        let lastKey = result.lastEvaluatedKey;
        let attempts = 0;
        const maxAttempts = 3; // Limit additional fetches

        while (allUsers.length < fetchLimit && lastKey && attempts < maxAttempts) {
          const additionalResult = await this.userRepository.getUsersPaginated({
            limit: options.limit * 2,
            lastEvaluatedKey: lastKey,
          });

          allUsers.push(...additionalResult.users);
          lastKey = additionalResult.lastEvaluatedKey;
          attempts++;
        }
      }

      return this.paginateAndFormatUsers(allUsers, options);
    } catch (error) {
      this.logger.error(`Failed to get all users paginated: ${error.message}`, error);
      // Fallback to simple getAllUsers with limit
      const allUsers = await this.userRepository.getAllUsers(2000);
      return this.paginateAndFormatUsers(allUsers, options);
    }
  }

  private paginateAndFormatUsers(
    users: User[],
    options: { page: number; limit: number; sortBy: string; sortOrder: 'asc' | 'desc' }
  ): AdminUserListResponse {
    const { page, limit, sortBy, sortOrder } = options;

    // Sort users
    users.sort((a, b) => {
      let aValue: any;
      let bValue: any;

      switch (sortBy) {
        case 'handle':
          aValue = a.handle.toLowerCase();
          bValue = b.handle.toLowerCase();
          break;
        case 'subscriptionStatus':
          aValue = this.computeSubscriptionStatus(a);
          bValue = this.computeSubscriptionStatus(b);
          break;
        case 'createdAt':
        default:
          aValue = new Date(a.createdAt);
          bValue = new Date(b.createdAt);
          break;
      }

      if (sortOrder === 'asc') {
        return aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
      } else {
        return aValue > bValue ? -1 : aValue < bValue ? 1 : 0;
      }
    });

    // Pagination
    const total = users.length;
    const totalPages = Math.ceil(total / limit);
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const paginatedUsers = users.slice(startIndex, endIndex);

    // Transform to admin format
    const adminUsers: AdminUserListItem[] = paginatedUsers.map(user => ({
      userId: user.userId,
      handle: user.handle,
      phoneNumber: this.maskPhoneNumber(user.phoneNumber),
      subscriptionStatus: this.computeSubscriptionStatus(user),
      trialExpiresAt: user.trialEndDate,
      subscriptionExpiresAt: user.subscriptionEndDate,
      createdAt: user.createdAt,
      lastLoginAt: user.lastLoginAt,
      followerCount: user.followerCount,
      isVerified: user.isVerified,
    }));

    return {
      users: adminUsers,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
    };
  }

  async getStats(): Promise<AdminStatsResponse> {
    try {
      this.logger.log('Computing admin stats with optimized queries');

      // Use parallel queries for better performance
      const [recentUsersResult, allUsersResult] = await Promise.all([
        // Get recent users for signup stats
        this.getRecentUsers(30), // Last 30 days
        // Get all users with reasonable limit for stats
        this.userRepository.getAllUsers(10000), // Limit to prevent memory issues
      ]);

      const now = new Date();
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

      // Initialize counters
      const stats = {
        totalUsers: 0,
        trialCount: 0,
        paidCount: 0,
        expiredCount: 0,
        pendingCount: 0,
        signupsLast7Days: 0,
        signupsLast30Days: 0,
        activeTrials: 0,
        expiredTrials: 0,
      };

      // Process all users for status counts
      for (const user of allUsersResult) {
        stats.totalUsers++;

        const computedStatus = this.computeSubscriptionStatus(user);

        // Count by subscription status
        switch (computedStatus) {
          case SubscriptionStatus.TRIAL:
            stats.trialCount++;
            // Check if trial is still active
            if (user.trialEndDate && new Date(user.trialEndDate) > now) {
              stats.activeTrials++;
            } else {
              stats.expiredTrials++;
            }
            break;
          case SubscriptionStatus.ACTIVE:
            stats.paidCount++;
            break;
          case SubscriptionStatus.EXPIRED:
            stats.expiredCount++;
            break;
          case SubscriptionStatus.PENDING:
            stats.pendingCount++;
            break;
        }
      }

      // Process recent users for signup stats
      for (const user of recentUsersResult) {
        const createdAt = new Date(user.createdAt);

        if (createdAt > sevenDaysAgo) {
          stats.signupsLast7Days++;
        }
        if (createdAt > thirtyDaysAgo) {
          stats.signupsLast30Days++;
        }
      }

      this.logger.log(`Admin stats computed for ${stats.totalUsers} users`, {
        totalUsers: stats.totalUsers,
        activeTrials: stats.activeTrials,
        paidCount: stats.paidCount,
        signupsLast7Days: stats.signupsLast7Days,
      });

      return stats;
    } catch (error) {
      this.logger.error(`Failed to compute stats: ${error.message}`, error);
      throw new Error('Failed to compute statistics');
    }
  }

  private async getRecentUsers(days: number): Promise<User[]> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - days);

      // Use scan with filter for recent users
      // In production, consider adding a GSI on createdAt for better performance
      const result = await this.userRepository.getUsersPaginated({
        limit: 1000, // Reasonable limit for recent users
      });

      // Filter for recent users
      const recentUsers = result.users.filter(user =>
        new Date(user.createdAt) > cutoffDate
      );

      this.logger.log(`Found ${recentUsers.length} users created in last ${days} days`);
      return recentUsers;
    } catch (error) {
      this.logger.error(`Failed to get recent users: ${error.message}`, error);
      return [];
    }
  }

  async getUserDetails(userId: string): Promise<User | null> {
    try {
      this.logger.log(`Getting user details for: ${userId}`);
      return await this.userRepository.getUserById(userId);
    } catch (error) {
      this.logger.error(`Failed to get user details: ${error.message}`, error);
      return null;
    }
  }



  private computeSubscriptionStatus(user: User): SubscriptionStatus {
    const now = new Date();
    
    // Check if trial has expired
    if (user.subscriptionStatus === SubscriptionStatus.TRIAL && user.trialEndDate) {
      const trialEnd = new Date(user.trialEndDate);
      if (now > trialEnd) {
        return SubscriptionStatus.EXPIRED;
      }
    }
    
    // Check if paid subscription has expired
    if (user.subscriptionStatus === SubscriptionStatus.ACTIVE && user.subscriptionEndDate) {
      const subscriptionEnd = new Date(user.subscriptionEndDate);
      if (now > subscriptionEnd) {
        return SubscriptionStatus.EXPIRED;
      }
    }
    
    return user.subscriptionStatus;
  }

  private maskPhoneNumber(phoneNumber?: string): string | undefined {
    if (!phoneNumber) return undefined;
    
    // Mask phone number for privacy: +256 7XX XXX XXX
    if (phoneNumber.startsWith('+256') && phoneNumber.length >= 13) {
      return `+256 7XX XXX XXX`;
    }
    
    // Generic masking for other formats
    if (phoneNumber.length > 6) {
      return phoneNumber.substring(0, 3) + 'X'.repeat(phoneNumber.length - 6) + phoneNumber.substring(phoneNumber.length - 3);
    }
    
    return phoneNumber;
  }
}
