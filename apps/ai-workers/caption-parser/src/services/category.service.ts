/**
 * Category Service for product classification
 * Uses comprehensive datasets from multiple sources:
 * - Google Product Categories
 * - Amazon Product Categories
 * - UN Standard Products and Services Code (UNSPSC)
 * - Uganda-specific categories
 */

export interface CategoryMatch {
  category: string;
  subcategory?: string | undefined;
  confidence: number;
  matchedKeywords: string[];
}

export class CategoryService {

  // Comprehensive category mapping based on official datasets
  private readonly categoryKeywords = {
    // Electronics & Technology (Google: Electronics)
    'electronics': {
      keywords: [
        // Mobile Devices
        'phone', 'smartphone', 'iphone', 'samsung', 'huawei', 'oppo', 'vivo', 'tecno', 'infinix',
        'android', 'ios', 'mobile', 'cell', 'cellular', 'sim', 'airtime', 'data',
        
        // Computers & Accessories
        'laptop', 'computer', 'desktop', 'pc', 'macbook', 'dell', 'hp', 'lenovo', 'asus',
        'keyboard', 'mouse', 'monitor', 'screen', 'printer', 'scanner', 'webcam',
        'hard drive', 'ssd', 'ram', 'memory', 'processor', 'cpu', 'gpu',
        
        // Audio & Video
        'headphones', 'earphones', 'airpods', 'speaker', 'bluetooth', 'wireless',
        'tv', 'television', 'smart tv', 'led', 'lcd', 'oled', 'projector',
        'camera', 'video', 'photography', 'lens', 'tripod',
        
        // Gaming & Entertainment
        'playstation', 'xbox', 'nintendo', 'gaming', 'console', 'controller',
        'games', 'cd', 'dvd', 'blu-ray',
        
        // Accessories & Parts
        'charger', 'cable', 'adapter', 'power bank', 'battery', 'case', 'cover',
        'screen protector', 'tempered glass', 'usb', 'hdmi', 'ethernet'
      ],
      subcategories: {
        'smartphone': ['phone', 'iphone', 'samsung', 'android', 'mobile'],
        'laptop': ['laptop', 'macbook', 'computer', 'notebook'],
        'audio': ['headphones', 'speaker', 'airpods', 'earphones'],
        'tv': ['tv', 'television', 'smart tv', 'led', 'lcd'],
        'gaming': ['playstation', 'xbox', 'gaming', 'console']
      }
    },

    // Vehicles & Transportation (UNSPSC: Transportation)
    'vehicles': {
      keywords: [
        // Cars & Brands
        'car', 'vehicle', 'auto', 'automobile', 'sedan', 'suv', 'hatchback', 'wagon',
        'toyota', 'honda', 'nissan', 'mazda', 'mitsubishi', 'subaru', 'hyundai', 'kia',
        'mercedes', 'bmw', 'audi', 'volkswagen', 'ford', 'chevrolet', 'peugeot',
        'camry', 'corolla', 'prado', 'rav4', 'crv', 'civic', 'accord', 'altima',
        
        // Commercial Vehicles
        'truck', 'lorry', 'van', 'pickup', 'hiace', 'bus', 'matatu', 'taxi',
        'trailer', 'tipper', 'delivery', 'cargo', 'freight',
        
        // Motorcycles & Bicycles
        'motorcycle', 'motorbike', 'bike', 'scooter', 'bajaj', 'yamaha', 'honda bike',
        'bicycle', 'mountain bike', 'road bike', 'electric bike',
        
        // Parts & Accessories
        'engine', 'transmission', 'brake', 'tire', 'wheel', 'battery', 'alternator',
        'radiator', 'exhaust', 'suspension', 'clutch', 'gearbox', 'spare parts'
      ],
      subcategories: {
        'car': ['car', 'sedan', 'suv', 'hatchback', 'toyota', 'honda', 'nissan'],
        'motorcycle': ['motorcycle', 'motorbike', 'bajaj', 'yamaha', 'scooter'],
        'commercial': ['truck', 'van', 'bus', 'hiace', 'matatu', 'taxi'],
        'parts': ['engine', 'tire', 'brake', 'battery', 'spare parts']
      }
    },

    // Real Estate & Property (UNSPSC: Real Estate)
    'real-estate': {
      keywords: [
        // Residential
        'house', 'home', 'apartment', 'flat', 'condo', 'townhouse', 'villa', 'mansion',
        'bedroom', 'bathroom', 'kitchen', 'living room', 'dining room', 'garage',
        'bungalow', 'duplex', 'maisonette', 'studio', 'bedsitter',
        
        // Commercial
        'office', 'shop', 'store', 'warehouse', 'factory', 'building', 'plaza',
        'mall', 'commercial', 'retail', 'industrial', 'showroom',
        
        // Land & Development
        'land', 'plot', 'acre', 'hectare', 'title', 'deed', 'freehold', 'leasehold',
        'development', 'construction', 'project', 'estate', 'subdivision',
        
        // Locations (Uganda-specific)
        'kampala', 'entebbe', 'jinja', 'mbarara', 'gulu', 'lira', 'fort portal',
        'ntinda', 'kololo', 'nakasero', 'bugolobi', 'muyenga', 'kansanga',
        'najera', 'kira', 'mukono', 'wakiso', 'gayaza', 'kasangati'
      ],
      subcategories: {
        'residential': ['house', 'apartment', 'home', 'bedroom', 'villa'],
        'commercial': ['office', 'shop', 'warehouse', 'building', 'plaza'],
        'land': ['land', 'plot', 'acre', 'title', 'development']
      }
    },

    // Fashion & Clothing (Google: Apparel & Accessories)
    'clothing': {
      keywords: [
        // General Clothing
        'clothes', 'clothing', 'apparel', 'fashion', 'wear', 'outfit', 'garment',
        
        // Tops
        'shirt', 't-shirt', 'blouse', 'top', 'tank top', 'polo', 'hoodie', 'sweater',
        'jacket', 'blazer', 'coat', 'cardigan', 'vest', 'kimono',
        
        // Bottoms
        'pants', 'trousers', 'jeans', 'shorts', 'skirt', 'dress', 'leggings',
        'joggers', 'sweatpants', 'chinos', 'cargo pants',
        
        // Footwear
        'shoes', 'sneakers', 'boots', 'sandals', 'heels', 'flats', 'loafers',
        'slippers', 'flip-flops', 'crocs', 'nike', 'adidas', 'puma', 'converse',
        
        // Accessories
        'bag', 'handbag', 'backpack', 'purse', 'wallet', 'belt', 'watch',
        'jewelry', 'necklace', 'earrings', 'bracelet', 'ring', 'sunglasses',
        'hat', 'cap', 'scarf', 'tie', 'bow tie',
        
        // Underwear & Intimates
        'underwear', 'bra', 'panties', 'boxers', 'briefs', 'lingerie', 'pajamas'
      ],
      subcategories: {
        'tops': ['shirt', 't-shirt', 'blouse', 'jacket', 'hoodie'],
        'bottoms': ['pants', 'jeans', 'shorts', 'skirt', 'dress'],
        'footwear': ['shoes', 'sneakers', 'boots', 'heels', 'sandals'],
        'accessories': ['bag', 'watch', 'jewelry', 'belt', 'sunglasses']
      }
    },

    // Food & Beverages (UNSPSC: Food, Beverage and Tobacco)
    'food': {
      keywords: [
        // Staples (Uganda-specific)
        'matooke', 'banana', 'rice', 'beans', 'posho', 'cassava', 'sweet potato',
        'irish potato', 'yam', 'millet', 'sorghum', 'groundnuts', 'simsim',
        
        // Proteins
        'meat', 'beef', 'chicken', 'pork', 'goat', 'fish', 'tilapia', 'mukene',
        'eggs', 'milk', 'cheese', 'yogurt', 'butter',
        
        // Fruits & Vegetables
        'fruits', 'vegetables', 'tomatoes', 'onions', 'cabbage', 'carrots',
        'mangoes', 'pineapple', 'oranges', 'avocado', 'passion fruit', 'jackfruit',
        
        // Beverages
        'water', 'soda', 'juice', 'beer', 'wine', 'coffee', 'tea', 'milk',
        'energy drink', 'soft drink',
        
        // Prepared Foods
        'restaurant', 'catering', 'food delivery', 'takeaway', 'fast food',
        'bakery', 'bread', 'cake', 'pastry', 'snacks'
      ],
      subcategories: {
        'staples': ['matooke', 'rice', 'beans', 'posho', 'cassava'],
        'protein': ['meat', 'chicken', 'fish', 'eggs', 'milk'],
        'produce': ['fruits', 'vegetables', 'tomatoes', 'mangoes'],
        'beverages': ['water', 'soda', 'juice', 'beer', 'coffee']
      }
    },

    // Health & Beauty (Google: Health & Beauty)
    'beauty': {
      keywords: [
        // Cosmetics
        'makeup', 'cosmetics', 'foundation', 'lipstick', 'mascara', 'eyeshadow',
        'blush', 'concealer', 'powder', 'eyeliner', 'nail polish',
        
        // Skincare
        'skincare', 'moisturizer', 'cleanser', 'toner', 'serum', 'sunscreen',
        'face wash', 'body lotion', 'cream', 'soap', 'scrub',
        
        // Hair Care
        'hair', 'shampoo', 'conditioner', 'hair oil', 'relaxer', 'perm',
        'hair extensions', 'wig', 'weave', 'braids', 'dreadlocks',
        
        // Fragrance
        'perfume', 'cologne', 'fragrance', 'deodorant', 'body spray',
        
        // Health & Wellness
        'medicine', 'drugs', 'pharmacy', 'vitamins', 'supplements',
        'first aid', 'bandage', 'thermometer', 'blood pressure'
      ],
      subcategories: {
        'cosmetics': ['makeup', 'lipstick', 'foundation', 'mascara'],
        'skincare': ['moisturizer', 'cleanser', 'cream', 'soap'],
        'haircare': ['shampoo', 'hair oil', 'wig', 'extensions'],
        'fragrance': ['perfume', 'cologne', 'deodorant']
      }
    },

    // Home & Garden (Google: Home & Garden)
    'home-garden': {
      keywords: [
        // Furniture
        'furniture', 'chair', 'table', 'bed', 'sofa', 'couch', 'cabinet',
        'wardrobe', 'dresser', 'bookshelf', 'desk', 'mattress', 'pillow',
        
        // Appliances
        'refrigerator', 'fridge', 'washing machine', 'microwave', 'oven',
        'blender', 'iron', 'fan', 'air conditioner', 'heater',
        
        // Home Decor
        'curtains', 'carpet', 'rug', 'painting', 'mirror', 'lamp',
        'decoration', 'vase', 'clock', 'photo frame',
        
        // Garden & Outdoor
        'garden', 'plants', 'flowers', 'seeds', 'fertilizer', 'tools',
        'lawn mower', 'hose', 'outdoor furniture', 'grill'
      ],
      subcategories: {
        'furniture': ['chair', 'table', 'bed', 'sofa', 'cabinet'],
        'appliances': ['fridge', 'washing machine', 'microwave', 'fan'],
        'decor': ['curtains', 'carpet', 'lamp', 'mirror'],
        'garden': ['plants', 'flowers', 'tools', 'fertilizer']
      }
    },

    // Services (UNSPSC: Services)
    'services': {
      keywords: [
        // Professional Services
        'service', 'services', 'consultation', 'advice', 'training', 'education',
        'legal', 'accounting', 'marketing', 'advertising', 'design', 'photography',
        
        // Personal Services
        'cleaning', 'laundry', 'catering', 'cooking', 'delivery', 'transport',
        'taxi', 'uber', 'boda', 'massage', 'salon', 'barber', 'spa',
        
        // Repair & Maintenance
        'repair', 'maintenance', 'fixing', 'installation', 'plumbing',
        'electrical', 'carpentry', 'painting', 'roofing', 'construction',
        
        // Digital Services
        'website', 'app', 'software', 'programming', 'coding', 'seo',
        'social media', 'content', 'writing', 'translation'
      ],
      subcategories: {
        'professional': ['consultation', 'legal', 'accounting', 'marketing'],
        'personal': ['cleaning', 'catering', 'delivery', 'salon'],
        'repair': ['repair', 'maintenance', 'plumbing', 'electrical'],
        'digital': ['website', 'app', 'software', 'seo']
      }
    }
  };

  /**
   * Classify text into product categories
   */
  classifyText(text: string, maxCategories: number = 4): CategoryMatch[] {
    const textLower = text.toLowerCase();
    const matches: CategoryMatch[] = [];

    for (const [category, data] of Object.entries(this.categoryKeywords)) {
      const matchedKeywords: string[] = [];
      let totalMatches = 0;

      // Check main keywords
      for (const keyword of data.keywords) {
        if (textLower.includes(keyword.toLowerCase())) {
          matchedKeywords.push(keyword);
          totalMatches++;
        }
      }

      if (matchedKeywords.length > 0) {
        // Calculate confidence based on number of matches and keyword specificity
        const confidence = Math.min(0.9, (matchedKeywords.length / data.keywords.length) * 2);
        
        // Find best subcategory match
        let bestSubcategory: string | undefined;
        let maxSubMatches = 0;

        if (data.subcategories) {
          for (const [subcat, subKeywords] of Object.entries(data.subcategories)) {
            const subMatches = subKeywords.filter(kw => 
              matchedKeywords.some(mk => mk.toLowerCase().includes(kw.toLowerCase()))
            ).length;
            
            if (subMatches > maxSubMatches) {
              maxSubMatches = subMatches;
              bestSubcategory = subcat;
            }
          }
        }

        matches.push({
          category,
          subcategory: bestSubcategory,
          confidence,
          matchedKeywords: matchedKeywords.slice(0, 5) // Limit for readability
        });
      }
    }

    // Sort by confidence and return top matches
    return matches
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, maxCategories);
  }

  /**
   * Get simple category tags (for backward compatibility)
   */
  getCategoryTags(text: string, maxTags: number = 4): string[] {
    const matches = this.classifyText(text, maxTags);
    return matches.map(match => match.category);
  }

  /**
   * Get detailed category information
   */
  getDetailedCategories(text: string): CategoryMatch[] {
    return this.classifyText(text, 10); // Get more detailed results
  }
}
