import { validate, ValidationError } from 'class-validator';
import { plainToClass } from 'class-transformer';

export interface IValidationResult {
  isValid: boolean;
  errors: string[];
  data?: any;
}

export class ValidationUtil {
  /**
   * Validate a DTO object using class-validator
   */
  static async validateDto<T extends object>(
    dtoClass: new () => T,
    data: any
  ): Promise<IValidationResult> {
    try {
      const dto = plainToClass(dtoClass, data);
      const errors = await validate(dto);

      if (errors.length > 0) {
        return {
          isValid: false,
          errors: this.formatValidationErrors(errors)
        };
      }

      return {
        isValid: true,
        errors: [],
        data: dto
      };
    } catch (error) {
      return {
        isValid: false,
        errors: [`Validation failed: ${error.message}`]
      };
    }
  }

  /**
   * Validate TikTok URL format
   */
  static validateTikTokUrl(url: string): boolean {
    const tiktokRegex = /^https?:\/\/(www\.)?(tiktok\.com|vm\.tiktok\.com)/;
    return tiktokRegex.test(url);
  }

  /**
   * Validate email format
   */
  static validateEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * Validate phone number format (basic)
   */
  static validatePhoneNumber(phone: string): boolean {
    const phoneRegex = /^\+?[\d\s\-\(\)]{10,}$/;
    return phoneRegex.test(phone);
  }

  /**
   * Validate UUID format
   */
  static validateUUID(uuid: string): boolean {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuidRegex.test(uuid);
  }

  /**
   * Validate price (positive number with max 2 decimal places)
   */
  static validatePrice(price: number): boolean {
    return price >= 0 && Number.isFinite(price) && price.toString().split('.')[1]?.length <= 2;
  }

  /**
   * Validate image URL
   */
  static validateImageUrl(url: string): boolean {
    try {
      const urlObj = new URL(url);
      const validExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
      return validExtensions.some(ext => urlObj.pathname.toLowerCase().endsWith(ext));
    } catch {
      return false;
    }
  }

  /**
   * Sanitize string input
   */
  static sanitizeString(input: string): string {
    return input
      .trim()
      .replace(/[<>]/g, '') // Remove potential HTML tags
      .replace(/\s+/g, ' '); // Normalize whitespace
  }

  /**
   * Validate and sanitize hashtag
   */
  static validateHashtag(hashtag: string): { isValid: boolean; sanitized?: string } {
    const sanitized = hashtag.replace(/[^a-zA-Z0-9_]/g, '').toLowerCase();
    
    if (sanitized.length < 2 || sanitized.length > 30) {
      return { isValid: false };
    }

    return { isValid: true, sanitized };
  }

  /**
   * Format validation errors into readable messages
   */
  private static formatValidationErrors(errors: ValidationError[]): string[] {
    const messages: string[] = [];

    for (const error of errors) {
      if (error.constraints) {
        messages.push(...Object.values(error.constraints));
      }

      if (error.children && error.children.length > 0) {
        messages.push(...this.formatValidationErrors(error.children));
      }
    }

    return messages;
  }

  /**
   * Check if string contains profanity (basic implementation)
   */
  static containsProfanity(text: string): boolean {
    // This is a basic implementation - in production, use a proper profanity filter
    const profanityWords = ['spam', 'scam', 'fake']; // Add more as needed
    const lowerText = text.toLowerCase();
    return profanityWords.some(word => lowerText.includes(word));
  }

  /**
   * Validate file size
   */
  static validateFileSize(sizeInBytes: number, maxSizeInMB: number): boolean {
    const maxSizeInBytes = maxSizeInMB * 1024 * 1024;
    return sizeInBytes <= maxSizeInBytes;
  }

  /**
   * Validate content type
   */
  static validateContentType(contentType: string, allowedTypes: string[]): boolean {
    return allowedTypes.includes(contentType.toLowerCase());
  }
}
