import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { AdminSessionRepository } from '../repository/admin-session.repository';

@Injectable()
export class AdminCleanupService {
  private readonly logger = new Logger(AdminCleanupService.name);

  constructor(private adminSessionRepository: AdminSessionRepository) {}

  // Run cleanup every hour
  @Cron(CronExpression.EVERY_HOUR)
  async cleanupExpiredSessions(): Promise<void> {
    try {
      this.logger.log('Starting scheduled cleanup of expired admin sessions');
      
      const result = await this.adminSessionRepository.cleanupExpiredSessions();
      
      this.logger.log(
        `Scheduled cleanup completed: ${result.deletedCount} sessions deleted, ${result.errors} errors`
      );

      // Log warning if there were errors
      if (result.errors > 0) {
        this.logger.warn(`Cleanup completed with ${result.errors} errors`);
      }
    } catch (error) {
      this.logger.error(`Scheduled cleanup failed: ${error.message}`, error);
    }
  }

  // Run session stats logging every 6 hours for monitoring
  @Cron(CronExpression.EVERY_6_HOURS)
  async logSessionStats(): Promise<void> {
    try {
      this.logger.log('Generating admin session statistics');
      
      const stats = await this.adminSessionRepository.getSessionStats();
      
      this.logger.log('Admin Session Stats:', {
        totalSessions: stats.totalSessions,
        activeSessions: stats.activeSessions,
        expiredSessions: stats.expiredSessions,
        revokedSessions: stats.revokedSessions,
      });

      // Alert if too many expired sessions (potential cleanup issues)
      if (stats.expiredSessions > 100) {
        this.logger.warn(
          `High number of expired sessions detected: ${stats.expiredSessions}. Consider running manual cleanup.`
        );
      }
    } catch (error) {
      this.logger.error(`Failed to generate session stats: ${error.message}`, error);
    }
  }

  // Manual cleanup method for admin endpoints
  async manualCleanup(): Promise<{ deletedCount: number; errors: number }> {
    try {
      this.logger.log('Starting manual cleanup of expired admin sessions');
      
      const result = await this.adminSessionRepository.cleanupExpiredSessions();
      
      this.logger.log(
        `Manual cleanup completed: ${result.deletedCount} sessions deleted, ${result.errors} errors`
      );

      return result;
    } catch (error) {
      this.logger.error(`Manual cleanup failed: ${error.message}`, error);
      throw error;
    }
  }

  // Get current session statistics
  async getSessionStats(): Promise<{
    totalSessions: number;
    activeSessions: number;
    expiredSessions: number;
    revokedSessions: number;
  }> {
    try {
      return await this.adminSessionRepository.getSessionStats();
    } catch (error) {
      this.logger.error(`Failed to get session stats: ${error.message}`, error);
      throw error;
    }
  }
}
