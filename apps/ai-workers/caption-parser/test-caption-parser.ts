#!/usr/bin/env node

/**
 * Standalone test script for Caption Parser
 * Tests the LLM service with OpenRouter Microsoft Phi Mini 3.5 128k model
 * Run this before deploying to test caption parsing capabilities
 */

import 'dotenv/config';
import { LLMService } from './src/services/llm.service';
import { ParsedCaptionData } from './src/types';

// Test captions - realistic short TikTok captions from Uganda
const testCaptions = [
  // Short captions with prices (realistic TikTok style)
  "iPhone 14 Pro 2.5m 📱",
  "Samsung S23 3m UGX 💯",
  "MacBook Air 4.5m",
  "AirPods Pro 450k 🎧",
  "Toyota Camry 2019 65m 🚗",
  "Honda CRV 85m",
  "Fresh mangoes 8k/kg 🥭",
  "Matooke 15k bunch 🍌",

  // Short captions mentioning products but NO price (very common)
  "New iPhone available 📱✨",
  "Samsung Galaxy in stock",
  "MacBook for sale 💻",
  "AirPods original �",
  "Toyota Camry clean 🚗",
  "Honda CRV automatic",
  "Fresh mangoes 🥭",
  "Matooke from garden 🍌",
  "Designer dress size M 👗",
  "Men's suits available",
  "Ladies shoes heels 👠",
  "Jeans for men",
  "3 bedroom house Kampala 🏠",
  "Apartment Ntinda",
  "Plot for sale",
  "Studio apartment",

  // Very short captions (1-3 words)
  "iPhone 📱",
  "Samsung",
  "MacBook 💻",
  "Toyota 🚗",
  "Mangoes 🥭",
  "Dress 👗",
  "Shoes 👠",
  "House 🏠",

  // Captions with emojis only or minimal text
  "📱✨",
  "🚗💨",
  "👗💃",
  "🏠🔑",
  "Available",
  "For sale",
  "In stock",
  "DM me",

  // Captions with hashtags but no clear product
  "#fashion #style #kampala",
  "#cars #uganda #deals",
  "#electronics #tech",
  "#food #fresh #organic",

  // Lifestyle/promotional captions (no clear product)
  "Check this out! 🔥",
  "Amazing deal today",
  "Call me now �",
  "DM for details",
  "Serious buyers only",
  "Quality guaranteed 💯",
  "Fast delivery 🚚",
  "Best prices in town",

  // Mixed/unclear captions
  "Many items available",
  "Different sizes colors",
  "Wholesale retail",
  "Import quality",

  // Edge cases - no product at all
  "Good morning Uganda 🌅",
  "Dancing today �",
  "Beautiful sunset 🌇",
  "Happy Friday! 🎉",
  "Love this song 🎵",
  "Kampala vibes ✨",

  // Captions with sizes but no price
  "iPhone 14 Pro 256GB",
  "Samsung S23 512GB",
  "Dress size M L XL",
  "Shoes size 37-41",
  "Jeans 30-36 waist",
  "Toyota 2019 model",
  "House 3 bedrooms",
  "Apartment 2 bedrooms"
];

// Color codes for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

class CaptionParserTester {
  private llmService: LLMService;
  private results: Array<{
    caption: string;
    result: ParsedCaptionData | null;
    error?: string;
    processingTime: number;
  }> = [];

  constructor() {
    // Initialize LLM service with OpenRouter
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      throw new Error('OPENROUTER_API_KEY environment variable is required');
    }

    this.llmService = new LLMService(
      'openrouter',
      'meta-llama/llama-3.2-3b-instruct:free', // Free model from OpenRouter
      apiKey
    );
  }

  async runTests(): Promise<void> {
    console.log(`${colors.cyan}${colors.bright}🧪 Caption Parser Test Suite${colors.reset}`);
    console.log(`${colors.blue}Model: meta-llama/llama-3.2-3b-instruct:free${colors.reset}`);
    console.log(`${colors.blue}Provider: OpenRouter (Free Tier)${colors.reset}`);
    console.log(`${colors.blue}Test Captions: ${testCaptions.length}${colors.reset}\n`);

    let successCount = 0;
    let errorCount = 0;

    for (let i = 0; i < testCaptions.length; i++) {
      const caption = testCaptions[i];
      console.log(`${colors.yellow}[${i + 1}/${testCaptions.length}] Testing caption:${colors.reset}`);
      console.log(`"${caption.substring(0, 80)}${caption.length > 80 ? '...' : ''}"\n`);

      const startTime = Date.now();
      
      try {
        const result = await this.llmService.parseCaptionWithLLM(caption);
        const processingTime = Date.now() - startTime;
        
        this.results.push({
          caption,
          result,
          processingTime
        });

        console.log(`${colors.green}✅ Success (${processingTime}ms)${colors.reset}`);
        this.printResult(result);
        successCount++;
        
      } catch (error) {
        const processingTime = Date.now() - startTime;
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        
        this.results.push({
          caption,
          result: null,
          error: errorMessage,
          processingTime
        });

        console.log(`${colors.red}❌ Error (${processingTime}ms): ${errorMessage}${colors.reset}`);
        errorCount++;
      }

      console.log(`${colors.blue}${'─'.repeat(80)}${colors.reset}\n`);

      // Add delay to avoid rate limiting (free tier has stricter limits)
      await this.sleep(2000); // Increased to 2 seconds for free tier
    }

    this.printSummary(successCount, errorCount);
  }

  private printResult(result: ParsedCaptionData): void {
    console.log(`${colors.magenta}📊 Parsed Result:${colors.reset}`);
    console.log(`  Title: ${colors.bright}${result.title}${colors.reset}`);
    console.log(`  Price: ${colors.bright}${result.price ? `${result.price.toLocaleString()} UGX` : 'null'}${colors.reset}`);
    console.log(`  Sizes: ${colors.bright}${result.sizes || 'null'}${colors.reset}`);
    console.log(`  Tags: ${colors.bright}[${result.tags.join(', ')}]${colors.reset}`);
    console.log(`  Confidence: ${colors.bright}${result.confidence_score}${colors.reset}`);
  }

  private printSummary(successCount: number, errorCount: number): void {
    const totalTests = testCaptions.length;
    const successRate = ((successCount / totalTests) * 100).toFixed(1);

    console.log(`${colors.cyan}${colors.bright}📈 Test Summary${colors.reset}`);
    console.log(`${colors.blue}${'═'.repeat(50)}${colors.reset}`);
    console.log(`Total Tests: ${colors.bright}${totalTests}${colors.reset}`);
    console.log(`Successful: ${colors.green}${successCount}${colors.reset}`);
    console.log(`Failed: ${colors.red}${errorCount}${colors.reset}`);
    console.log(`Success Rate: ${colors.bright}${successRate}%${colors.reset}`);

    // Calculate average processing time
    const avgTime = this.results
      .filter(r => r.result !== null)
      .reduce((sum, r) => sum + r.processingTime, 0) / successCount;

    console.log(`Avg Processing Time: ${colors.bright}${avgTime.toFixed(0)}ms${colors.reset}`);

    // Analyze parsing results
    this.printParsingAnalysis();

    // Show category breakdown
    this.printCategoryBreakdown();
  }

  private printParsingAnalysis(): void {
    const successfulResults = this.results.filter(r => r.result !== null);

    // Count results with prices vs without prices
    const withPrice = successfulResults.filter(r => r.result!.price !== null).length;
    const withoutPrice = successfulResults.filter(r => r.result!.price === null).length;

    // Count results with titles vs without
    const withTitle = successfulResults.filter(r => r.result!.title && r.result!.title.trim() !== '').length;
    const withoutTitle = successfulResults.filter(r => !r.result!.title || r.result!.title.trim() === '').length;

    // Count results with sizes
    const withSizes = successfulResults.filter(r => r.result!.sizes && r.result!.sizes.trim() !== '').length;

    // Count results with tags
    const withTags = successfulResults.filter(r => r.result!.tags && r.result!.tags.length > 0).length;

    console.log(`\n${colors.magenta}🔍 Parsing Analysis:${colors.reset}`);
    console.log(`  Captions with Price: ${colors.bright}${withPrice}${colors.reset} / ${successfulResults.length}`);
    console.log(`  Captions without Price: ${colors.bright}${withoutPrice}${colors.reset} / ${successfulResults.length}`);
    console.log(`  Captions with Title: ${colors.bright}${withTitle}${colors.reset} / ${successfulResults.length}`);
    console.log(`  Captions without Title: ${colors.bright}${withoutTitle}${colors.reset} / ${successfulResults.length}`);
    console.log(`  Captions with Sizes: ${colors.bright}${withSizes}${colors.reset} / ${successfulResults.length}`);
    console.log(`  Captions with Tags: ${colors.bright}${withTags}${colors.reset} / ${successfulResults.length}`);
  }

  private printCategoryBreakdown(): void {
    const categories: Record<string, number> = {};

    this.results
      .filter(r => r.result !== null)
      .forEach(r => {
        r.result!.tags.forEach(tag => {
          categories[tag] = (categories[tag] || 0) + 1;
        });
      });

    console.log(`\n${colors.magenta}📂 Category Breakdown:${colors.reset}`);
    Object.entries(categories)
      .sort(([,a], [,b]) => b - a)
      .forEach(([category, count]) => {
        console.log(`  ${category}: ${colors.bright}${count}${colors.reset}`);
      });
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Main execution
async function main() {
  try {
    const tester = new CaptionParserTester();
    await tester.runTests();
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`${colors.red}${colors.bright}❌ Test suite failed: ${errorMessage}${colors.reset}`);
    process.exit(1);
  }
}

// Run if this file is executed directly
if (require.main === module) {
  main().catch(error => {
    console.error(`${colors.red}Unexpected error:${colors.reset}`, error);
    process.exit(1);
  });
}
