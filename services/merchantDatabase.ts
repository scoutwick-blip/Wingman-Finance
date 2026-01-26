// Comprehensive merchant database for intelligent categorization
// This provides fuzzy matching and detailed keyword recognition

export interface MerchantPattern {
  keywords: string[];
  category: string;
  confidence: number;
  tags?: string[];
}

// Comprehensive merchant patterns organized by category
export const MERCHANT_PATTERNS: Record<string, MerchantPattern[]> = {
  groceries: [
    { keywords: ['walmart', 'wal-mart', 'wal mart'], category: 'groceries', confidence: 0.95, tags: ['retail', 'supercenter'] },
    { keywords: ['target', 'tgt'], category: 'groceries', confidence: 0.9, tags: ['retail', 'department'] },
    { keywords: ['costco', 'costco wholesale'], category: 'groceries', confidence: 0.95, tags: ['wholesale', 'membership'] },
    { keywords: ['safeway'], category: 'groceries', confidence: 0.95, tags: ['supermarket'] },
    { keywords: ['kroger', 'king soopers', 'ralphs', 'fred meyer', 'frys'], category: 'groceries', confidence: 0.95, tags: ['supermarket'] },
    { keywords: ['albertsons', 'vons', 'jewel', 'acme'], category: 'groceries', confidence: 0.95, tags: ['supermarket'] },
    { keywords: ['whole foods', 'wholefoods', 'wfm'], category: 'groceries', confidence: 0.95, tags: ['organic', 'premium'] },
    { keywords: ['trader joe', 'trader joes', 'traderjoe'], category: 'groceries', confidence: 0.95, tags: ['specialty'] },
    { keywords: ['aldi'], category: 'groceries', confidence: 0.95, tags: ['discount'] },
    { keywords: ['publix'], category: 'groceries', confidence: 0.95, tags: ['supermarket'] },
    { keywords: ['wegmans'], category: 'groceries', confidence: 0.95, tags: ['supermarket'] },
    { keywords: ['heb', 'h-e-b', 'h e b'], category: 'groceries', confidence: 0.95, tags: ['supermarket'] },
    { keywords: ['sprouts', 'sprouts farmers market'], category: 'groceries', confidence: 0.95, tags: ['organic'] },
    { keywords: ['food lion'], category: 'groceries', confidence: 0.95, tags: ['supermarket'] },
    { keywords: ['stop & shop', 'stop and shop'], category: 'groceries', confidence: 0.95, tags: ['supermarket'] },
    { keywords: ['giant eagle', 'giant food'], category: 'groceries', confidence: 0.95, tags: ['supermarket'] },
    { keywords: ['grocery', 'market', 'supermarket', 'food mart'], category: 'groceries', confidence: 0.8 }
  ],

  dining: [
    { keywords: ['starbucks', 'sbux'], category: 'dining', confidence: 0.95, tags: ['coffee', 'cafe'] },
    { keywords: ['mcdonalds', 'mcdonald', 'mcd'], category: 'dining', confidence: 0.95, tags: ['fast-food', 'restaurant'] },
    { keywords: ['chipotle', 'chipotle mexican grill'], category: 'dining', confidence: 0.95, tags: ['fast-casual', 'mexican'] },
    { keywords: ['subway'], category: 'dining', confidence: 0.9, tags: ['fast-food', 'sandwiches'] },
    { keywords: ['panera', 'panera bread'], category: 'dining', confidence: 0.95, tags: ['cafe', 'bakery'] },
    { keywords: ['chick-fil-a', 'chick fil a', 'chickfila'], category: 'dining', confidence: 0.95, tags: ['fast-food', 'chicken'] },
    { keywords: ['taco bell', 'tacobell'], category: 'dining', confidence: 0.95, tags: ['fast-food', 'mexican'] },
    { keywords: ['burger king', 'bk'], category: 'dining', confidence: 0.9, tags: ['fast-food'] },
    { keywords: ['wendys', 'wendy'], category: 'dining', confidence: 0.95, tags: ['fast-food'] },
    { keywords: ['dunkin', 'dunkin donuts'], category: 'dining', confidence: 0.95, tags: ['coffee', 'donuts'] },
    { keywords: ['pizza hut', 'pizzahut'], category: 'dining', confidence: 0.95, tags: ['pizza'] },
    { keywords: ['dominos', 'domino'], category: 'dining', confidence: 0.95, tags: ['pizza'] },
    { keywords: ['papa john', 'papajohn'], category: 'dining', confidence: 0.95, tags: ['pizza'] },
    { keywords: ['kfc', 'kentucky fried'], category: 'dining', confidence: 0.95, tags: ['fast-food', 'chicken'] },
    { keywords: ['olive garden'], category: 'dining', confidence: 0.95, tags: ['restaurant', 'italian'] },
    { keywords: ['red lobster'], category: 'dining', confidence: 0.95, tags: ['restaurant', 'seafood'] },
    { keywords: ['applebees', 'applebee'], category: 'dining', confidence: 0.95, tags: ['restaurant'] },
    { keywords: ['chilis', 'chili'], category: 'dining', confidence: 0.9, tags: ['restaurant'] },
    { keywords: ['outback', 'outback steakhouse'], category: 'dining', confidence: 0.95, tags: ['restaurant', 'steakhouse'] },
    { keywords: ['cheesecake factory'], category: 'dining', confidence: 0.95, tags: ['restaurant'] },
    { keywords: ['doordash', 'door dash'], category: 'dining', confidence: 0.95, tags: ['delivery', 'food-delivery'] },
    { keywords: ['uber eats', 'ubereats'], category: 'dining', confidence: 0.95, tags: ['delivery', 'food-delivery'] },
    { keywords: ['grubhub', 'grub hub'], category: 'dining', confidence: 0.95, tags: ['delivery', 'food-delivery'] },
    { keywords: ['postmates'], category: 'dining', confidence: 0.95, tags: ['delivery', 'food-delivery'] },
    { keywords: ['restaurant', 'cafe', 'bistro', 'diner', 'eatery', 'grill', 'bar & grill'], category: 'dining', confidence: 0.75 }
  ],

  gas: [
    { keywords: ['shell', 'shell oil'], category: 'gas', confidence: 0.95, tags: ['fuel', 'gas-station'] },
    { keywords: ['chevron'], category: 'gas', confidence: 0.95, tags: ['fuel', 'gas-station'] },
    { keywords: ['exxon', 'exxonmobil'], category: 'gas', confidence: 0.95, tags: ['fuel', 'gas-station'] },
    { keywords: ['bp', 'british petroleum'], category: 'gas', confidence: 0.95, tags: ['fuel', 'gas-station'] },
    { keywords: ['mobil'], category: 'gas', confidence: 0.95, tags: ['fuel', 'gas-station'] },
    { keywords: ['arco'], category: 'gas', confidence: 0.95, tags: ['fuel', 'gas-station'] },
    { keywords: ['circle k', 'circlek'], category: 'gas', confidence: 0.95, tags: ['convenience', 'gas-station'] },
    { keywords: ['76', 'seventy-six'], category: 'gas', confidence: 0.95, tags: ['fuel', 'gas-station'] },
    { keywords: ['sunoco'], category: 'gas', confidence: 0.95, tags: ['fuel', 'gas-station'] },
    { keywords: ['marathon'], category: 'gas', confidence: 0.9, tags: ['fuel', 'gas-station'] },
    { keywords: ['speedway'], category: 'gas', confidence: 0.95, tags: ['convenience', 'gas-station'] },
    { keywords: ['wawa'], category: 'gas', confidence: 0.95, tags: ['convenience', 'gas-station'] },
    { keywords: ['sheetz'], category: 'gas', confidence: 0.95, tags: ['convenience', 'gas-station'] },
    { keywords: ['7-eleven', '7 eleven', '711'], category: 'gas', confidence: 0.85, tags: ['convenience'] },
    { keywords: ['gas station', 'fuel', 'petrol'], category: 'gas', confidence: 0.85 }
  ],

  transport: [
    { keywords: ['uber', 'uber trip'], category: 'transport', confidence: 0.95, tags: ['rideshare'] },
    { keywords: ['lyft'], category: 'transport', confidence: 0.95, tags: ['rideshare'] },
    { keywords: ['taxi', 'cab', 'yellow cab'], category: 'transport', confidence: 0.9, tags: ['taxi'] },
    { keywords: ['parking', 'park', 'parkwhiz', 'spothero'], category: 'transport', confidence: 0.9, tags: ['parking'] },
    { keywords: ['toll', 'e-zpass', 'fastrak', 'sunpass'], category: 'transport', confidence: 0.95, tags: ['toll'] },
    { keywords: ['metro', 'subway', 'mta', 'bart', 'cta'], category: 'transport', confidence: 0.9, tags: ['public-transit'] },
    { keywords: ['amtrak', 'train'], category: 'transport', confidence: 0.9, tags: ['rail'] },
    { keywords: ['greyhound', 'megabus'], category: 'transport', confidence: 0.9, tags: ['bus'] },
    { keywords: ['airport', 'airline', 'airways'], category: 'transport', confidence: 0.85, tags: ['air-travel'] }
  ],

  utilities: [
    { keywords: ['electric', 'electricity', 'power company', 'pge', 'pg&e'], category: 'utilities', confidence: 0.95, tags: ['electric'] },
    { keywords: ['duke energy'], category: 'utilities', confidence: 0.95, tags: ['electric'] },
    { keywords: ['con edison', 'coned'], category: 'utilities', confidence: 0.95, tags: ['electric'] },
    { keywords: ['southern california edison', 'sce'], category: 'utilities', confidence: 0.95, tags: ['electric'] },
    { keywords: ['gas company', 'natural gas'], category: 'utilities', confidence: 0.95, tags: ['gas'] },
    { keywords: ['water', 'water district', 'water authority'], category: 'utilities', confidence: 0.95, tags: ['water'] },
    { keywords: ['sewer', 'wastewater'], category: 'utilities', confidence: 0.95, tags: ['sewer'] },
    { keywords: ['trash', 'waste management', 'republic services', 'waste pro'], category: 'utilities', confidence: 0.95, tags: ['trash'] },
    { keywords: ['utility', 'utilities'], category: 'utilities', confidence: 0.85 }
  ],

  internet: [
    { keywords: ['comcast', 'xfinity'], category: 'internet', confidence: 0.95, tags: ['cable', 'isp'] },
    { keywords: ['at&t', 'att'], category: 'internet', confidence: 0.9, tags: ['telecom', 'isp'] },
    { keywords: ['verizon', 'verizon fios'], category: 'internet', confidence: 0.9, tags: ['telecom', 'isp'] },
    { keywords: ['spectrum', 'charter'], category: 'internet', confidence: 0.95, tags: ['cable', 'isp'] },
    { keywords: ['cox', 'cox communications'], category: 'internet', confidence: 0.95, tags: ['cable', 'isp'] },
    { keywords: ['centurylink'], category: 'internet', confidence: 0.95, tags: ['isp'] },
    { keywords: ['optimum', 'cablevision'], category: 'internet', confidence: 0.95, tags: ['cable', 'isp'] },
    { keywords: ['frontier'], category: 'internet', confidence: 0.9, tags: ['isp'] },
    { keywords: ['internet', 'broadband', 'wifi', 'cable'], category: 'internet', confidence: 0.8 }
  ],

  phone: [
    { keywords: ['t-mobile', 'tmobile'], category: 'phone', confidence: 0.95, tags: ['wireless', 'mobile'] },
    { keywords: ['verizon wireless'], category: 'phone', confidence: 0.95, tags: ['wireless', 'mobile'] },
    { keywords: ['at&t wireless', 'att wireless'], category: 'phone', confidence: 0.95, tags: ['wireless', 'mobile'] },
    { keywords: ['sprint'], category: 'phone', confidence: 0.95, tags: ['wireless', 'mobile'] },
    { keywords: ['cricket wireless'], category: 'phone', confidence: 0.95, tags: ['wireless', 'mobile'] },
    { keywords: ['metro pcs', 'metropcs'], category: 'phone', confidence: 0.95, tags: ['wireless', 'mobile'] },
    { keywords: ['boost mobile'], category: 'phone', confidence: 0.95, tags: ['wireless', 'mobile'] },
    { keywords: ['phone', 'wireless', 'cellular', 'mobile'], category: 'phone', confidence: 0.8 }
  ],

  entertainment: [
    { keywords: ['netflix'], category: 'entertainment', confidence: 0.95, tags: ['streaming', 'subscription'] },
    { keywords: ['spotify'], category: 'entertainment', confidence: 0.95, tags: ['music', 'subscription'] },
    { keywords: ['hulu'], category: 'entertainment', confidence: 0.95, tags: ['streaming', 'subscription'] },
    { keywords: ['disney+', 'disney plus', 'disneyplus'], category: 'entertainment', confidence: 0.95, tags: ['streaming', 'subscription'] },
    { keywords: ['hbo', 'hbo max', 'hbomax'], category: 'entertainment', confidence: 0.95, tags: ['streaming', 'subscription'] },
    { keywords: ['amazon prime', 'prime video'], category: 'entertainment', confidence: 0.9, tags: ['streaming', 'subscription'] },
    { keywords: ['apple music'], category: 'entertainment', confidence: 0.95, tags: ['music', 'subscription'] },
    { keywords: ['youtube premium', 'youtube music'], category: 'entertainment', confidence: 0.95, tags: ['streaming', 'subscription'] },
    { keywords: ['paramount+', 'paramount plus'], category: 'entertainment', confidence: 0.95, tags: ['streaming', 'subscription'] },
    { keywords: ['peacock'], category: 'entertainment', confidence: 0.95, tags: ['streaming', 'subscription'] },
    { keywords: ['amc', 'regal', 'cinemark', 'movie theater', 'cinema'], category: 'entertainment', confidence: 0.9, tags: ['movies'] },
    { keywords: ['playstation', 'xbox', 'nintendo', 'steam', 'epic games'], category: 'entertainment', confidence: 0.9, tags: ['gaming'] },
    { keywords: ['ticketmaster', 'stubhub'], category: 'entertainment', confidence: 0.9, tags: ['tickets'] }
  ],

  shopping: [
    { keywords: ['amazon', 'amzn'], category: 'shopping', confidence: 0.95, tags: ['online', 'retail'] },
    { keywords: ['ebay'], category: 'shopping', confidence: 0.95, tags: ['online', 'marketplace'] },
    { keywords: ['etsy'], category: 'shopping', confidence: 0.95, tags: ['online', 'handmade'] },
    { keywords: ['best buy', 'bestbuy'], category: 'shopping', confidence: 0.95, tags: ['electronics', 'retail'] },
    { keywords: ['home depot', 'homedepot'], category: 'shopping', confidence: 0.95, tags: ['hardware', 'home-improvement'] },
    { keywords: ['lowes', 'lowe'], category: 'shopping', confidence: 0.95, tags: ['hardware', 'home-improvement'] },
    { keywords: ['macys', 'macy'], category: 'shopping', confidence: 0.95, tags: ['department', 'clothing'] },
    { keywords: ['nordstrom'], category: 'shopping', confidence: 0.95, tags: ['department', 'clothing'] },
    { keywords: ['kohls', 'kohl'], category: 'shopping', confidence: 0.95, tags: ['department', 'retail'] },
    { keywords: ['tj maxx', 'tjmaxx', 'marshalls', 'homegoods'], category: 'shopping', confidence: 0.95, tags: ['discount', 'retail'] },
    { keywords: ['ross', 'ross dress'], category: 'shopping', confidence: 0.95, tags: ['discount', 'clothing'] },
    { keywords: ['old navy', 'gap', 'banana republic'], category: 'shopping', confidence: 0.95, tags: ['clothing'] },
    { keywords: ['h&m', 'zara', 'forever 21'], category: 'shopping', confidence: 0.95, tags: ['fashion'] },
    { keywords: ['ikea'], category: 'shopping', confidence: 0.95, tags: ['furniture', 'home'] },
    { keywords: ['bed bath', 'container store'], category: 'shopping', confidence: 0.95, tags: ['home', 'retail'] }
  ],

  healthcare: [
    { keywords: ['cvs', 'cvs pharmacy'], category: 'healthcare', confidence: 0.95, tags: ['pharmacy', 'drugstore'] },
    { keywords: ['walgreens'], category: 'healthcare', confidence: 0.95, tags: ['pharmacy', 'drugstore'] },
    { keywords: ['rite aid'], category: 'healthcare', confidence: 0.95, tags: ['pharmacy', 'drugstore'] },
    { keywords: ['pharmacy', 'prescription', 'rx'], category: 'healthcare', confidence: 0.9, tags: ['pharmacy'] },
    { keywords: ['doctor', 'dr.', 'physician', 'clinic'], category: 'healthcare', confidence: 0.9, tags: ['medical'] },
    { keywords: ['hospital', 'medical center', 'health system'], category: 'healthcare', confidence: 0.9, tags: ['medical'] },
    { keywords: ['dental', 'dentist', 'orthodont'], category: 'healthcare', confidence: 0.95, tags: ['dental'] },
    { keywords: ['vision', 'optometry', 'eye care', 'eyemed'], category: 'healthcare', confidence: 0.95, tags: ['vision'] },
    { keywords: ['urgent care', 'emergency'], category: 'healthcare', confidence: 0.9, tags: ['medical'] },
    { keywords: ['lab', 'laboratory', 'quest diagnostics', 'labcorp'], category: 'healthcare', confidence: 0.9, tags: ['medical', 'lab'] }
  ],

  fitness: [
    { keywords: ['planet fitness'], category: 'fitness', confidence: 0.95, tags: ['gym', 'health'] },
    { keywords: ['la fitness', 'lafitness'], category: 'fitness', confidence: 0.95, tags: ['gym', 'health'] },
    { keywords: ['24 hour fitness'], category: 'fitness', confidence: 0.95, tags: ['gym', 'health'] },
    { keywords: ['equinox'], category: 'fitness', confidence: 0.95, tags: ['gym', 'premium'] },
    { keywords: ['crunch fitness'], category: 'fitness', confidence: 0.95, tags: ['gym', 'health'] },
    { keywords: ['anytime fitness'], category: 'fitness', confidence: 0.95, tags: ['gym', 'health'] },
    { keywords: ['orangetheory'], category: 'fitness', confidence: 0.95, tags: ['gym', 'fitness-class'] },
    { keywords: ['peloton'], category: 'fitness', confidence: 0.95, tags: ['fitness', 'subscription'] },
    { keywords: ['yoga', 'pilates'], category: 'fitness', confidence: 0.9, tags: ['fitness', 'wellness'] },
    { keywords: ['gym', 'fitness', 'workout'], category: 'fitness', confidence: 0.8 }
  ],

  insurance: [
    { keywords: ['geico'], category: 'insurance', confidence: 0.95, tags: ['auto-insurance'] },
    { keywords: ['state farm'], category: 'insurance', confidence: 0.95, tags: ['insurance'] },
    { keywords: ['allstate'], category: 'insurance', confidence: 0.95, tags: ['insurance'] },
    { keywords: ['progressive'], category: 'insurance', confidence: 0.95, tags: ['auto-insurance'] },
    { keywords: ['farmers insurance'], category: 'insurance', confidence: 0.95, tags: ['insurance'] },
    { keywords: ['liberty mutual'], category: 'insurance', confidence: 0.95, tags: ['insurance'] },
    { keywords: ['insurance', 'life insurance', 'health insurance'], category: 'insurance', confidence: 0.9 }
  ]
};

// Fuzzy string matching for merchant names
export function fuzzyMatch(str1: string, str2: string): number {
  const s1 = str1.toLowerCase().trim();
  const s2 = str2.toLowerCase().trim();

  // Exact match
  if (s1 === s2) return 1.0;

  // Contains match
  if (s1.includes(s2) || s2.includes(s1)) return 0.9;

  // Calculate Levenshtein distance for similarity
  const maxLength = Math.max(s1.length, s2.length);
  if (maxLength === 0) return 1.0;

  const distance = levenshteinDistance(s1, s2);
  const similarity = 1 - distance / maxLength;

  return similarity;
}

// Levenshtein distance algorithm for fuzzy matching
function levenshteinDistance(str1: string, str2: string): number {
  const matrix: number[][] = [];

  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1      // deletion
        );
      }
    }
  }

  return matrix[str2.length][str1.length];
}

// Find best matching category for a merchant
export function findBestCategoryMatch(
  merchantName: string,
  description: string
): { category: string; confidence: number; reason: string; tags: string[] } | null {
  const searchText = `${merchantName} ${description}`.toLowerCase();
  let bestMatch: { category: string; confidence: number; reason: string; tags: string[] } | null = null;
  let highestScore = 0;

  for (const [categoryKey, patterns] of Object.entries(MERCHANT_PATTERNS)) {
    for (const pattern of patterns) {
      for (const keyword of pattern.keywords) {
        const matchScore = fuzzyMatch(searchText, keyword);

        // Also check if keyword appears anywhere in the text
        const containsScore = searchText.includes(keyword.toLowerCase()) ? 0.95 : 0;

        const finalScore = Math.max(matchScore, containsScore) * pattern.confidence;

        if (finalScore > highestScore && finalScore > 0.7) {
          highestScore = finalScore;
          bestMatch = {
            category: pattern.category,
            confidence: finalScore,
            reason: `Matches "${keyword}"`,
            tags: pattern.tags || []
          };
        }
      }
    }
  }

  return bestMatch;
}
