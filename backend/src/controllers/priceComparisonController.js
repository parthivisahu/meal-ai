import { saveCartPrice, getCacheStats, clearEstimates, getLatestCapturedAt } from '../services/priceScrapingService.js';
import { comparePrices as runComparison } from '../services/mealPlanningService.js';
import pool from '../config/database.js';

export const ingestPrice = async (req, res) => {
  try {
    const { platform, name, price, unit, quantity } = req.body;
    
    // Validation
    if (!platform || !name || price == null) {
      return res.status(400).json({ 
        success: false, 
        error: 'Missing required fields: platform, name, price' 
      });
    }

    // Normalize the data
    const normalizedData = {
      platform: platform.toLowerCase().trim(),
      name: name.trim(),
      price: parseFloat(price),
      unit: unit || quantity || '1 unit'
    };

    // Validate price
    if (isNaN(normalizedData.price) || normalizedData.price <= 0) {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid price value' 
      });
    }

    // For extension: use 'extension_user' if no auth
    // For web app: use actual userId from auth token
    const userId = req.user?.userId || 'extension_user';

    const result = await saveCartPrice(
      userId, 
      normalizedData.platform, 
      normalizedData.name, 
      normalizedData.price, 
      normalizedData.unit
    );

    console.log(`[API] Ingested: ${normalizedData.platform} - ${normalizedData.name} @ ₹${normalizedData.price}`);
    
    res.status(200).json({ 
      success: true,
      message: `Price ingested: ${normalizedData.name} - ₹${normalizedData.price}`,
      data: normalizedData,
      cacheKey: result.key
    });
  } catch (err) {
    console.error('[PriceController] Ingest error:', err);
    res.status(500).json({ 
      success: false,
      error: 'Ingest failed: ' + err.message 
    });
  }
};

export const getCacheStatus = async (req, res) => {
  try {
    const stats = getCacheStats();
    res.json({
      success: true,
      stats,
      message: `Cache has ${stats.captured} real prices and ${stats.estimated} estimates`
    });
  } catch (err) {
    console.error('[PriceController] Cache stats error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
};

export const clearEstimatedPrices = async (req, res) => {
  try {
    clearEstimates();
    const stats = getCacheStats();
    res.json({
      success: true,
      message: 'Estimates cleared',
      stats
    });
  } catch (err) {
    console.error('[PriceController] Clear error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
};

export const comparePrices = async (req, res) => {
  try {
    const userId = req.user.userId;
    const refresh = req.query.refresh === '1';
    const skipItems = req.body?.skipItems || [];

    const [plans] = await pool.query(
      'SELECT * FROM meal_plans WHERE user_id = ? ORDER BY created_at DESC LIMIT 1',
      [userId]
    );

    if (plans.length === 0) {
      return res.status(404).json({ error: 'No meal plan found' });
    }

    const planData = typeof plans[0].plan_data === 'string' 
        ? JSON.parse(plans[0].plan_data) 
        : plans[0].plan_data;

    if (!planData.shoppingList || planData.shoppingList.length === 0) {
        return res.status(400).json({ error: 'Meal plan has no shopping list' });
    }

    const skipSet = new Set(skipItems.map(i => String(i).toLowerCase().trim()));
    const filteredList = planData.shoppingList.filter(item => !skipSet.has(String(item.item).toLowerCase().trim()));
    if (filteredList.length === 0) {
      return res.status(400).json({ error: 'No items to compare after applying filters' });
    }

    const cachedComparison = planData.priceComparison;
    const cacheAgeMs = cachedComparison?.lastUpdated ? (Date.now() - new Date(cachedComparison.lastUpdated).getTime()) : null;
    const cacheValid = cacheAgeMs !== null && cacheAgeMs < 24 * 60 * 60 * 1000;
    const latestCapturedAt = getLatestCapturedAt();
    const cacheStaleByCapture = Boolean(
      latestCapturedAt &&
      cachedComparison?.lastUpdated &&
      new Date(latestCapturedAt).getTime() > new Date(cachedComparison.lastUpdated).getTime()
    );

    if (cachedComparison && cacheValid && !refresh && skipItems.length === 0 && !cacheStaleByCapture) {
      const flattened = [];
      const platforms = ['bigbasket', 'blinkit', 'zepto', 'instamart'];

      cachedComparison.results?.forEach(result => {
        platforms.forEach(platform => {
          if (result[platform] !== null && result[platform] !== undefined) {
            flattened.push({
              product_name: result.item,
              quantity: result.qty,
              platform: platform,
              price: result[platform],
              isEstimate: result.metadata?.[platform]?.isEstimate ?? true,
              matchedName: result.metadata?.[platform]?.matchedName || null,
              sourceUnit: result.metadata?.[platform]?.sourceUnit || null
            });
          }
        });
      });

      const foundCounts = platforms.reduce((acc, platform) => {
        acc[platform] = cachedComparison.results?.filter(r => r[platform] !== null && r[platform] !== undefined).length || 0;
        return acc;
      }, {});

      return res.json({
        items: flattened,
        totals: cachedComparison.totals,
        foundCounts,
        bestPlatform: cachedComparison.recommendation?.includes('Best platform') ? cachedComparison.recommendation : undefined,
        recommendation: cachedComparison.recommendation,
        totalItems: planData.shoppingList.length,
        cached: true,
        lastUpdated: cachedComparison.lastUpdated
      });
    }
    if (cacheStaleByCapture) {
      console.log('[PriceController] Cached comparison is older than latest captured price. Recomputing.');
    }

    console.log(`[PriceController] Comparing prices for ${filteredList.length} items...`);

    // Pass the plan ID so we can save the results back to DB
    const comparisonResults = await runComparison(filteredList, plans[0].id);

    // Flatten for frontend
    const flattened = [];
    comparisonResults.comparison.forEach(result => {
        // Add all available platforms
        const platforms = ['bigbasket', 'blinkit', 'zepto', 'instamart'];
        
        platforms.forEach(platform => {
          if (result[platform] !== null && result[platform] !== undefined) {
            flattened.push({
              product_name: result.item,
              quantity: result.qty,
              platform: platform,
              price: result[platform],
              isEstimate: result.metadata?.[platform]?.isEstimate ?? true,
              matchedName: result.metadata?.[platform]?.matchedName || null,
              sourceUnit: result.metadata?.[platform]?.sourceUnit || null
            });
          }
        });
    });

    res.json({
      items: flattened,
      totals: comparisonResults.totals,
      foundCounts: comparisonResults.foundCounts,
      bestPlatform: comparisonResults.bestPlatform,
      recommendation: comparisonResults.recommendation,
        totalItems: filteredList.length
    });
  } catch (err) {
    console.error('[PriceController] Compare error:', err);
    res.status(500).json({ error: 'Comparison failed: ' + err.message });
  }
};
