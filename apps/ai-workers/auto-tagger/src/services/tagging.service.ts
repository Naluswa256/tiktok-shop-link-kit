import axios from 'axios';
import { createLogger, format, transports } from 'winston';
import { SemanticAnalysisResult, TaggingConfig } from '../types';

class Logger {
  private logger;

  constructor(private context: string) {
    this.logger = createLogger({
      level: process.env.LOG_LEVEL || 'info',
      format: format.combine(
        format.timestamp(),
        format.errors({ stack: true }),
        format.json()
      ),
      transports: [
        new transports.Console({
          format: format.combine(
            format.colorize(),
            format.simple()
          )
        })
      ]
    });
  }

  info(message: string, meta?: Record<string, unknown>) {
    this.logger.info(`[${this.context}] ${message}`, meta);
  }

  error(message: string, meta?: Record<string, unknown>) {
    this.logger.error(`[${this.context}] ${message}`, meta);
  }

  warn(message: string, meta?: Record<string, unknown>) {
    this.logger.warn(`[${this.context}] ${message}`, meta);
  }

  debug(message: string, meta?: Record<string, unknown>) {
    this.logger.debug(`[${this.context}] ${message}`, meta);
  }
}

export class TaggingService {
  private logger = new Logger('TaggingService');
  private provider: string;
  private apiKey?: string;
  private model: string;
  private baseUrl?: string;
  private config: TaggingConfig;

  // Predefined category mappings for e-commerce
  private categoryMappings = {
    'fashion': ['clothing', 'apparel', 'fashion', 'style', 'outfit', 'wear'],
    'footwear': ['shoes', 'heels', 'sneakers', 'boots', 'sandals', 'footwear'],
    'accessories': ['bag', 'handbag', 'jewelry', 'watch', 'belt', 'hat', 'sunglasses'],
    'electronics': ['phone', 'laptop', 'headphones', 'camera', 'gadget', 'tech'],
    'beauty': ['makeup', 'skincare', 'cosmetics', 'beauty', 'lipstick', 'foundation'],
    'home': ['furniture', 'decor', 'kitchen', 'bedroom', 'living room', 'home'],
    'sports': ['fitness', 'gym', 'sports', 'exercise', 'workout', 'athletic'],
    'food': ['food', 'snack', 'drink', 'beverage', 'cooking', 'recipe']
  };

  constructor(
    provider: 'openrouter' | 'ollama' | 'openai',
    model: string,
    config: TaggingConfig,
    apiKey?: string,
    baseUrl?: string
  ) {
    this.provider = provider;
    this.model = model;
    this.config = config;
    this.apiKey = apiKey;
    this.baseUrl = baseUrl;
  }

  async generateSemanticTags(
    caption: string,
    existingTags: string[] = [],
    thumbnailUrl?: string
  ): Promise<SemanticAnalysisResult> {
    try {
      this.logger.info('Generating semantic tags', {
        captionLength: caption.length,
        existingTagsCount: existingTags.length,
        hasThumbnail: !!thumbnailUrl
      });

      // Generate tags using LLM
      const llmResult = await this.generateTagsWithLLM(caption, existingTags, thumbnailUrl);
      
      // Apply category mapping
      const categoryTags = this.applyCategoryMapping(llmResult.semantic_tags);
      
      // Filter and score tags
      const filteredTags = this.filterAndScoreTags(llmResult.semantic_tags, existingTags);
      
      // Combine results
      const result: SemanticAnalysisResult = {
        semantic_tags: filteredTags.tags,
        category_tags: categoryTags,
        confidence_scores: {
          ...llmResult.confidence_scores,
          ...filteredTags.scores
        },
        reasoning: llmResult.reasoning
      };

      this.logger.info('Semantic tags generated', {
        semanticTagsCount: result.semantic_tags.length,
        categoryTagsCount: result.category_tags.length,
        avgConfidence: this.calculateAverageConfidence(result.confidence_scores)
      });

      return result;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error('Semantic tag generation failed', { error: errorMessage });
      
      // Fallback to rule-based tagging
      return this.fallbackTagging(caption, existingTags);
    }
  }

  private async generateTagsWithLLM(
    caption: string,
    existingTags: string[],
    thumbnailUrl?: string
  ): Promise<any> {
    const prompt = this.buildTaggingPrompt(caption, existingTags, thumbnailUrl);
    
    switch (this.provider) {
      case 'openrouter':
        return this.callOpenRouter(prompt);
      case 'ollama':
        return this.callOllama(prompt);
      case 'openai':
        return this.callOpenAI(prompt);
      default:
        throw new Error(`Unsupported LLM provider: ${this.provider}`);
    }
  }

  private buildTaggingPrompt(caption: string, existingTags: string[], thumbnailUrl?: string): string {
    return `
You are an AI assistant that generates semantic tags for e-commerce products from TikTok content.

Generate additional semantic tags that would help customers discover this product.

Caption: "${caption}"
Existing tags: [${existingTags.join(', ')}]
${thumbnailUrl ? `Thumbnail available: ${thumbnailUrl}` : 'No thumbnail available'}

Generate tags in these categories:
1. Semantic tags: Descriptive words that capture the essence, style, or use case
2. Category tags: Broad product categories
3. Attribute tags: Specific features, colors, materials, or characteristics

Rules:
- Generate 5-10 additional tags that are NOT in the existing tags
- Focus on tags that customers would search for
- Include style descriptors (e.g., "casual", "elegant", "trendy")
- Include use cases (e.g., "everyday", "party", "work")
- Include target audience (e.g., "women", "men", "unisex")
- Avoid duplicate or very similar tags
- Use lowercase, single words or short phrases
- Assign confidence scores (0.0-1.0) for each tag

Respond ONLY with valid JSON in this format:
{
  "semantic_tags": ["tag1", "tag2", "tag3"],
  "confidence_scores": {
    "tag1": 0.9,
    "tag2": 0.8,
    "tag3": 0.7
  },
  "reasoning": "Brief explanation of tag selection"
}
`;
  }

  private async callOpenRouter(prompt: string): Promise<string> {
    if (!this.apiKey) {
      throw new Error('OpenRouter API key not provided');
    }

    const response = await axios.post(
      'https://openrouter.ai/api/v1/chat/completions',
      {
        model: this.model,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
        max_tokens: 300
      },
      {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://tiktok-commerce.com',
          'X-Title': 'TikTok Commerce Auto Tagger'
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

  private async callOllama(prompt: string): Promise<string> {
    const baseUrl = this.baseUrl || 'http://localhost:11434';
    
    const response = await axios.post(
      `${baseUrl}/api/generate`,
      {
        model: this.model,
        prompt,
        stream: false,
        options: {
          temperature: 0.3,
          num_predict: 300
        }
      },
      { timeout: 30000 }
    );

    const content = response.data.response;
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON found in Ollama response');
    }

    return JSON.parse(jsonMatch[0]);
  }

  private async callOpenAI(prompt: string): Promise<string> {
    if (!this.apiKey) {
      throw new Error('OpenAI API key not provided');
    }

    const response = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      {
        model: this.model,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
        max_tokens: 300
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

  private applyCategoryMapping(tags: string[]): string[] {
    const categories = new Set<string>();
    
    for (const tag of tags) {
      for (const [category, keywords] of Object.entries(this.categoryMappings)) {
        if (keywords.some(keyword => 
          tag.toLowerCase().includes(keyword) || keyword.includes(tag.toLowerCase())
        )) {
          categories.add(category);
        }
      }
    }
    
    return Array.from(categories);
  }

  private filterAndScoreTags(tags: string[], existingTags: string[]): { tags: string[], scores: Record<string, number> } {
    const existingLower = existingTags.map(t => t.toLowerCase());
    const filtered: string[] = [];
    const scores: Record<string, number> = {};
    
    for (const tag of tags) {
      const tagLower = tag.toLowerCase();
      
      // Skip if already exists or too similar
      if (existingLower.includes(tagLower)) continue;
      if (existingLower.some(existing => 
        this.calculateSimilarity(existing, tagLower) > 0.8
      )) continue;
      
      // Skip if too short or generic
      if (tag.length < 3) continue;
      if (['new', 'good', 'nice', 'best', 'great'].includes(tagLower)) continue;
      
      filtered.push(tag);
      scores[tag] = 0.7 + Math.random() * 0.3; // Base score with some variation
    }
    
    // Limit to max tags
    const limitedTags = filtered.slice(0, this.config.maxTags);
    const limitedScores: Record<string, number> = {};
    
    for (const tag of limitedTags) {
      limitedScores[tag] = scores[tag];
    }
    
    return { tags: limitedTags, scores: limitedScores };
  }

  private calculateSimilarity(str1: string, str2: string): number {
    // Simple Jaccard similarity for tag comparison
    const set1 = new Set(str1.split(''));
    const set2 = new Set(str2.split(''));
    const intersection = new Set([...set1].filter(x => set2.has(x)));
    const union = new Set([...set1, ...set2]);
    
    return intersection.size / union.size;
  }

  private calculateAverageConfidence(scores: Record<string, number>): number {
    const values = Object.values(scores);
    return values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0;
  }

  private fallbackTagging(caption: string, existingTags: string[]): SemanticAnalysisResult {
    this.logger.info('Using fallback rule-based tagging');
    
    const words = caption.toLowerCase().split(/\s+/);
    const semanticTags: string[] = [];
    const scores: Record<string, number> = {};
    
    // Extract potential tags from caption
    const potentialTags = words.filter(word => 
      word.length > 3 && 
      !word.startsWith('#') && 
      !word.startsWith('@') &&
      !/^\d+/.test(word) &&
      !existingTags.includes(word)
    );
    
    // Add some common semantic tags based on keywords
    const semanticKeywords = {
      'trendy': ['new', 'latest', 'trend', 'hot'],
      'affordable': ['cheap', 'budget', 'deal', 'sale'],
      'premium': ['luxury', 'premium', 'high-quality', 'expensive'],
      'casual': ['everyday', 'casual', 'comfortable', 'relaxed'],
      'formal': ['formal', 'elegant', 'classy', 'sophisticated']
    };
    
    for (const [tag, keywords] of Object.entries(semanticKeywords)) {
      if (keywords.some(keyword => caption.toLowerCase().includes(keyword))) {
        semanticTags.push(tag);
        scores[tag] = 0.6;
      }
    }
    
    // Add category tags
    const categoryTags = this.applyCategoryMapping([...existingTags, ...potentialTags]);
    
    return {
      semantic_tags: semanticTags.slice(0, 5),
      category_tags: categoryTags,
      confidence_scores: scores,
      reasoning: 'Generated using rule-based fallback method'
    };
  }
}
