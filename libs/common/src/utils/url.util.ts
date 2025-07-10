export class UrlUtil {
  /**
   * Extract TikTok video ID from URL
   */
  static extractTikTokVideoId(url: string): string | null {
    try {
      const patterns = [
        /tiktok\.com\/@[^/]+\/video\/(\d+)/,
        /vm\.tiktok\.com\/([A-Za-z0-9]+)/,
        /tiktok\.com\/t\/([A-Za-z0-9]+)/
      ];

      for (const pattern of patterns) {
        const match = url.match(pattern);
        if (match) {
          return match[1];
        }
      }

      return null;
    } catch {
      return null;
    }
  }

  /**
   * Extract username from TikTok URL
   */
  static extractTikTokUsername(url: string): string | null {
    try {
      const match = url.match(/tiktok\.com\/@([^/]+)/);
      return match ? match[1] : null;
    } catch {
      return null;
    }
  }

  /**
   * Validate URL format
   */
  static isValidUrl(url: string): boolean {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Validate HTTPS URL
   */
  static isHttpsUrl(url: string): boolean {
    try {
      const urlObj = new URL(url);
      return urlObj.protocol === 'https:';
    } catch {
      return false;
    }
  }

  /**
   * Get domain from URL
   */
  static getDomain(url: string): string | null {
    try {
      const urlObj = new URL(url);
      return urlObj.hostname;
    } catch {
      return null;
    }
  }

  /**
   * Get file extension from URL
   */
  static getFileExtension(url: string): string | null {
    try {
      const urlObj = new URL(url);
      const pathname = urlObj.pathname;
      const lastDot = pathname.lastIndexOf('.');
      
      if (lastDot === -1) {
        return null;
      }

      return pathname.substring(lastDot + 1).toLowerCase();
    } catch {
      return null;
    }
  }

  /**
   * Build query string from object
   */
  static buildQueryString(params: Record<string, any>): string {
    const searchParams = new URLSearchParams();
    
    for (const [key, value] of Object.entries(params)) {
      if (value !== null && value !== undefined) {
        if (Array.isArray(value)) {
          value.forEach(v => searchParams.append(key, String(v)));
        } else {
          searchParams.append(key, String(value));
        }
      }
    }

    return searchParams.toString();
  }

  /**
   * Parse query string to object
   */
  static parseQueryString(queryString: string): Record<string, string | string[]> {
    const params: Record<string, string | string[]> = {};
    const searchParams = new URLSearchParams(queryString);

    for (const [key, value] of searchParams.entries()) {
      if (params[key]) {
        if (Array.isArray(params[key])) {
          (params[key] as string[]).push(value);
        } else {
          params[key] = [params[key] as string, value];
        }
      } else {
        params[key] = value;
      }
    }

    return params;
  }

  /**
   * Add query parameters to URL
   */
  static addQueryParams(url: string, params: Record<string, any>): string {
    try {
      const urlObj = new URL(url);
      const queryString = this.buildQueryString(params);
      
      if (queryString) {
        urlObj.search = urlObj.search ? 
          `${urlObj.search}&${queryString}` : 
          `?${queryString}`;
      }

      return urlObj.toString();
    } catch {
      return url;
    }
  }

  /**
   * Remove query parameters from URL
   */
  static removeQueryParams(url: string, paramsToRemove: string[]): string {
    try {
      const urlObj = new URL(url);
      
      paramsToRemove.forEach(param => {
        urlObj.searchParams.delete(param);
      });

      return urlObj.toString();
    } catch {
      return url;
    }
  }

  /**
   * Normalize URL (remove trailing slash, convert to lowercase domain)
   */
  static normalizeUrl(url: string): string {
    try {
      const urlObj = new URL(url);
      urlObj.hostname = urlObj.hostname.toLowerCase();
      
      // Remove trailing slash unless it's the root path
      if (urlObj.pathname !== '/' && urlObj.pathname.endsWith('/')) {
        urlObj.pathname = urlObj.pathname.slice(0, -1);
      }

      return urlObj.toString();
    } catch {
      return url;
    }
  }

  /**
   * Check if URL is from allowed domain
   */
  static isAllowedDomain(url: string, allowedDomains: string[]): boolean {
    try {
      const domain = this.getDomain(url);
      if (!domain) return false;

      return allowedDomains.some(allowed => 
        domain === allowed || domain.endsWith(`.${allowed}`)
      );
    } catch {
      return false;
    }
  }

  /**
   * Generate signed URL (placeholder - implement with actual signing logic)
   */
  static generateSignedUrl(baseUrl: string, expiresIn: number = 3600): string {
    const expires = Math.floor(Date.now() / 1000) + expiresIn;
    const signature = this.generateSignature(baseUrl, expires);
    
    return this.addQueryParams(baseUrl, {
      expires,
      signature
    });
  }

  /**
   * Generate URL signature (placeholder - implement with actual crypto)
   */
  private static generateSignature(url: string, expires: number): string {
    // This is a placeholder - in production, use proper HMAC signing
    const data = `${url}${expires}`;
    return Buffer.from(data).toString('base64').substring(0, 16);
  }

  /**
   * Shorten URL (placeholder for URL shortening service integration)
   */
  static async shortenUrl(url: string): Promise<string> {
    // This would integrate with a URL shortening service like bit.ly
    // For now, return the original URL
    return url;
  }

  /**
   * Extract all URLs from text
   */
  static extractUrls(text: string): string[] {
    const urlRegex = /https?:\/\/[^\s]+/g;
    return text.match(urlRegex) || [];
  }
}
