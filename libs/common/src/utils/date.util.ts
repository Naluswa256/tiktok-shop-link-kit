export class DateUtil {
  /**
   * Get current timestamp in ISO format
   */
  static now(): string {
    return new Date().toISOString();
  }

  /**
   * Get current Unix timestamp
   */
  static nowUnix(): number {
    return Math.floor(Date.now() / 1000);
  }

  /**
   * Format date to ISO string
   */
  static toISOString(date: Date | string | number): string {
    return new Date(date).toISOString();
  }

  /**
   * Format date to Unix timestamp
   */
  static toUnix(date: Date | string | number): number {
    return Math.floor(new Date(date).getTime() / 1000);
  }

  /**
   * Add time to date
   */
  static addTime(date: Date | string, amount: number, unit: 'seconds' | 'minutes' | 'hours' | 'days'): Date {
    const baseDate = new Date(date);
    const multipliers = {
      seconds: 1000,
      minutes: 60 * 1000,
      hours: 60 * 60 * 1000,
      days: 24 * 60 * 60 * 1000
    };

    return new Date(baseDate.getTime() + (amount * multipliers[unit]));
  }

  /**
   * Subtract time from date
   */
  static subtractTime(date: Date | string, amount: number, unit: 'seconds' | 'minutes' | 'hours' | 'days'): Date {
    return this.addTime(date, -amount, unit);
  }

  /**
   * Check if date is in the past
   */
  static isPast(date: Date | string): boolean {
    return new Date(date) < new Date();
  }

  /**
   * Check if date is in the future
   */
  static isFuture(date: Date | string): boolean {
    return new Date(date) > new Date();
  }

  /**
   * Get difference between two dates in specified unit
   */
  static diff(date1: Date | string, date2: Date | string, unit: 'seconds' | 'minutes' | 'hours' | 'days'): number {
    const d1 = new Date(date1);
    const d2 = new Date(date2);
    const diffMs = Math.abs(d1.getTime() - d2.getTime());

    const divisors = {
      seconds: 1000,
      minutes: 60 * 1000,
      hours: 60 * 60 * 1000,
      days: 24 * 60 * 60 * 1000
    };

    return Math.floor(diffMs / divisors[unit]);
  }

  /**
   * Format date for display
   */
  static formatForDisplay(date: Date | string, format: 'short' | 'medium' | 'long' = 'medium'): string {
    const d = new Date(date);
    
    switch (format) {
      case 'short':
        return d.toLocaleDateString();
      case 'medium':
        return d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      case 'long':
        return d.toLocaleDateString([], { 
          weekday: 'long', 
          year: 'numeric', 
          month: 'long', 
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        });
      default:
        return d.toISOString();
    }
  }

  /**
   * Get relative time string (e.g., "2 hours ago")
   */
  static getRelativeTime(date: Date | string): string {
    const now = new Date();
    const target = new Date(date);
    const diffMs = now.getTime() - target.getTime();
    const diffSeconds = Math.floor(diffMs / 1000);

    if (diffSeconds < 60) {
      return 'just now';
    }

    const diffMinutes = Math.floor(diffSeconds / 60);
    if (diffMinutes < 60) {
      return `${diffMinutes} minute${diffMinutes === 1 ? '' : 's'} ago`;
    }

    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24) {
      return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`;
    }

    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 30) {
      return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`;
    }

    const diffMonths = Math.floor(diffDays / 30);
    if (diffMonths < 12) {
      return `${diffMonths} month${diffMonths === 1 ? '' : 's'} ago`;
    }

    const diffYears = Math.floor(diffMonths / 12);
    return `${diffYears} year${diffYears === 1 ? '' : 's'} ago`;
  }

  /**
   * Check if date is today
   */
  static isToday(date: Date | string): boolean {
    const today = new Date();
    const target = new Date(date);
    
    return today.getFullYear() === target.getFullYear() &&
           today.getMonth() === target.getMonth() &&
           today.getDate() === target.getDate();
  }

  /**
   * Get start of day
   */
  static startOfDay(date: Date | string): Date {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    return d;
  }

  /**
   * Get end of day
   */
  static endOfDay(date: Date | string): Date {
    const d = new Date(date);
    d.setHours(23, 59, 59, 999);
    return d;
  }

  /**
   * Validate date string
   */
  static isValidDate(date: string): boolean {
    const d = new Date(date);
    return d instanceof Date && !isNaN(d.getTime());
  }

  /**
   * Get timezone offset in hours
   */
  static getTimezoneOffset(): number {
    return -new Date().getTimezoneOffset() / 60;
  }
}
