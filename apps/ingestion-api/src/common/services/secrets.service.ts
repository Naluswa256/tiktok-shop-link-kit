import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';

@Injectable()
export class SecretsService {
  private readonly logger = new Logger(SecretsService.name);
  private readonly secretsClient: SecretsManagerClient;
  private readonly secretsCache = new Map<string, { value: any; expiry: number }>();
  private readonly cacheTimeout = 5 * 60 * 1000; // 5 minutes

  constructor(private readonly configService: ConfigService) {
    const region = this.configService.get('AWS_REGION', 'us-east-1');
    this.secretsClient = new SecretsManagerClient({ region });
  }

  /**
   * Get a secret value from AWS Secrets Manager with caching
   */
  async getSecret(secretArn: string, key?: string): Promise<string | null> {
    const cacheKey = `${secretArn}:${key || 'full'}`;
    
    // Check cache first
    const cached = this.secretsCache.get(cacheKey);
    if (cached && Date.now() < cached.expiry) {
      this.logger.debug(`Using cached secret for ${cacheKey}`);
      return cached.value;
    }

    try {
      this.logger.debug(`Fetching secret from AWS Secrets Manager: ${secretArn}`);
      
      const command = new GetSecretValueCommand({
        SecretId: secretArn,
      });

      const response = await this.secretsClient.send(command);
      
      if (!response.SecretString) {
        this.logger.warn(`Secret ${secretArn} has no SecretString value`);
        return null;
      }

      let secretValue: any;
      
      try {
        // Try to parse as JSON
        secretValue = JSON.parse(response.SecretString);
      } catch {
        // If not JSON, use as plain string
        secretValue = response.SecretString;
      }

      // If a specific key is requested and the secret is a JSON object
      if (key && typeof secretValue === 'object' && secretValue !== null) {
        const keyValue = secretValue[key];
        
        // Cache the specific key value
        this.secretsCache.set(cacheKey, {
          value: keyValue || null,
          expiry: Date.now() + this.cacheTimeout,
        });
        
        return keyValue || null;
      }

      // Cache the full secret value
      this.secretsCache.set(cacheKey, {
        value: secretValue,
        expiry: Date.now() + this.cacheTimeout,
      });

      return secretValue;
      
    } catch (error) {
      this.logger.error(`Failed to fetch secret ${secretArn}:`, error);
      return null;
    }
  }

  /**
   * Get the Apify token from Secrets Manager
   */
  async getApifyToken(): Promise<string | null> {
    const secretArn = this.configService.get('APIFY_TOKEN_SECRET_ARN');
    
    if (!secretArn) {
      this.logger.debug('APIFY_TOKEN_SECRET_ARN not configured, checking direct APIFY_TOKEN');
      return this.configService.get('APIFY_TOKEN') || null;
    }

    return this.getSecret(secretArn, 'apify_token');
  }

  /**
   * Clear the secrets cache (useful for testing or forced refresh)
   */
  clearCache(): void {
    this.secretsCache.clear();
    this.logger.debug('Secrets cache cleared');
  }
}
