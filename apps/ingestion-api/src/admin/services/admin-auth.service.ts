import { Injectable, Logger, UnauthorizedException, HttpException, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';
import { AdminSessionRepository } from '../repository/admin-session.repository';

export interface AdminLoginRequest {
  username: string;
  password: string;
}

export interface AdminLoginResponse {
  success: boolean;
  accessToken: string;
  expiresAt: string;
}

export interface AdminRefreshResponse {
  success: boolean;
  accessToken: string;
  expiresAt: string;
  refreshToken?: string; // Only if rotated
}

export interface AdminJwtPayload {
  sub: string; // admin username
  role: string; // 'admin'
  sessionId: string;
  iat: number;
  exp: number;
}

@Injectable()
export class AdminAuthService {
  private readonly logger = new Logger(AdminAuthService.name);
  private readonly adminUsername: string;
  private readonly adminPasswordHash: string;
  private readonly jwtSecret: string;
  private readonly accessExpiresIn: string;
  private readonly refreshExpiresIn: string;

  constructor(
    private configService: ConfigService,
    private jwtService: JwtService,
    private adminSessionRepository: AdminSessionRepository,
  ) {
    this.adminUsername = this.configService.get<string>('admin.username')!;
    this.adminPasswordHash = this.configService.get<string>('admin.passwordHash')!;
    this.jwtSecret = this.configService.get<string>('admin.jwtSecret')!;
    this.accessExpiresIn = this.configService.get<string>('admin.jwtAccessExpiresIn', '900s');
    this.refreshExpiresIn = this.configService.get<string>('admin.jwtRefreshExpiresIn', '7d');
  }

  async login(loginData: AdminLoginRequest, ip?: string, userAgent?: string): Promise<{ response: AdminLoginResponse; refreshToken: string }> {
    const startTime = Date.now();
    try {
      this.logger.log(`Admin login attempt for username: ${loginData.username} from IP: ${ip}`);

      // Input validation
      if (!loginData.username || !loginData.password) {
        this.logger.warn(`Invalid login attempt - missing credentials from IP: ${ip}`);
        throw new UnauthorizedException('Username and password are required');
      }

      // Validate username
      if (loginData.username !== this.adminUsername) {
        this.logger.warn(`Invalid admin username attempt: ${loginData.username} from IP: ${ip}`);
        // Add delay to prevent timing attacks
        await new Promise(resolve => setTimeout(resolve, 1000));
        throw new UnauthorizedException('Invalid credentials');
      }

      // Validate password with timing attack protection
      const isPasswordValid = await bcrypt.compare(loginData.password, this.adminPasswordHash);
      if (!isPasswordValid) {
        this.logger.warn(`Invalid password attempt for admin: ${loginData.username} from IP: ${ip}`);
        // Add delay to prevent timing attacks
        await new Promise(resolve => setTimeout(resolve, 1000));
        throw new UnauthorizedException('Invalid credentials');
      }

      // Check for existing sessions and enforce limits
      const sessionStats = await this.adminSessionRepository.getSessionStats();
      const maxConcurrentSessions = 5; // Configurable limit

      if (sessionStats.activeSessions >= maxConcurrentSessions) {
        this.logger.warn(`Max concurrent sessions reached for admin: ${loginData.username}`);
        // Optionally clean up oldest sessions or reject login
        // For now, we'll allow but log the warning
      }

      // Generate session ID and tokens
      const refreshToken = uuidv4();

      // Calculate expiration times
      const accessExpiresAt = this.calculateExpirationTime(this.accessExpiresIn);
      const refreshExpiresAt = this.calculateExpirationTime(this.refreshExpiresIn);

      // Create admin session with enhanced metadata
      await this.adminSessionRepository.createSession({
        sessionId: refreshToken, // Use refresh token as session ID
        adminUsername: this.adminUsername,
        expiresAt: refreshExpiresAt,
        ip,
        userAgent,
      });

      // Generate access token
      const accessToken = await this.generateAccessToken(this.adminUsername, refreshToken);

      const duration = Date.now() - startTime;
      this.logger.log(`Admin login successful for: ${loginData.username} (${duration}ms)`, {
        username: loginData.username,
        ip,
        userAgent,
        duration,
      });

      return {
        response: {
          success: true,
          accessToken,
          expiresAt: accessExpiresAt,
        },
        refreshToken,
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      this.logger.error(`Admin login failed: ${error.message} (${duration}ms)`, {
        username: loginData.username,
        ip,
        userAgent,
        duration,
        error: error.message,
      });
      
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      
      throw new HttpException(
        'Login failed',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async refresh(refreshToken: string, ip?: string, userAgent?: string): Promise<{ response: AdminRefreshResponse; newRefreshToken?: string }> {
    try {
      this.logger.log('Admin token refresh attempt');

      // Validate refresh token session
      const session = await this.adminSessionRepository.getSession(refreshToken);
      if (!session) {
        this.logger.warn('Invalid or expired refresh token');
        throw new UnauthorizedException('Invalid refresh token');
      }

      // Generate new access token
      const accessToken = await this.generateAccessToken(session.adminUsername, refreshToken);
      const accessExpiresAt = this.calculateExpirationTime(this.accessExpiresIn);

      // Optionally rotate refresh token for better security
      const shouldRotateToken = true; // Can be configurable
      let newRefreshToken: string | undefined;

      if (shouldRotateToken) {
        newRefreshToken = uuidv4();
        const refreshExpiresAt = this.calculateExpirationTime(this.refreshExpiresIn);

        // Create new session
        await this.adminSessionRepository.createSession({
          sessionId: newRefreshToken,
          adminUsername: session.adminUsername,
          expiresAt: refreshExpiresAt,
          ip,
          userAgent,
        });

        // Revoke old session
        await this.adminSessionRepository.revokeSession(refreshToken);
      }

      this.logger.log('Admin token refresh successful');

      return {
        response: {
          success: true,
          accessToken,
          expiresAt: accessExpiresAt,
          ...(newRefreshToken && { refreshToken: newRefreshToken }),
        },
        newRefreshToken,
      };
    } catch (error) {
      this.logger.error(`Admin token refresh failed: ${error.message}`, error);
      
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      
      throw new HttpException(
        'Token refresh failed',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async logout(refreshToken: string): Promise<boolean> {
    try {
      this.logger.log('Admin logout attempt');
      
      const success = await this.adminSessionRepository.revokeSession(refreshToken);
      
      if (success) {
        this.logger.log('Admin logout successful');
      } else {
        this.logger.warn('Admin logout failed - session not found');
      }
      
      return success;
    } catch (error) {
      this.logger.error(`Admin logout failed: ${error.message}`, error);
      return false;
    }
  }

  async validateAccessToken(token: string): Promise<AdminJwtPayload> {
    try {
      const payload = await this.jwtService.verifyAsync(token, {
        secret: this.jwtSecret,
      });

      // Verify session is still valid
      const session = await this.adminSessionRepository.getSession(payload.sessionId);
      if (!session) {
        throw new UnauthorizedException('Session expired');
      }

      return payload;
    } catch (error) {
      this.logger.warn(`Admin token validation failed: ${error.message}`);
      throw new UnauthorizedException('Invalid or expired token');
    }
  }

  private async generateAccessToken(username: string, sessionId: string): Promise<string> {
    const payload: Omit<AdminJwtPayload, 'iat' | 'exp'> = {
      sub: username,
      role: 'admin',
      sessionId,
    };

    return this.jwtService.signAsync(payload, {
      secret: this.jwtSecret,
      expiresIn: this.accessExpiresIn,
    });
  }

  private calculateExpirationTime(expiresIn: string): string {
    // Parse expiration string (e.g., "900s", "15m", "7d")
    const match = expiresIn.match(/^(\d+)([smhd])$/);
    if (!match) {
      throw new Error(`Invalid expiration format: ${expiresIn}`);
    }

    const [, value, unit] = match;
    const numValue = parseInt(value, 10);

    let milliseconds: number;
    switch (unit) {
      case 's':
        milliseconds = numValue * 1000;
        break;
      case 'm':
        milliseconds = numValue * 60 * 1000;
        break;
      case 'h':
        milliseconds = numValue * 60 * 60 * 1000;
        break;
      case 'd':
        milliseconds = numValue * 24 * 60 * 60 * 1000;
        break;
      default:
        throw new Error(`Unsupported time unit: ${unit}`);
    }

    return new Date(Date.now() + milliseconds).toISOString();
  }

  async logoutAllSessions(): Promise<boolean> {
    try {
      this.logger.log('Revoking all admin sessions');
      return await this.adminSessionRepository.revokeAllSessionsForAdmin(this.adminUsername);
    } catch (error) {
      this.logger.error(`Failed to revoke all sessions: ${error.message}`, error);
      return false;
    }
  }
}
