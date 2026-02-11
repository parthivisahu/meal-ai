import { addItemsToCart, checkoutCart, stopActiveAutomation } from '../services/cartAutomationService.js';
import { resolveItemName } from '../services/priceScrapingService.js';
import pool from '../config/database.js';

export const cancelOrder = async (req, res) => {
    try {
        const stopped = await stopActiveAutomation();
        if (stopped) {
            res.json({ success: true, message: 'Automation stopped successfully.' });
        } else {
            res.json({ success: false, message: 'No active automation found.' });
        }
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

export const addToCart = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { platform, mealPlanId, skipItems } = req.body;

    if (!platform || !['blinkit', 'bigbasket', 'zepto'].includes(platform)) {
      return res.status(400).json({ 
        error: 'Invalid platform. Choose: blinkit, bigbasket, or zepto' 
      });
    }

    // Get meal plan
    const [plans] = await pool.query(
      'SELECT * FROM meal_plans WHERE id = ? AND user_id = ?',
      [mealPlanId, userId]
    );

    if (plans.length === 0) {
      return res.status(404).json({ error: 'Meal plan not found' });
    }

    const planData = typeof plans[0].plan_data === 'string' 
      ? JSON.parse(plans[0].plan_data) 
      : plans[0].plan_data;

    if (!planData.shoppingList || planData.shoppingList.length === 0) {
      return res.status(400).json({ error: 'Shopping list is empty' });
    }

    const skipSet = new Set((skipItems || []).map(i => String(i).toLowerCase().trim()));
    const filteredList = planData.shoppingList.filter(item => !skipSet.has(String(item.item).toLowerCase().trim()));
    if (filteredList.length === 0) {
      return res.status(400).json({ error: 'All items are marked as have it' });
    }

    // RESOLVE BEST MATCH NAMES
    // Convert generic "Milk" -> "Amul Taaza Milk" if we have it in cache
    console.log(`[Cart] Resolving product names for ${platform}...`);
    const optimizedList = await Promise.all(filteredList.map(async (item) => {
        const bestName = await resolveItemName(platform, item.item);
        if (bestName !== item.item) {
            console.log(`[Cart] Map: "${item.item}" -> "${bestName}"`);
        }
        return { 
            item: bestName, 
            qty: item.qty 
        };
    }));

    console.log(`[Cart] Starting cart automation for ${platform}...`);

    // Start automation with optimized list
    const result = await addItemsToCart(platform, optimizedList);
    const instamartBlocked = result.details?.some(d => d.reason === 'instamart_blocked');

    res.json({
      success: true,
      platform,
      itemsAdded: result.added,
      itemsFailed: result.failed,
      totalItems: result.total,
      details: result.details,
      message: instamartBlocked
        ? 'Instamart blocked automation. Please add items manually in the opened browser.'
        : 'Browser opened with items in cart. Complete checkout manually.',
      manualRequired: instamartBlocked
    });

  } catch (error) {
    console.error('[Cart] Add to cart error:', error);
    res.status(500).json({ error: 'Failed to add items to cart: ' + error.message });
  }
};

export const initiateCheckout = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { platform, mealPlanId } = req.body;

    if (!platform || !['blinkit', 'bigbasket', 'zepto'].includes(platform)) {
      return res.status(400).json({ 
        error: 'Invalid platform. Choose: blinkit, bigbasket, or zepto' 
      });
    }

    // Get meal plan
    const [plans] = await pool.query(
      'SELECT * FROM meal_plans WHERE id = ? AND user_id = ?',
      [mealPlanId, userId]
    );

    if (plans.length === 0) {
      return res.status(404).json({ error: 'Meal plan not found' });
    }

    const planData = typeof plans[0].plan_data === 'string' 
      ? JSON.parse(plans[0].plan_data) 
      : plans[0].plan_data;

    if (!planData.shoppingList || planData.shoppingList.length === 0) {
      return res.status(400).json({ error: 'Shopping list is empty' });
    }

    console.log(`[Cart] Starting checkout automation for ${platform}...`);

    // Start automation with checkout
    const result = await checkoutCart(platform, planData.shoppingList);

    // Store order attempt
    await pool.query(
      'INSERT INTO order_attempts (user_id, meal_plan_id, platform, items_added, status) VALUES (?, ?, ?, ?, ?)',
      [userId, mealPlanId, platform, result.itemsAdded, 'pending_payment']
    );

    res.json({
      success: true,
      platform,
      itemsAdded: result.itemsAdded,
      itemsFailed: result.itemsFailed,
      checkout: result.checkout,
      message: 'Browser opened at checkout. Complete payment manually.'
    });

  } catch (error) {
    console.error('[Cart] Checkout error:', error);
    res.status(500).json({ error: 'Failed to initiate checkout: ' + error.message });
  }
};

export const getOrderHistory = async (req, res) => {
  try {
    const userId = req.user.userId;

    const [orders] = await pool.query(
      'SELECT * FROM order_attempts WHERE user_id = ? ORDER BY created_at DESC LIMIT 20',
      [userId]
    );

    res.json({
      success: true,
      orders
    });

  } catch (error) {
    console.error('[Cart] Order history error:', error);
    res.status(500).json({ error: 'Failed to fetch order history: ' + error.message });
  }
};
