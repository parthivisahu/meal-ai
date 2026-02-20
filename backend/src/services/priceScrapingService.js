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
  
  if (cached) {
    console.log(`[Cache] Exact hit for "${key}": isEstimate=${cached.value.isEstimate}, price=${cached.value.price}`);
  }

  // 2. Try Partial/Fuzzy Match if exact fails
  if (!cached) {
    const [platform, itemName] = key.split(':');
    if (itemName && itemName.length > 2) {
      // Look for any key in the cache that CONTAINS the requested item name
      for (const [cacheKey, entry] of priceCache.entries()) {
        if (cacheKey.startsWith(platform) && cacheKey.includes(itemName)) {
          console.log(`[Cache] Fuzzy Match: Requested "${itemName}" found in "${cacheKey}" (isEstimate=${entry.value.isEstimate})`);
          cached = entry;
          break;
        }
      }
    }
  }

  if (!cached) return null;
  
  if (Date.now() - cached.time > CACHE_TTL) {
    console.log(`[Cache] Expired: "${key}"`);
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
  const normalized = itemName
    .replace(/\b\d+(\.\d+)?\s*(kg|g|l|ml|gm|litre|liter)\b/gi, '')
    .replace(
      /\b(Aashirvaad|Aashirvad|Aashirwad|Ashirvad|Ashirwad|Fortune|Tata|India Gate|Daawat|Amul|Nestle|Britannia|Haldiram|MDH|Everest|Fresho|Patanjali)\b/gi,
      ''
    )
    .replace(/[^\w\s]/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();

  const tokenMap = {
    aata: 'atta',
    aatta: 'atta',
    atta: 'atta',
    chawal: 'rice',
    mirchi: 'chilli',
    mirch: 'chilli',
    dahi: 'curd',
    lahsun: 'garlic',
    adrakh: 'ginger',
    dhaniya: 'coriander',
    namak: 'salt',
    cheeni: 'sugar'
  };

  return normalized
    .split(/\s+/)
    .map(t => tokenMap[t] || t)
    .filter(Boolean)
    .join(' ');
};

/* ===================== PRICE ESTIMATES (MARKET RATES) ===================== */

const PRICE_ESTIMATES = {
  // Grains & Flours (per kg)
  'atta': 45, 'wheat': 45, 'flour': 45, 'maida': 40, 'ashirvaad atta': 55,
  'rice': 60, 'basmati': 120, 'brown rice': 90, 'idli rice': 55, 'sona masuri': 70, 'kolam rice': 75,
  'rava': 50, 'sooji': 50, 'semolina': 50, 'dalia': 60,
  'poha': 60, 'beaten rice': 60, 'sabudana': 90,
  
  // Vegetables (per kg)
  'potato': 30, 'aloo': 30, 'baby potato': 40,
  'onion': 40, 'pyaz': 40, 'red onion': 45, 'sambhar onion': 60,
  'tomato': 40, 'tamatar': 40, 'hybrid tomato': 35, 'desi tomato': 50,
  'carrot': 60, 'gajar': 60, 'ooty carrot': 80,
  'cabbage': 35, 'patta gobhi': 35,
  'cauliflower': 50, 'gobhi': 50, 'phool gobhi': 50,
  'peas': 80, 'matar': 80, 'frozen peas': 180,
  'okra': 60, 'bhindi': 60, 'ladyfinger': 60,
  'brinjal': 50, 'baingan': 50, 'eggplant': 50,
  'capsicum': 90, 'bell pepper': 90, 'shimla mirch': 90, 'red capsicum': 250, 'yellow capsicum': 250,
  'beans': 70, 'french beans': 70, 'cluster beans': 60,
  'spinach': 40, 'palak': 40, 'methi': 40, 'fenugreek leaves': 40,
  'coriander': 40, 'dhaniya': 40, 'cilantro': 40,
  'mint': 30, 'pudina': 30,
  'curry leaves': 20, 'kadhi patta': 20,
  'ginger': 120, 'adrak': 120,
  'garlic': 200, 'lahsun': 200,
  'green chilli': 80, 'hari mirch': 80,
  'bottle gourd': 40, 'lauki': 40,
  'ridge gourd': 50, 'turai': 50,
  'bitter gourd': 60, 'karela': 60,
  'pumpkin': 30, 'kaddu': 30,
  'broccoli': 150, 'mushroom': 200, 'sweet corn': 80,
  
  // Cooking Oils (per litre)
  'oil': 160, 'sunflower': 160, 'refined': 150,
  'mustard oil': 180, 'sarson': 180,
  'groundnut': 210, 'peanut': 210,
  'olive oil': 800, 'coconut oil': 350,
  'ghee': 650, 'clarified butter': 650, 'amul ghee': 680,
  'butter': 500, 'makhan': 500, 'amul butter': 520,
  
  // Dairy (per litre/kg)
  'milk': 65, 'doodh': 65, 'full cream milk': 72, 'toned milk': 56,
  'curd': 80, 'yogurt': 120, 'dahi': 80, 'greek yogurt': 300,
  'paneer': 450, 'cottage cheese': 450, 'fresh paneer': 480,
  'cheese': 500, 'cheese slices': 600, 'mozzarella': 700,
  'cream': 250, 'malai': 250, 'fresh cream': 220,
  
  // Pulses/Lentils (per kg)
  'dal': 130, 'lentil': 130,
  'toor': 160, 'arhar': 160, 'pigeon pea': 160,
  'moong': 120, 'green gram': 120, 'moong dal': 140,
  'masoor': 100, 'red lentil': 100,
  'chana': 90, 'chickpea': 90, 'kabuli chana': 140, 'kala chana': 100,
  'urad': 140, 'black gram': 140, 'urad dal': 160,
  'rajma': 150, 'kidney beans': 150,
  
  // Spices (per 100g)
  'salt': 25, 'namak': 25,
  'sugar': 50, 'cheeni': 50, 'jaggery': 70, 'gur': 70,
  'masala': 120, 'spice': 120,
  'turmeric': 60, 'haldi': 60,
  'chilli powder': 100, 'mirch powder': 100, 'red chilli': 100,
  'cumin': 120, 'jeera': 120,
  'coriander powder': 80, 'dhaniya powder': 80,
  'garam masala': 150, 'black pepper': 250, 'kali mirch': 250,
  'cardamom': 1200, 'elaichi': 1200,
  'clove': 800, 'laung': 800,
  'cinnamon': 400, 'dalchini': 400,
  'bay leaf': 200, 'tej patta': 200,
  'mustard seeds': 100, 'rai': 100,
  'fenugreek seeds': 80, 'methi dana': 80,
  'asafoetida': 500, 'hing': 500,
  
  // Packaged/Processed
  'bread': 45, 'pav': 35, 'brown bread': 55,
  'biscuit': 50, 'cookie': 80,
  'jam': 150, 'sauce': 120, 'ketchup': 120,
  'pickle': 200, 'achar': 200,
  'papad': 80, 'vermicelli': 70, 'sevai': 70,
  'noodles': 100, 'pasta': 120, 'maggi': 15,
  
  // Eggs & Meat (per dozen/kg)
  'egg': 80, 'anda': 80,
  'chicken': 240, 'murgi': 240, 'chicken breast': 450,
  'fish': 500, 'machli': 500, 'rohu': 300, 'surmai': 900,
  'mutton': 800, 'bakra': 800,
  
  // Beverages
  'tea': 450, 'chai': 450, 'green tea': 600,
  'coffee': 600, 'instant coffee': 800,
  'water': 20,
  
  // Default fallback
  'default': 80
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

Find the single best SEMANTIC match.
RULES:
1. "Tomato" matches "Hybrid Tomato", "Desi Tomato", or "Tamatar".
2. "Tomato" does NOT match "Cherry Tomato" or "Organic Sun-dried Tomato" because they are specialty items with vastly different prices.
3. If the requested item is generic, do NOT match it with a "Premium", "Organic", or "Imported" version if a standard version is likely available.
4. Only return a match if it's a reasonable substitute that a normal shopper would pick.

Return ONLY the exact string from the list.
If NO reasonable match, return "null".
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
  
  console.log(`[scrapePrice] Request: ${platform} | ${itemName} (cleaned: ${cleanName})`);

  // 1. Try Exact/Fuzzy Match from getCached
  let cached = getCached(exactKey);
  
  // If we found a REAL price (from extension), return it immediately
  if (cached && !cached.isEstimate) {
    console.log(`[${platform}] HIT (Real): "${itemName}" -> INR ${cached.price} from source ${cached.source || 'unknown'}`);
    return cached;
  }

  // 2. Try AI Semantic Match (if allowed and no real price found yet)
  if (allowAiMatch) {
    console.log(`[${platform}] Searching for AI semantic match for "${itemName}"...`);
    const aiKey = await findBestCacheMatch(platform, itemName);
    if (aiKey) {
      const aiCached = getCached(aiKey);
      if (aiCached && !aiCached.isEstimate) {
        console.log(`[${platform}] HIT (AI): "${itemName}" -> matched "${aiKey}" (INR ${aiCached.price})`);
        
        const matchedName = aiCached.originalName || aiKey.split(':')[1];
        
        // Save as alias in cache for faster subsequent lookups
        const aliasValue = { ...aiCached, sourceAlias: aiKey, matchedName };
        setCache(exactKey, aliasValue);
        
        return { ...aiCached, matchedName };
      }
    }
  }

  // 3. Fallback to the estimate we might have found in step 1
  if (cached) {
     console.log(`[${platform}] HIT (Estimate): "${itemName}" -> INR ${cached.price}`);
     return { ...cached, matchedName: cached.originalName || null };
  }

  // 4. Complete Cache Miss - use market estimate
  console.log(`[${platform}] TOTAL MISS: Using fresh estimate for "${itemName}"`);
  const price = getEstimate(itemName, platform);
  const result = { price, unit: '1 unit', isEstimate: true, matchedName: 'Market Estimate' };
  
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

export const getLatestCapturedAt = () => {
  let latestMs = null;
  priceCache.forEach((entry) => {
    if (entry?.value?.isEstimate === false) {
      const capturedMs = entry.value.capturedAt
        ? new Date(entry.value.capturedAt).getTime()
        : entry.time;
      if (!latestMs || capturedMs > latestMs) latestMs = capturedMs;
    }
  });
  return latestMs ? new Date(latestMs).toISOString() : null;
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

