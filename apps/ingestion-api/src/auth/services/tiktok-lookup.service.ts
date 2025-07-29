import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApifyClient } from 'apify-client';

export interface TikTokProfileResult {
  exists: boolean;
  profilePhotoUrl?: string;
  followerCount?: number;
  isVerified?: boolean;
  displayName?: string;
}

interface ApifyTikTokResponse {
  // Profile data can be in authorMeta or directly in the item
  authorMeta?: {
    id?: string;
    name?: string;
    nickName?: string;
    verified?: boolean;
    avatar?: string;
    fans?: number;
    following?: number;
    heart?: number;
    video?: number;
  };
  // Or directly in the item
  uniqueId?: string;
  nickname?: string;
  name?: string;
  avatarLarger?: string;
  avatarMedium?: string;
  avatarThumb?: string;
  avatar?: string;
  followerCount?: number;
  fans?: number;
  verified?: boolean;
  error?: string;
}

@Injectable()
export class TikTokLookupService {
  private readonly logger = new Logger(TikTokLookupService.name);
  private readonly apifyClient: ApifyClient;
  private readonly actorId = 'clockworks/tiktok-profile-scraper';
  private readonly maxRetries = 3;
  private readonly retryDelay = 1000; // 1 second

  // Cache for background-collected profile data
  private readonly profileDataCache = new Map<string, {
    data: TikTokProfileResult;
    timestamp: number;
    expiresAt: number;
  }>();
  private readonly PROFILE_CACHE_TIMEOUT = 30 * 60 * 1000; // 30 minutes

  constructor(private readonly configService: ConfigService) {
    const apifyToken = this.configService.get<string>('APIFY_TOKEN');
    if (!apifyToken) {
      this.logger.warn('APIFY_TOKEN not configured, TikTok validation will be limited');
    }
    this.apifyClient = new ApifyClient({
      token: apifyToken,
    });
  }

  /**
   * Fast validation for handle existence using Apify (optimized for speed)
   * Returns as soon as we find any content, then continues collecting profile data in background
   * @param handle TikTok handle without @ symbol
   * @returns Promise<TikTokProfileResult>
   */
  async validateHandle(handle: string): Promise<TikTokProfileResult> {
    const cleanHandle = this.cleanHandle(handle);
    this.logger.log(`Fast Apify validation for TikTok handle: ${cleanHandle}`);

    try {
      // Use optimized Apify validation that returns quickly
      return await this.validateWithApifyFast(cleanHandle);

    } catch (error) {
      this.logger.error(`Apify validation failed for TikTok handle ${cleanHandle}:`, error);

      if (error instanceof HttpException) {
        throw error;
      }

      // For any other errors, assume handle doesn't exist
      this.logger.warn(`Apify validation error for ${cleanHandle}, assuming handle doesn't exist`);
      return { exists: false };
    }
  }

  /**
   * Detailed validation using Apify (for when we need full profile info)
   * This is slower but provides complete profile data
   * @param handle TikTok handle without @ symbol
   * @returns Promise<TikTokProfileResult>
   */
  async validateHandleDetailed(handle: string): Promise<TikTokProfileResult> {
    const cleanHandle = this.cleanHandle(handle);
    this.logger.log(`Detailed validating TikTok handle: ${cleanHandle}`);

    try {
      // Use Apify for detailed profile information
      return await this.validateWithApify(cleanHandle);

    } catch (error) {
      this.logger.error(`Apify validation failed for TikTok handle ${cleanHandle}:`, error);

      if (error instanceof HttpException) {
        throw error;
      }

      // For Apify errors, provide more specific error message
      throw new HttpException(
        `Unable to validate TikTok handle using Apify: ${(error as Error).message}`,
        HttpStatus.SERVICE_UNAVAILABLE
      );
    }
  }

  /**
   * Ultra-fast Apify validation - optimized for minimal scraping
   * Returns as soon as we confirm the handle exists
   */
  private async validateWithApifyFast(handle: string): Promise<TikTokProfileResult> {
    if (!this.configService.get<string>('APIFY_TOKEN')) {
      throw new Error('Apify token not configured');
    }

    // Minimal input for fastest possible validation
    const input = {
      profiles: [handle],
      shouldDownloadCovers: false,
      shouldDownloadSlideshowImages: false,
      shouldDownloadSubtitles: false,
      shouldDownloadVideos: false,
      resultsPerPage: 1, // Absolute minimum - just 1 post to confirm existence
      maxProfilesPerQuery: 1, // Only this profile
    };

    try {
      this.logger.debug(`Starting ultra-fast Apify validation for handle: ${handle}`);

      // Start the actor run with aggressive timeout
      const run = await this.apifyClient.actor(this.actorId).call(input, {
        timeout: 45, // 45 seconds max - balance between speed and reliability
        memory: 512, // Lower memory for faster startup
      });

      this.logger.debug(`Apify run completed for ${handle}:`, {
        runId: run.id,
        status: run.status,
        defaultDatasetId: run.defaultDatasetId,
        duration: run.stats?.runTimeSecs
      });

      // Check if the run failed
      if (run.status === 'FAILED') {
        this.logger.warn(`Apify run failed for handle: ${handle}`, run.statusMessage);
        return { exists: false };
      }

      if (!run.defaultDatasetId) {
        this.logger.warn(`No dataset ID returned for handle: ${handle}`);
        return { exists: false };
      }

      // Get results and validate them properly
      const { items } = await this.apifyClient.dataset(run.defaultDatasetId).listItems();

      this.logger.debug(`Dataset items for ${handle}:`, {
        count: items?.length || 0,
        firstItem: items?.[0] ? Object.keys(items[0]) : []
      });

      if (!items || items.length === 0) {
        this.logger.debug(`No items found - handle likely doesn't exist: ${handle}`);
        return { exists: false };
      }

      // Validate that we actually got valid TikTok data
      const firstItem = items[0];

      // Check for error indicators
      if (firstItem.error || firstItem.errorMessage) {
        this.logger.debug(`Error in Apify response for ${handle}:`, firstItem.error || firstItem.errorMessage);
        return { exists: false };
      }

      // Check for valid profile indicators
      const hasValidProfile = firstItem.authorMeta ||
                             firstItem.uniqueId ||
                             firstItem.nickname ||
                             firstItem.author ||
                             firstItem.id; // Any valid TikTok content indicator

      if (!hasValidProfile) {
        this.logger.debug(`No valid profile data found for handle: ${handle}`);
        return { exists: false };
      }

      // If we got here, the handle exists and has content
      this.logger.log(`✅ Handle validation successful: ${handle} (${run.stats?.runTimeSecs || 'unknown'}s)`);

      // Start background collection for detailed profile data
      this.collectDetailedProfileDataInBackground(handle, run.defaultDatasetId);

      return { exists: true };

    } catch (error) {
      this.logger.warn(`Apify validation failed for ${handle}:`, (error as Error).message);
      return { exists: false };
    }
  }

  /**
   * Original detailed Apify validation - used for background collection
   */
  private async validateWithApify(handle: string): Promise<TikTokProfileResult> {
    if (!this.configService.get<string>('APIFY_TOKEN')) {
      throw new Error('Apify token not configured');
    }

    const input = {
      profiles: [handle], // Just the username, not the full URL
      shouldDownloadCovers: false,
      shouldDownloadSlideshowImages: false,
      shouldDownloadSubtitles: false,
      shouldDownloadVideos: false,
      resultsPerPage: 100, // Default from documentation
    };

    let lastError: Error;
    
    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        this.logger.debug(`Apify validation attempt ${attempt} for handle: ${handle}`);
        
        // Run the actor
        const run = await this.apifyClient.actor(this.actorId).call(input, {
          timeout: 60, // 60 seconds timeout
        });

        this.logger.debug(`Apify run completed for ${handle}:`, {
          runId: run.id,
          status: run.status,
          defaultDatasetId: run.defaultDatasetId,
          stats: run.stats
        });

        // Check if the run failed
        if (run.status === 'FAILED') {
          this.logger.warn(`Apify run failed for handle: ${handle}`, run.statusMessage);
          throw new Error(`Apify run failed: ${run.statusMessage}`);
        }

        if (!run.defaultDatasetId) {
          this.logger.warn(`No dataset ID returned for handle: ${handle}`);
          return { exists: false };
        }

        // Get results
        const { items } = await this.apifyClient.dataset(run.defaultDatasetId).listItems();

        this.logger.debug(`Dataset items count for ${handle}: ${items?.length || 0}`);

        if (!items || items.length === 0) {
          this.logger.debug(`No items found in dataset for handle: ${handle}`);
          return { exists: false };
        }

        // Log the response structure for debugging
        this.logger.debug(`Apify response for ${handle}:`, JSON.stringify(items[0], null, 2));

        // Find the profile data - could be in authorMeta or direct profile data
        let profileData = null;

        for (const item of items) {
          // Check if this item has profile information
          if (item.authorMeta) {
            profileData = item.authorMeta;
            break;
          } else if (item.uniqueId || item.nickname || item.name) {
            profileData = item;
            break;
          }
        }

        if (!profileData) {
          this.logger.debug(`No profile data found for handle: ${handle}`);
          return { exists: false };
        }

        // Check if profile exists and is valid
        if (profileData.error || (!profileData.uniqueId && !profileData.name)) {
          this.logger.debug(`Profile error or invalid data for handle: ${handle}`);
          return { exists: false };
        }

        return {
          exists: true,
          profilePhotoUrl: profileData.avatar || profileData.avatarLarger || profileData.avatarMedium || profileData.avatarThumb,
          followerCount: profileData.fans || profileData.followerCount || 0,
          isVerified: profileData.verified || false,
          displayName: profileData.nickName || profileData.nickname || profileData.name || profileData.uniqueId,
        };

      } catch (error) {
        lastError = error;
        this.logger.warn(`Apify attempt ${attempt} failed for ${handle}:`, (error as Error).message);
        
        if (attempt < this.maxRetries) {
          await this.sleep(this.retryDelay * attempt); // Exponential backoff
        }
      }
    }

    throw lastError;
  }

  // Removed unused validation methods - now using only Apify for accurate results

  /**
   * Cleans and validates the handle format
   */
  private cleanHandle(handle: string): string {
    if (!handle) {
      throw new HttpException('Handle is required', HttpStatus.BAD_REQUEST);
    }

    // Remove @ symbol if present
    let cleanHandle = handle.replace(/^@/, '');
    
    // Validate handle format (alphanumeric, dots, underscores)
    const handleRegex = /^[a-zA-Z0-9._]+$/;
    if (!handleRegex.test(cleanHandle)) {
      throw new HttpException(
        'Invalid handle format. Handle can only contain letters, numbers, dots, and underscores.',
        HttpStatus.BAD_REQUEST
      );
    }

    // Check length constraints
    if (cleanHandle.length < 2 || cleanHandle.length > 24) {
      throw new HttpException(
        'Handle must be between 2 and 24 characters long.',
        HttpStatus.BAD_REQUEST
      );
    }

    return cleanHandle;
  }

  /**
   * Collect detailed profile data in the background using existing dataset
   * This runs after fast validation to gather profile info without blocking the user
   */
  private collectDetailedProfileDataInBackground(handle: string, datasetId: string): void {
    // Use setTimeout to make this truly async and non-blocking
    setTimeout(async () => {
      try {
        this.logger.debug(`Starting background profile collection for: ${handle} using dataset: ${datasetId}`);

        // Get all items from the dataset for detailed analysis
        const { items } = await this.apifyClient.dataset(datasetId).listItems();

        if (!items || items.length === 0) {
          this.logger.debug(`No items found in background collection for: ${handle}`);
          return;
        }

        // Process the items to extract profile information
        let profileData = null;
        for (const item of items) {
          if (item.authorMeta) {
            profileData = item.authorMeta;
            break;
          } else if (item.uniqueId || item.nickname || item.name) {
            profileData = item;
            break;
          }
        }

        if (profileData && !profileData.error) {
          const detailedResult: TikTokProfileResult = {
            exists: true,
            profilePhotoUrl: profileData.avatar || profileData.avatarLarger || profileData.avatarMedium || profileData.avatarThumb,
            followerCount: profileData.fans || profileData.followerCount || 0,
            isVerified: profileData.verified || false,
            displayName: profileData.nickName || profileData.nickname || profileData.name || profileData.uniqueId,
          };

          // Cache the detailed profile data
          this.cacheProfileData(handle, detailedResult);

          this.logger.debug(`Background profile collection completed for: ${handle}`, {
            verified: detailedResult.isVerified,
            followers: detailedResult.followerCount,
            displayName: detailedResult.displayName
          });
        }

      } catch (error) {
        // Don't throw errors in background collection - just log them
        this.logger.warn(`Background profile collection failed for ${handle}:`, (error as Error).message);
      }
    }, 100); // Small delay to ensure the main response is sent first
  }

  /**
   * Cache profile data collected in background
   */
  private cacheProfileData(handle: string, data: TikTokProfileResult): void {
    const now = Date.now();
    this.profileDataCache.set(handle, {
      data,
      timestamp: now,
      expiresAt: now + this.PROFILE_CACHE_TIMEOUT,
    });
  }

  /**
   * Get cached profile data if available
   */
  getCachedProfileData(handle: string): TikTokProfileResult | null {
    const cached = this.profileDataCache.get(handle);

    if (!cached || Date.now() > cached.expiresAt) {
      this.profileDataCache.delete(handle);
      return null;
    }

    return cached.data;
  }

  /**
   * Sleep utility for retry delays
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get rate limit status (useful for monitoring)
   */
  async getRateLimitStatus(): Promise<any> {
    try {
      if (!this.configService.get<string>('APIFY_TOKEN')) {
        return { available: false, reason: 'No Apify token configured' };
      }

      const user = await this.apifyClient.user().get();
      return {
        available: true,
        user: user,
      };
    } catch (error) {
      this.logger.error('Failed to get Apify rate limit status:', error);
      return { available: false, reason: (error as Error).message };
    }
  }
}
