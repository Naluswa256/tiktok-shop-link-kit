import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import * as fs from 'fs';
import * as path from 'path';

// Simple logger implementation
class Logger {
  constructor(private context: string) {}

  info(message: string, meta?: Record<string, unknown>) {
    console.log(`[${this.context}] INFO: ${message}`, meta ? JSON.stringify(meta) : '');
  }

  error(message: string, meta?: Record<string, unknown>) {
    console.error(`[${this.context}] ERROR: ${message}`, meta ? JSON.stringify(meta) : '');
  }

  warn(message: string, meta?: Record<string, unknown>) {
    console.warn(`[${this.context}] WARN: ${message}`, meta ? JSON.stringify(meta) : '');
  }

  debug(message: string, meta?: Record<string, unknown>) {
    if (process.env.LOG_LEVEL === 'debug') {
      console.debug(`[${this.context}] DEBUG: ${message}`, meta ? JSON.stringify(meta) : '');
    }
  }
}

export interface S3UploadResult {
  success: boolean;
  s3Key: string;
  s3Url: string;
  error?: string;
}

export class S3Service {
  private s3Client: S3Client;
  private logger = new Logger('S3Service');
  private bucketName: string;
  private region: string;

  constructor(bucketName: string, region: string) {
    this.bucketName = bucketName;
    this.region = region;
    
    this.s3Client = new S3Client({
      region: region,
      maxAttempts: 3
    });
  }

  async uploadThumbnail(
    filePath: string,
    sellerHandle: string,
    videoId: string,
    index: number = 0,
    isPrimary: boolean = false
  ): Promise<S3UploadResult> {
    try {
      // Generate S3 key with index for multiple thumbnails
      const timestamp = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
      const fileName = isPrimary ? `${videoId}_primary.jpg` : `${videoId}_${index}.jpg`;
      const s3Key = `thumbnails/${sellerHandle}/${timestamp}/${fileName}`;

      this.logger.info('Uploading thumbnail to S3', {
        filePath,
        s3Key,
        bucketName: this.bucketName,
        index,
        isPrimary
      });

      // Read file for upload
      const fileBuffer = fs.readFileSync(filePath);
      const fileStats = fs.statSync(filePath);

      // Upload to S3
      const command = new PutObjectCommand({
        Bucket: this.bucketName,
        Key: s3Key,
        Body: fileBuffer,
        ContentType: 'image/jpeg',
        ContentLength: fileStats.size,
        CacheControl: 'max-age=31536000', // 1 year cache
        Metadata: {
          'video-id': videoId,
          'seller-handle': sellerHandle,
          'thumbnail-index': index.toString(),
          'is-primary': isPrimary.toString(),
          'generated-at': new Date().toISOString(),
          'file-size': fileStats.size.toString()
        },
        ServerSideEncryption: 'AES256'
      });

      await this.s3Client.send(command);

      // Generate public URL
      const s3Url = `https://${this.bucketName}.s3.${this.region}.amazonaws.com/${s3Key}`;

      this.logger.info('Thumbnail uploaded successfully', {
        s3Key,
        s3Url,
        fileSize: `${Math.round(fileStats.size / 1024)}KB`,
        index,
        isPrimary
      });

      return {
        success: true,
        s3Key,
        s3Url
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error('Failed to upload thumbnail to S3', {
        error: errorMessage,
        filePath,
        sellerHandle,
        videoId,
        index
      });

      return {
        success: false,
        s3Key: '',
        s3Url: '',
        error: errorMessage
      };
    }
  }

  async uploadMultipleThumbnails(
    thumbnailPaths: string[],
    sellerHandle: string,
    videoId: string
  ): Promise<S3UploadResult[]> {
    const results: S3UploadResult[] = [];

    for (let i = 0; i < thumbnailPaths.length; i++) {
      const isPrimary = i === 0; // First thumbnail is primary
      const result = await this.uploadThumbnail(
        thumbnailPaths[i],
        sellerHandle,
        videoId,
        i,
        isPrimary
      );
      results.push(result);
    }

    this.logger.info('Multiple thumbnails upload completed', {
      sellerHandle,
      videoId,
      totalThumbnails: thumbnailPaths.length,
      successfulUploads: results.filter(r => r.success).length
    });

    return results;
  }

  async checkThumbnailExists(sellerHandle: string, videoId: string): Promise<boolean> {
    try {
      // Try different possible keys (in case of date changes)
      const today = new Date().toISOString().split('T')[0];
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      
      const possibleKeys = [
        `thumbnails/${sellerHandle}/${today}/${videoId}_primary.jpg`,
        `thumbnails/${sellerHandle}/${yesterday}/${videoId}_primary.jpg`,
        `thumbnails/${sellerHandle}/${videoId}_primary.jpg` // Legacy format
      ];

      for (const key of possibleKeys) {
        try {
          const command = new GetObjectCommand({
            Bucket: this.bucketName,
            Key: key
          });

          await this.s3Client.send(command);

          this.logger.debug('Thumbnail already exists', { s3Key: key });
          return true;
        } catch (error: unknown) {
          // If it's a NoSuchKey error, continue to next key
          const awsError = error as { name?: string; $metadata?: { httpStatusCode?: number } };
          if (awsError.name === 'NoSuchKey' || awsError.$metadata?.httpStatusCode === 404) {
            continue;
          }
          // For other errors, log and continue
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          this.logger.debug('Error checking key', { key, error: errorMessage });
        }
      }

      return false;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.warn('Error checking thumbnail existence', {
        error: errorMessage,
        sellerHandle,
        videoId
      });
      return false;
    }
  }

  generateThumbnailUrl(sellerHandle: string, videoId: string, date?: string): string {
    const dateStr = date || new Date().toISOString().split('T')[0];
    const s3Key = `thumbnails/${sellerHandle}/${dateStr}/${videoId}.jpg`;
    return `https://${this.bucketName}.s3.${this.region}.amazonaws.com/${s3Key}`;
  }

  async getThumbnailMetadata(s3Key: string): Promise<Record<string, string> | undefined> {
    try {
      const command = new GetObjectCommand({
        Bucket: this.bucketName,
        Key: s3Key
      });

      const response = await this.s3Client.send(command);
      return response.Metadata;

    } catch (error) {
      this.logger.error('Failed to get thumbnail metadata', {
        error: error.message,
        s3Key
      });
      return undefined;
    }
  }

  async cleanupOldThumbnails(sellerHandle: string, daysOld: number = 30): Promise<void> {
    // This would implement cleanup of old thumbnails
    // For now, we'll just log the intent
    this.logger.info('Thumbnail cleanup requested', {
      sellerHandle,
      daysOld,
      note: 'Cleanup not implemented yet - consider using S3 lifecycle policies'
    });
  }
}
