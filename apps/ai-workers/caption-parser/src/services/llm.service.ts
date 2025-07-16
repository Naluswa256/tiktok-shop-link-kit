import axios from 'axios';
import { LLMResponse, ParsedCaptionData } from '../types';

// Simple logger implementation to avoid winston dependency issues
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

export class LLMService {
  private logger = new Logger('LLMService');
  private provider: string;
  private apiKey: string | undefined;
  private model: string;
  private baseUrl: string | undefined;

  constructor(
    provider: 'openrouter' | 'ollama' | 'openai',
    model: string,
    apiKey?: string,
    baseUrl?: string
  ) {
    this.provider = provider;
    this.model = model;
    this.apiKey = apiKey;
    this.baseUrl = baseUrl;
  }

  async parseCaptionWithLLM(caption: string): Promise<ParsedCaptionData> {
    const prompt = this.buildPrompt(caption);
    
    try {
      let response: LLMResponse;
      
      switch (this.provider) {
        case 'openrouter':
          response = await this.callOpenRouter(prompt);
          break;
        case 'ollama':
          response = await this.callOllama(prompt);
          break;
        case 'openai':
          response = await this.callOpenAI(prompt);
          break;
        default:
          throw new Error(`Unsupported LLM provider: ${this.provider}`);
      }

      return this.processLLMResponse(response);
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error('LLM parsing failed, falling back to regex', { error: errorMessage, caption });
      return this.fallbackRegexParsing(caption);
    }
  }

  private buildPrompt(caption: string): string {
    return `
You are an AI assistant that extracts product information from TikTok captions for e-commerce in Uganda.

Extract the following information from this TikTok caption:
- title: A concise product name (2-5 words describing what is being sold)
- price: Numeric price in UGX (Ugandan Shillings), return null if not found
- sizes: Size/variant information if applicable (clothing sizes, phone storage, car model year, etc.), return null if not applicable
- tags: Array of relevant product category tags (2-4 tags max), return empty array if unclear

Caption: "${caption}"

This could be ANY type of product: electronics, vehicles, real estate, clothing, food, services, etc.

Respond ONLY with valid JSON in this exact format:
{
  "title": "Product Name",
  "price": 55000,
  "sizes": "Size/Variant Info",
  "tags": ["category1", "category2"]
}

Rules:
- If price contains "k", multiply by 1000 (e.g., "55k" = 55000, "2.5k" = 2500)
- If price contains "m", multiply by 1000000 (e.g., "1.2m" = 1200000)
- Extract the main product being sold, ignore promotional words like "new", "hot", "deal"
- For sizes: include any variant info (clothing sizes, phone storage, car year, house bedrooms, etc.)
- For tags: focus on product category (electronics, clothing, vehicles, real-estate, food, etc.)
- Use null for missing information, empty array [] for tags if unclear
- No explanations, just JSON

Examples:
- "New iPhone 14 Pro 256GB only 2.5m UGX" → {"title": "iPhone 14 Pro", "price": 2500000, "sizes": "256GB", "tags": ["electronics", "smartphone"]}
- "Toyota Camry 2018 model 45m negotiable" → {"title": "Toyota Camry", "price": 45000000, "sizes": "2018", "tags": ["vehicles", "sedan"]}
- "3 bedroom house in Kampala 800m" → {"title": "3 Bedroom House", "price": 800000000, "sizes": "3 bedrooms", "tags": ["real-estate", "house"]}
- "Fresh mangoes 5k per kg" → {"title": "Fresh Mangoes", "price": 5000, "sizes": "per kg", "tags": ["food", "fruits"]}
`;
  }

  private async callOpenRouter(prompt: string): Promise<LLMResponse> {
    if (!this.apiKey) {
      throw new Error('OpenRouter API key not provided');
    }

    const response = await axios.post(
      'https://openrouter.ai/api/v1/chat/completions',
      {
        model: this.model, // e.g., 'microsoft/phi-3-mini-4k-instruct'
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.1,
        max_tokens: 200
      },
      {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://tiktok-commerce.com',
          'X-Title': 'TikTok Commerce Caption Parser'
        },
        timeout: 30000
      }
    );

    const content = response.data.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No response from OpenRouter');
    }

    return JSON.parse(content);
  }

  private async callOllama(prompt: string): Promise<LLMResponse> {
    const baseUrl = this.baseUrl || 'http://localhost:11434';
    
    const response = await axios.post(
      `${baseUrl}/api/generate`,
      {
        model: this.model, // e.g., 'phi3:mini'
        prompt,
        stream: false,
        options: {
          temperature: 0.1,
          num_predict: 200
        }
      },
      {
        timeout: 30000
      }
    );

    const content = response.data.response;
    if (!content) {
      throw new Error('No response from Ollama');
    }

    // Extract JSON from response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON found in Ollama response');
    }

    return JSON.parse(jsonMatch[0]);
  }

  private async callOpenAI(prompt: string): Promise<LLMResponse> {
    if (!this.apiKey) {
      throw new Error('OpenAI API key not provided');
    }

    const response = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      {
        model: this.model, // e.g., 'gpt-3.5-turbo'
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.1,
        max_tokens: 200
      },
      {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        timeout: 30000
      }
    );

    const content = response.data.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No response from OpenAI');
    }

    return JSON.parse(content);
  }

  private processLLMResponse(response: LLMResponse): ParsedCaptionData {
    // Normalize price
    let price: number | null = null;
    if (response.price !== null && response.price !== undefined) {
      if (typeof response.price === 'string') {
        // Handle "55k", "2.5m" formats
        const priceStr = response.price.toLowerCase().replace(/[^\d.km]/g, '');
        if (priceStr.includes('m')) {
          price = parseFloat(priceStr.replace('m', '')) * 1000000;
        } else if (priceStr.includes('k')) {
          price = parseFloat(priceStr.replace('k', '')) * 1000;
        } else {
          price = parseFloat(priceStr);
        }
      } else {
        price = Number(response.price);
      }

      // Validate price
      if (isNaN(price) || price <= 0) {
        price = null;
      }
    }

    // Normalize tags
    const tags = Array.isArray(response.tags) 
      ? response.tags.map(tag => String(tag).toLowerCase().trim()).filter(Boolean)
      : [];

    return {
      title: String(response.title || '').trim(),
      price,
      sizes: response.sizes ? String(response.sizes).trim() : null,
      tags,
      confidence_score: 0.8 // LLM responses get high confidence
    };
  }

  private fallbackRegexParsing(caption: string): ParsedCaptionData {
    this.logger.info('Using fallback regex parsing');

    // Extract price using regex - handle k, m, and UGX formats
    let price: number | null = null;
    const pricePatterns = [
      /(\d+(?:\.\d+)?)\s*m\b/i,  // "2.5m" format
      /(\d+(?:\.\d+)?)\s*k\b/i,  // "55k" format
      /(\d+(?:,\d{3})*)\s*(?:ugx|shillings?)\b/i,  // "55,000 UGX" format
      /(\d+(?:,\d{3})*)\s*(?:only|price|cost)/i    // "55,000 only" format
    ];

    for (const pattern of pricePatterns) {
      const match = caption.match(pattern);
      if (match) {
        const numStr = match[1].replace(/,/g, '');
        const num = parseFloat(numStr);

        if (pattern.source.includes('m\\b')) {
          price = num * 1000000; // millions
        } else if (pattern.source.includes('k\\b')) {
          price = num * 1000; // thousands
        } else {
          price = num; // direct number
        }
        break;
      }
    }

    // Extract sizes/variants using flexible regex
    let sizes: string | null = null;
    const sizePatterns = [
      /sizes?\s*:?\s*([^,\n.!?]+)/i,  // "sizes: 37-41" or "size: Large"
      /(\d+(?:\s*[-–—]\s*\d+)?)\s*(?:size|inch|gb|tb|bedroom|year)/i,  // "256GB", "3 bedroom", "2018 year"
      /model\s+(\d{4})/i,  // "model 2018"
      /(\d+)\s*(?:bedroom|room)/i,  // "3 bedroom"
    ];

    for (const pattern of sizePatterns) {
      const match = caption.match(pattern);
      if (match) {
        sizes = match[1].trim();
        break;
      }
    }

    // Extract basic tags from hashtags and common product keywords
    const tags: string[] = [];

    // Get hashtags (excluding #TRACK)
    const hashtagMatches = caption.match(/#(\w+)/g);
    if (hashtagMatches) {
      hashtagMatches.forEach(tag => {
        const cleanTag = tag.replace('#', '').toLowerCase();
        if (cleanTag !== 'track' && cleanTag.length > 2) {
          tags.push(cleanTag);
        }
      });
    }

    // Add category tags based on keywords
    const categoryKeywords = {
      'electronics': ['phone', 'iphone', 'samsung', 'laptop', 'computer', 'tv', 'camera', 'headphones'],
      'vehicles': ['car', 'toyota', 'honda', 'nissan', 'mercedes', 'bmw', 'truck', 'motorcycle'],
      'real-estate': ['house', 'apartment', 'land', 'plot', 'bedroom', 'rental', 'property'],
      'clothing': ['shirt', 'dress', 'jeans', 'shoes', 'heels', 'sneakers', 'jacket', 'suit'],
      'food': ['food', 'rice', 'beans', 'meat', 'fish', 'fruits', 'vegetables', 'restaurant'],
      'furniture': ['chair', 'table', 'bed', 'sofa', 'cabinet', 'furniture', 'mattress'],
      'beauty': ['makeup', 'cosmetics', 'perfume', 'skincare', 'hair', 'beauty']
    };

    const captionLower = caption.toLowerCase();
    for (const [category, keywords] of Object.entries(categoryKeywords)) {
      if (keywords.some(keyword => captionLower.includes(keyword))) {
        if (!tags.includes(category)) {
          tags.push(category);
        }
        break; // Only add one main category
      }
    }

    // Generate a simple title by extracting meaningful words
    let title = 'Product';
    const words = caption.split(/\s+/).filter(word => {
      const cleanWord = word.replace(/[^\w]/g, '').toLowerCase();
      return cleanWord.length > 2 &&
             !cleanWord.startsWith('#') &&
             !cleanWord.startsWith('@') &&
             !/^\d+[km]?$/.test(cleanWord) &&
             !['only', 'new', 'available', 'sizes', 'price', 'ugx', 'shillings', 'call', 'contact', 'dm'].includes(cleanWord);
    });

    if (words.length > 0) {
      // Take first 2-3 meaningful words
      title = words.slice(0, Math.min(3, words.length)).join(' ');
      // Clean up title
      title = title.replace(/[^\w\s]/g, '').trim();
    }

    return {
      title,
      price,
      sizes,
      tags: tags.slice(0, 4), // Limit to 4 tags
      confidence_score: 0.3 // Lower confidence for regex parsing
    };
  }
}
