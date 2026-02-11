import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { chatText } from './llmService.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.join(__dirname, '../../data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const CACHE_FILE = path.join(DATA_DIR, 'price_cache.json');
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

// Load cache from disk
let priceCache = new Map();
try {
  if (fs.existsSync(CACHE_FILE)) {
    const rawData = fs.readFileSync(CACHE_FILE, 'utf8');
    const jsonCache = JSON.parse(rawData);
    priceCache = new Map(jsonCache);
    console.log(`[Cache] Loaded ${priceCache.size} items from disk.`);
  }
} catch (err) {
  console.error('[Cache] Failed to load cache:', err.message);
}

const saveCacheToDisk = () => {
  try {
    const jsonCache = JSON.stringify(Array.from(priceCache.entries()), null, 2);
    fs.writeFileSync(CACHE_FILE, jsonCache);
  } catch (err) {
    console.error('[Cache] Failed to save cache:', err.message);
  }
};

const getCached = (key) => {
  // 1. Try Exact Match
  let cached = priceCache.get(key);
  
  // 2. Try Partial/Fuzzy Match if exact fails
  if (!cached) {
    const [platform, itemName] = key.split(':');
    if (itemName && itemName.length > 2) {
      // Look for any key in the cache that CONTAINS the requested item name
      // e.g., Request: "milk" -> Matches: "blinkit:amul taaza milk"
      for (const [cacheKey, entry] of priceCache.entries()) {
        if (cacheKey.startsWith(platform) && cacheKey.includes(itemName)) {
          console.log(`[Cache] Fuzzy Match: "${itemName}" matched with "${cacheKey}"`);
          cached = entry;
          break;
        }
      }
    }
  }

  if (!cached) return null;
  
  if (Date.now() - cached.time > CACHE_TTL) {
    priceCache.delete(key);
    saveCacheToDisk();
    return null;
  }
  return cached.value;
};

const setCache = (key, value) => {
  priceCache.set(key, { value, time: Date.now() });
  saveCacheToDisk();
};

export const cleanItemName = (itemName) => {
  return itemName
    .replace(/\b\d+(\.\d+)?\s*(kg|g|l|ml|gm|litre|liter)\b/gi, '')
    .replace(/\b(Aashirvaad|Fortune|Tata|India Gate|Daawat|Amul|Nestle|Britannia|Haldiram|MDH|Everest|Fresho|Patanjali)\b/gi, '')
    .replace(/[^\w\s]/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
};

/* ===================== PRICE ESTIMATES (MARKET RATES) ===================== */

const PRICE_ESTIMATES = {
  // Grains & Flours (per kg)
  'atta': 45, 'wheat': 45, 'flour': 45, 'maida': 40,
  'rice': 60, 'basmati': 120, 'brown rice': 80, 'idli rice': 55,
  'rava': 50, 'sooji': 50, 'semolina': 50,
  'poha': 60, 'beaten rice': 60,
  
  // Vegetables (per kg)
  'potato': 30, 'aloo': 30,
  'onion': 40, 'pyaz': 40,
  'tomato': 50, 'tamatar': 50,
  'carrot': 50, 'gajar': 50,
  'cabbage': 35, 'patta gobhi': 35,
  'cauliflower': 45, 'gobhi': 45, 'phool gobhi': 45,
  'peas': 80, 'matar': 80,
  'okra': 60, 'bhindi': 60, 'ladyfinger': 60,
  'brinjal': 50, 'baingan': 50, 'eggplant': 50,
  'capsicum': 80, 'bell pepper': 80, 'shimla mirch': 80,
  'beans': 60, 'french beans': 60,
  'spinach': 40, 'palak': 40,
  'coriander': 40, 'dhaniya': 40, 'cilantro': 40,
  'mint': 30, 'pudina': 30,
  'curry leaves': 20, 'kadhi patta': 20,
  'ginger': 80, 'adrak': 80,
  'garlic': 100, 'lahsun': 100,
  'green chilli': 60, 'hari mirch': 60,
  'bottle gourd': 40, 'lauki': 40,
  'ridge gourd': 50, 'turai': 50,
  'bitter gourd': 60, 'karela': 60,
  'pumpkin': 35, 'kaddu': 35,
  
  // Cooking Oils (per litre)
  'oil': 180, 'sunflower': 180, 'refined': 180,
  'mustard oil': 200, 'sarson': 200,
  'groundnut': 220, 'peanut': 220,
  'ghee': 500, 'clarified butter': 500,
  'butter': 450, 'makhan': 450,
  
  // Dairy (per litre/kg)
  'milk': 60, 'doodh': 60,
  'curd': 60, 'yogurt': 60, 'dahi': 60,
  'paneer': 350, 'cottage cheese': 350,
  'cheese': 400, 'cream': 200, 'malai': 200,
  
  // Pulses/Lentils (per kg)
  'dal': 110, 'lentil': 110,
  'toor': 120, 'arhar': 120, 'pigeon pea': 120,
  'moong': 110, 'green gram': 110,
  'masoor': 100, 'red lentil': 100,
  'chana': 90, 'chickpea': 90, 'bengal gram': 90,
  'urad': 120, 'black gram': 120,
  'rajma': 130, 'kidney beans': 130,
  
  // Spices (per 100g)
  'salt': 20, 'namak': 20,
  'sugar': 45, 'cheeni': 45,
  'masala': 120, 'spice': 120,
  'turmeric': 60, 'haldi': 60,
  'chilli': 100, 'mirch': 100, 'red chilli': 100,
  'cumin': 120, 'jeera': 120,
  'coriander powder': 80, 'dhaniya powder': 80,
  'garam masala': 150, 'black pepper': 200, 'kali mirch': 200,
  'cardamom': 800, 'elaichi': 800,
  'clove': 600, 'laung': 600,
  'cinnamon': 300, 'dalchini': 300,
  'bay leaf': 200, 'tej patta': 200,
  'mustard seeds': 100, 'rai': 100,
  'fenugreek': 80, 'methi': 80,
  'asafoetida': 400, 'hing': 400,
  
  // Packaged/Processed
  'bread': 40, 'pav': 30,
  'biscuit': 50, 'cookie': 60,
  'jam': 120, 'sauce': 100, 'ketchup': 100,
  'pickle': 150, 'achar': 150,
  'papad': 60, 'vermicelli': 60, 'sevai': 60,
  'noodles': 80, 'pasta': 100,
  
  // Eggs & Meat (per dozen/kg)
  'egg': 70, 'anda': 70,
  'chicken': 200, 'murgi': 200,
  'fish': 350, 'machli': 350,
  'mutton': 600, 'bakra': 600,
  
  // Beverages
  'tea': 350, 'chai': 350,
  'coffee': 400,
  'water': 20,
  
  // Default fallback
  'default': 75
};

const getEstimate = (itemName, platform = 'bigbasket') => {
  const normalized = cleanItemName(itemName);
  let basePrice = PRICE_ESTIMATES.default;
  
  // Find matching category
  for (const [key, price] of Object.entries(PRICE_ESTIMATES)) {
    if (normalized.includes(key)) {
      basePrice = price;
      break;
    }
  }
  
  // Platform price multipliers (based on market observation)
  const multipliers = {
    'bigbasket': 1.0,
    'blinkit': 1.15,
    'zepto': 1.12,
    'instamart': 1.10
  };
  
  return Math.round(basePrice * (multipliers[platform] || 1.0) * 100) / 100;
};

/* ===================== INTELLIGENT CACHE MATCHING (LLM) ===================== */

const findBestCacheMatch = async (platform, requestedItem) => {
  const lowerRequested = requestedItem.toLowerCase();

  // 1. Collect available items & Try Deterministic Match First
  const candidates = [];

  for (const [key, entry] of priceCache.entries()) {
    if (key.startsWith(platform) && !entry.value.isEstimate) {
      const originalName = entry.value.originalName || key.split(':')[1];
      const lowerOriginal = originalName.toLowerCase();

      // OPTIMIZATION: Immediate Substring Match
      if (lowerRequested.length > 3 && lowerOriginal.includes(lowerRequested)) {
        console.log(`[Cache] Fast Match: "${requestedItem}" matched "${originalName}"`);
        return key;
      }

      candidates.push({ name: originalName, time: entry.time });
    }
  }

  if (candidates.length === 0) return null;

  // Sort by time (newest first) and take top 50
  // This ensures we match against what the user JUST looked at
  const recentItems = candidates
    .sort((a, b) => b.time - a.time)
    .slice(0, 50)
    .map(c => c.name);

  // 2. Ask LLM to find the best semantic match
  try {
    const prompt = `
I have a shopping list item: "${requestedItem}"

Here is a list of available products in my cart (most recent):
${JSON.stringify(recentItems)}

Find the single best match.
- "Tomato" matches "Hybrid Tomato" or "Tamatar"
- "Milk" matches "Amul Taaza Milk"

Return ONLY the exact string from the list.
If NO match, return "null".
`.trim();

    const raw = await chatText({
      messages: [{ role: 'user', content: prompt }],
      task: 'match',
      temperature: 0.0,
      maxTokens: 50
    });

    const match = (raw || '').trim().replace(/['"]/g, '');

    if (match !== 'null') {
      // Find the key corresponding to this match name
      for (const [key, entry] of priceCache.entries()) {
        const entryName = entry.value.originalName || key.split(':')[1];
        if (entryName === match) {
          console.log(`[Cache] AI matched "${requestedItem}" -> "${match}"`);
          return key;
        }
      }
    }
  } catch (error) {
    console.warn('[Cache] AI Match failed:', error.message);
  }

  return null;
};
/* ===================== MAIN SCRAPING FUNCTION ===================== */

export const scrapePrice = async (platform, itemName, options = {}) => {
  const { allowAiMatch = true } = options;
  const cleanName = cleanItemName(itemName);
  const exactKey = `${platform}:${cleanName}`;
  
  // 1. Try Exact Match
  let cached = getCached(exactKey);
  
  // If we found a REAL price (not estimate), return it immediately
  if (cached && !cached.isEstimate) {
    console.log(`[${platform}] HIT (Exact): "${itemName}" -> INR ${cached.price}`);
    return cached;
  }

  // 3. Try AI Semantic Match (New!)
  // Only try this if we have "real" data in cache to match against
  if (allowAiMatch) {
    const aiKey = await findBestCacheMatch(platform, itemName); // Pass original itemName for better context
    if (aiKey) {
      const aiCached = getCached(aiKey);
      if (aiCached && !aiCached.isEstimate) {
        console.log(`[${platform}] HIT (AI): "${itemName}" -> "${aiKey}" (INR ${aiCached.price})`);
        
        // OPTIMIZATION: Save this AI match as a direct alias in the cache!
        // Next time "Tomato" is requested, it will be an EXACT match for this alias.
        // We copy the real data but keep the original key reference if needed.
        const aliasValue = { ...aiCached, sourceAlias: aiKey };
        setCache(exactKey, aliasValue);
        
        return aiCached;
      }
    }
  }

  // 3. If we still only have the exact-match Estimate from step 1, use it as fallback
  if (cached) {
     console.log(`[${platform}] HIT (Estimate): "${itemName}" -> INR ${cached.price}`);
     return cached;
  }

  // 4. Cache Miss - use market estimate
  console.log(`[${platform}] MISS: Using estimate for "${itemName}"`);
  const price = getEstimate(itemName, platform);
  const result = { price, unit: '1 unit', isEstimate: true };
  
  setCache(exactKey, result);
  return result;
};

/* ===================== HELPER: RESOLVE BEST NAME ===================== */

export const resolveItemName = async (platform, itemName) => {
  const cleanName = cleanItemName(itemName);
  const exactKey = `${platform}:${cleanName}`;
  
  // 1. Try Exact Match
  let cached = getCached(exactKey);
  
  if (cached && !cached.isEstimate && cached.originalName) {
    return cached.originalName;
  }

  // 2. Try AI/Fuzzy Match Logic (Reused via findBestCacheMatch)
  // We reuse the internal helper we already wrote
  const aiKey = await findBestCacheMatch(platform, itemName); 
  
  if (aiKey) {
    const aiCached = getCached(aiKey);
    if (aiCached && !aiCached.isEstimate && aiCached.originalName) {
      return aiCached.originalName;
    }
  }

  // 3. Fallback to generic name
  return itemName;
};

/* ===================== EXTENSION PRICE INGESTION ===================== */

export const saveCartPrice = async (userId, platform, name, price, quantity = '1 unit') => {
  // Normalize platform name
  const cleanPlatform = platform.toLowerCase()
    .replace('.com', '')
    .replace('www.', '')
    .split('.')[0];
  
  const cleanName = cleanItemName(name);
  const key = `${cleanPlatform}:${cleanName}`;
  
  // Store as high-quality, non-estimated price
  const value = { 
    price: Number(price), 
    unit: quantity, 
    isEstimate: false, 
    source: 'extension',
    userId,
    originalName: name, // CRITICAL: Save original name for AI matching
    capturedAt: new Date().toISOString()
  };
  
  setCache(key, value);
  console.log(`[INGEST] OK ${cleanPlatform.toUpperCase()} | ${name} | INR ${price} / ${quantity} (User: ${userId})`);
  
  return { success: true, key, value };
};

/* ===================== BULK INGESTION (from extension batch) ===================== */

export const ingestBulkPrices = async (userId, prices) => {
  let successCount = 0;
  
  for (const item of prices) {
    try {
      await saveCartPrice(userId, item.platform, item.name, item.price, item.unit);
      successCount++;
    } catch (err) {
      console.error(`[INGEST] Failed for ${item.name}:`, err.message);
    }
  }
  
  console.log(`[INGEST] Bulk completed: ${successCount}/${prices.length} items saved`);
  return { success: true, saved: successCount, total: prices.length };
};

/* ===================== CACHE MANAGEMENT ===================== */

export const getCacheStats = () => {
  const stats = {
    total: priceCache.size,
    estimated: 0,
    captured: 0,
    platforms: { bigbasket: 0, blinkit: 0, zepto: 0, instamart: 0 }
  };
  
  priceCache.forEach((entry) => {
    if (entry.value.isEstimate) {
      stats.estimated++;
    } else {
      stats.captured++;
    }
    
    // Count by platform (extract from key)
    const platform = entry.value.source || 'unknown';
    if (stats.platforms[platform] !== undefined) {
      stats.platforms[platform]++;
    }
  });
  
  return stats;
};

export const clearCache = () => {
  priceCache.clear();
  saveCacheToDisk();
  console.log('[Cache] Cleared all cached prices');
};

export const clearEstimates = () => {
  let cleared = 0;
  priceCache.forEach((entry, key) => {
    if (entry.value.isEstimate) {
      priceCache.delete(key);
      cleared++;
    }
  });
  saveCacheToDisk();
  console.log(`[Cache] Cleared ${cleared} estimated prices`);
};

// Auto-save cache periodically (every 5 minutes)
setInterval(() => {
  saveCacheToDisk();
  console.log(`[Cache] Auto-saved ${priceCache.size} items`);
}, 5 * 60 * 1000);

