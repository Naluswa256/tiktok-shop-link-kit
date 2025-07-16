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
   * Validates if a TikTok handle exists using only Apify (for testing)
   * @param handle TikTok handle without @ symbol
   * @returns Promise<TikTokProfileResult>
   */
  async validateHandle(handle: string): Promise<TikTokProfileResult> {
    const cleanHandle = this.cleanHandle(handle);
    this.logger.log(`Validating TikTok handle: ${cleanHandle}`);

    try {
      // Only use Apify for testing - no fallback
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
   * Validates handle using Apify TikTok Profile Scraper
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

  /**
   * Fallback method using TikTok RSS feed to check if profile exists
   */
  private async validateWithRssFallback(handle: string): Promise<TikTokProfileResult> {
    try {
      const rssUrl = `https://www.tiktok.com/@${handle}/rss`;
      
      // Use fetch to check if RSS feed exists
      const response = await fetch(rssUrl, {
        method: 'HEAD',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        },
        signal: AbortSignal.timeout(10000), // 10 second timeout
      });

      if (response.ok) {
        this.logger.log(`RSS validation successful for handle: ${handle}`);
        return {
          exists: true,
          // RSS method doesn't provide profile photo or other details
        };
      }

      return { exists: false };

    } catch (error) {
      this.logger.warn(`RSS validation failed for ${handle}:`, (error as Error).message);
      return { exists: false };
    }
  }

  /**
   * Alternative fallback using direct profile page check
   */
  private async validateWithDirectCheck(handle: string): Promise<TikTokProfileResult> {
    try {
      const profileUrl = `https://www.tiktok.com/@${handle}`;
      
      const response = await fetch(profileUrl, {
        method: 'HEAD',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        },
        signal: AbortSignal.timeout(10000),
      });

      // TikTok returns 200 for valid profiles, 404 for invalid ones
      if (response.ok) {
        return { exists: true };
      }

      return { exists: false };

    } catch (error) {
      this.logger.warn(`Direct check failed for ${handle}:`, (error as Error).message);
      throw error;
    }
  }

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
