import pool from '../config/database.js';
import { generateMealPlan, generateSingleMeal } from '../services/mealPlanningService.js';

const parseNumericNoUnit = (qty) => {
  if (qty == null) return null;
  const raw = String(qty).trim();
  if (!raw) return null;
  if (/[a-z]/i.test(raw)) return null;
  const num = parseFloat(raw);
  if (!Number.isFinite(num) || num <= 0) return null;
  return num;
};

const parseCountQty = (qty) => {
  if (qty == null) return null;
  const raw = String(qty).trim().toLowerCase();
  if (!raw) return null;
  const num = parseFloat(raw);
  if (!Number.isFinite(num) || num <= 0) return null;
  if (/(pc|pcs|piece|pieces|unit|units|nos|no|clove|cloves)\b/.test(raw)) return num;
  if (!/[a-z]/.test(raw)) return num;
  return null;
};

const applyPiecePriceOverrides = (shoppingList) => {
  const rules = [
    { pattern: /green\s+chill?i/i, perPiecePrice: 2 },
    { pattern: /\blemon(s)?\b/i, perPiecePrice: 5 },
    { pattern: /\bgarlic\b/i, perPiecePrice: 2 }
  ];

  return shoppingList.map((item) => {
    const qtyNum = parseCountQty(item?.qty) ?? parseNumericNoUnit(item?.qty);
    if (!qtyNum) return item;

    const rule = rules.find(r => r.pattern.test(item?.item || ''));
    if (!rule) return item;

    const newPrice = Math.round(qtyNum * rule.perPiecePrice * 100) / 100;
    const currentPrice = Number(item?.price);

    if (!Number.isFinite(currentPrice) || currentPrice > newPrice * 3) {
      return { ...item, price: newPrice };
    }
    return item;
  });
};

export const createMealPlan = async (req, res) => {
  try {
    // Get user's household profiles
    const [profiles] = await pool.query(
      'SELECT * FROM household_profiles WHERE user_id = ?',
      [req.user.userId]
    );

    if (profiles.length === 0) {
      return res.status(400).json({ error: 'Please create household profiles first' });
    }

    console.log(`[MealPlan] Generating for ${profiles.length} profiles...`);

    // Get previous 2 weeks of plans for variety
    const [previousPlans] = await pool.query(
      `SELECT meals FROM plan_history 
       WHERE user_id = ? 
       ORDER BY plan_date DESC 
       LIMIT 2`,
      [req.user.userId]
    );

    const previousMeals = previousPlans.map(p => {
      try {
        return typeof p.meals === 'string' ? JSON.parse(p.meals) : p.meals;
      } catch (e) {
        console.warn('[MealPlan] Failed to parse previous meal:', e);
        return [];
      }
    }).filter(Boolean);

    console.log(`[MealPlan] Found ${previousMeals.length} previous weeks to avoid repetition`);

    // Generate meal plan using AI
    let mealPlan;
    let retryCount = 0;
    const maxRetries = 2;

    while (retryCount <= maxRetries) {
      try {
        console.log(`[MealPlan] Attempt ${retryCount + 1}/${maxRetries + 1}...`);
        mealPlan = await generateMealPlan(profiles, previousMeals);
        
        // Validate meal plan structure
        if (!mealPlan || typeof mealPlan !== 'object') {
          throw new Error('Invalid meal plan structure returned');
        }

        if (!mealPlan.weeklyMenu || !Array.isArray(mealPlan.weeklyMenu)) {
          throw new Error('weeklyMenu is missing or invalid');
        }

        if (mealPlan.weeklyMenu.length !== 7) {
          throw new Error(`Expected 7 days, got ${mealPlan.weeklyMenu.length}`);
        }

        console.log('[MealPlan] ✅ Generated successfully with', mealPlan.weeklyMenu.length, 'days');
        break;

      } catch (error) {
        retryCount++;
        console.error(`[MealPlan] Attempt ${retryCount} failed:`, error.message);
        
        if (retryCount > maxRetries) {
          throw new Error(`Failed after ${maxRetries + 1} attempts: ${error.message}`);
        }
        
        // Wait before retry
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

    // Ensure required fields with fallbacks
      if (!mealPlan.shoppingList || !Array.isArray(mealPlan.shoppingList)) {
        console.warn('[MealPlan] No valid shoppingList, using empty array');
        mealPlan.shoppingList = [];
      }
      mealPlan.shoppingList = applyPiecePriceOverrides(mealPlan.shoppingList);

    if (!mealPlan.reasoning || typeof mealPlan.reasoning !== 'string') {
      console.warn('[MealPlan] No valid reasoning, using default');
      mealPlan.reasoning = 'Meal plan generated based on your household preferences and dietary requirements.';
    }

      if (typeof mealPlan.totalCost !== 'number' || mealPlan.totalCost < 0) {
        console.warn('[MealPlan] Invalid totalCost, calculating from shopping list');
        mealPlan.totalCost = mealPlan.shoppingList.reduce((sum, item) => sum + (item.price || 0), 0);
      } else {
        mealPlan.totalCost = mealPlan.shoppingList.reduce((sum, item) => sum + (item.price || 0), 0);
      }

    if (!mealPlan.regionalDistribution) {
      mealPlan.regionalDistribution = {};
    }
    mealPlan.shoppingListStale = false;

    // Validate each day has all meals
    mealPlan.weeklyMenu.forEach((day, idx) => {
      if (!day.breakfast || !day.lunch || !day.dinner) {
        console.warn(`[MealPlan] Day ${idx + 1} missing meals`);
      }
    });

    // Save meal plan
    const weekStartDate = new Date().toISOString().split('T')[0];
    const [planResult] = await pool.query(
      'INSERT INTO meal_plans (user_id, plan_data, week_start_date) VALUES (?, ?, ?)',
      [req.user.userId, JSON.stringify(mealPlan), weekStartDate]
    );

    console.log('[MealPlan] Saved to database with ID:', planResult.insertId);

    // Save to history
    try {
      await pool.query(
        'INSERT INTO plan_history (user_id, plan_date, meals) VALUES (?, ?, ?)',
        [req.user.userId, weekStartDate, JSON.stringify(mealPlan.weeklyMenu)]
      );

      // Clean old history (keep only last 2 weeks)
      await pool.query(
        `DELETE FROM plan_history 
         WHERE user_id = ? 
         AND id NOT IN (
           SELECT id FROM (
             SELECT id FROM plan_history 
             WHERE user_id = ? 
             ORDER BY plan_date DESC 
             LIMIT 2
           ) AS keep
         )`,
        [req.user.userId, req.user.userId]
      );

      console.log('[MealPlan] History updated');
    } catch (historyError) {
      console.error('[MealPlan] History save failed (non-critical):', historyError.message);
    }

    // Log success metrics
    const uniqueDishes = new Set();
    mealPlan.weeklyMenu.forEach(day => {
      ['breakfast', 'lunch', 'dinner'].forEach(meal => {
        if (day[meal]?.name) uniqueDishes.add(day[meal].name);
      });
    });

    console.log('[MealPlan] ✅ Success metrics:', {
      uniqueDishes: uniqueDishes.size,
      shoppingItems: mealPlan.shoppingList.length,
      estimatedCost: mealPlan.totalCost,
      profiles: profiles.length
    });

    res.status(201).json({
      message: 'Meal plan created successfully',
      mealPlan: {
        id: planResult.insertId,
        user_id: req.user.userId,
        plan_data: mealPlan,
        week_start_date: weekStartDate,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      },
      planId: planResult.insertId,
      stats: {
        uniqueDishes: uniqueDishes.size,
        totalItems: mealPlan.shoppingList.length,
        estimatedCost: mealPlan.totalCost
      }
    });

  } catch (error) {
    console.error('[MealPlan] ❌ Create error:', error);
    
    // Send user-friendly error message
    let errorMessage = 'Failed to generate meal plan';
    
    if (error.message.includes('400')) {
      errorMessage = 'AI service error. Please try again in a moment.';
    } else if (error.message.includes('Invalid meal plan')) {
      errorMessage = 'Generated plan was invalid. Please try again.';
    } else if (error.message.includes('json')) {
      errorMessage = 'AI response format error. Please try again.';
    }

    res.status(500).json({ 
      error: errorMessage,
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

export const getMealPlans = async (req, res) => {
  try {
    const [plans] = await pool.query(
      'SELECT * FROM meal_plans WHERE user_id = ? ORDER BY created_at DESC LIMIT 10',
      [req.user.userId]
    );

      const formattedPlans = plans.map(plan => {
        let planData;
        try {
          planData = typeof plan.plan_data === 'string' ? JSON.parse(plan.plan_data) : plan.plan_data;
        } catch (e) {
          console.error('[MealPlan] Failed to parse plan data:', e);
          planData = { weeklyMenu: [], shoppingList: [], error: 'Failed to load plan data' };
        }
        if (Array.isArray(planData.shoppingList)) {
          planData.shoppingList = applyPiecePriceOverrides(planData.shoppingList);
          planData.totalCost = planData.shoppingList.reduce((sum, item) => sum + (item.price || 0), 0);
        }

        return {
          ...plan,
          week_start_date: new Date(plan.week_start_date).toISOString().split('T')[0],
          plan_data: planData
      };
    });

    res.json({ mealPlans: formattedPlans });
  } catch (error) {
    console.error('[MealPlan] Get error:', error);
    res.status(500).json({ error: 'Failed to fetch meal plans' });
  }
};

export const getMealPlanById = async (req, res) => {
  const { id } = req.params;

  try {
    const [plans] = await pool.query(
      'SELECT * FROM meal_plans WHERE id = ? AND user_id = ?',
      [id, req.user.userId]
    );

    if (plans.length === 0) {
      return res.status(404).json({ error: 'Meal plan not found' });
    }

    let planData;
      try {
        planData = typeof plans[0].plan_data === 'string' 
          ? JSON.parse(plans[0].plan_data) 
          : plans[0].plan_data;
      } catch (e) {
        console.error('[MealPlan] Failed to parse plan data:', e);
        planData = { weeklyMenu: [], shoppingList: [], error: 'Failed to load plan data' };
      }
      if (Array.isArray(planData.shoppingList)) {
        planData.shoppingList = applyPiecePriceOverrides(planData.shoppingList);
        planData.totalCost = planData.shoppingList.reduce((sum, item) => sum + (item.price || 0), 0);
      }

    const plan = {
      ...plans[0],
      week_start_date: new Date(plans[0].week_start_date).toISOString().split('T')[0],
      plan_data: planData
    };

    res.json({ mealPlan: plan });
  } catch (error) {
    console.error('[MealPlan] Get by ID error:', error);
    res.status(500).json({ error: 'Failed to fetch meal plan' });
  }
};

export const regenerateMealPlan = async (req, res) => {
  const { id } = req.params;

  try {
    // Get existing plan to maintain week_start_date
    const [existingPlan] = await pool.query(
      'SELECT week_start_date FROM meal_plans WHERE id = ? AND user_id = ?',
      [id, req.user.userId]
    );

    if (existingPlan.length === 0) {
      return res.status(404).json({ error: 'Meal plan not found' });
    }

    // Get profiles
    const [profiles] = await pool.query(
      'SELECT * FROM household_profiles WHERE user_id = ?',
      [req.user.userId]
    );

    if (profiles.length === 0) {
      return res.status(400).json({ error: 'Please create household profiles first' });
    }

    // Get previous meals (excluding the one being regenerated)
    const [previousPlans] = await pool.query(
      `SELECT meals FROM plan_history 
       WHERE user_id = ? 
       AND id != ?
       ORDER BY plan_date DESC 
       LIMIT 2`,
      [req.user.userId, id]
    );

    const previousMeals = previousPlans.map(p => {
      try {
        return typeof p.meals === 'string' ? JSON.parse(p.meals) : p.meals;
      } catch (e) {
        return [];
      }
    }).filter(Boolean);

    console.log('[MealPlan] Regenerating plan', id);

    // Generate new meal plan
    const mealPlan = await generateMealPlan(profiles, previousMeals);

      // Ensure defaults
      mealPlan.shoppingList = mealPlan.shoppingList || [];
      mealPlan.shoppingList = applyPiecePriceOverrides(mealPlan.shoppingList);
      mealPlan.reasoning = mealPlan.reasoning || 'Regenerated meal plan based on your preferences.';
      mealPlan.totalCost = mealPlan.shoppingList.reduce((sum, item) => sum + (item.price || 0), 0);
      mealPlan.shoppingListStale = false;

    // Update existing plan
    await pool.query(
      'UPDATE meal_plans SET plan_data = ? WHERE id = ? AND user_id = ?',
      [JSON.stringify(mealPlan), id, req.user.userId]
    );

    // Update history
    await pool.query(
      'UPDATE plan_history SET meals = ? WHERE user_id = ? AND plan_date = ?',
      [JSON.stringify(mealPlan.weeklyMenu), req.user.userId, existingPlan[0].week_start_date]
    );

    console.log('[MealPlan] ✅ Regenerated successfully');

    res.json({
      message: 'Meal plan regenerated successfully',
      mealPlan: {
        id: parseInt(id),
        user_id: req.user.userId,
        plan_data: mealPlan,
        week_start_date: new Date(existingPlan[0].week_start_date).toISOString().split('T')[0],
        updated_at: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('[MealPlan] Regenerate error:', error);
    res.status(500).json({ error: 'Failed to regenerate meal plan: ' + error.message });
  }
};

export const replaceMeal = async (req, res) => {
  const { id } = req.params;
  const { dayIndex, mealType } = req.body;

  if (dayIndex === undefined || !mealType) {
    return res.status(400).json({ error: 'dayIndex and mealType are required' });
  }
  if (!['breakfast', 'lunch', 'dinner'].includes(mealType)) {
    return res.status(400).json({ error: 'mealType must be breakfast, lunch, or dinner' });
  }
  const dayIdx = parseInt(dayIndex);
  if (Number.isNaN(dayIdx)) {
    return res.status(400).json({ error: 'dayIndex must be a number' });
  }

  try {
    const [plans] = await pool.query(
      'SELECT * FROM meal_plans WHERE id = ? AND user_id = ?',
      [id, req.user.userId]
    );

    if (plans.length === 0) {
      return res.status(404).json({ error: 'Meal plan not found' });
    }

    const [profiles] = await pool.query(
      'SELECT * FROM household_profiles WHERE user_id = ?',
      [req.user.userId]
    );

    if (profiles.length === 0) {
      return res.status(400).json({ error: 'Please create household profiles first' });
    }

    const planData = typeof plans[0].plan_data === 'string'
      ? JSON.parse(plans[0].plan_data)
      : plans[0].plan_data;

    if (!planData.weeklyMenu || !planData.weeklyMenu[dayIdx]) {
      return res.status(400).json({ error: 'Invalid dayIndex' });
    }

    const avoidDishes = [];
    planData.weeklyMenu.forEach(day => {
      ['breakfast', 'lunch', 'dinner'].forEach(type => {
        const name = day[type]?.name;
        if (name) avoidDishes.push(name);
      });
    });

    const newMeal = await generateSingleMeal({
      profiles,
      mealType,
      avoidDishes
    });

    planData.weeklyMenu[dayIdx][mealType] = newMeal;
    planData.shoppingListStale = true;

    await pool.query(
      'UPDATE meal_plans SET plan_data = ? WHERE id = ? AND user_id = ?',
      [JSON.stringify(planData), id, req.user.userId]
    );

    res.json({
      message: 'Meal replaced successfully',
      mealPlan: {
        id: parseInt(id),
        user_id: req.user.userId,
        plan_data: planData,
        week_start_date: new Date(plans[0].week_start_date).toISOString().split('T')[0],
        updated_at: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('[MealPlan] Replace meal error:', error);
    res.status(500).json({ error: 'Failed to replace meal: ' + error.message });
  }
};

export const cookNow = async (req, res) => {
  try {
    const [profiles] = await pool.query(
      'SELECT * FROM household_profiles WHERE user_id = ?',
      [req.user.userId]
    );

    if (profiles.length === 0) {
      return res.status(400).json({ error: 'Please create household profiles first' });
    }

    let mealType = (req.body?.mealType || '').toString().trim().toLowerCase();
    if (!['breakfast', 'lunch', 'dinner'].includes(mealType)) {
      const hour = new Date().getHours();
      if (hour >= 5 && hour < 11) mealType = 'breakfast';
      else if (hour >= 11 && hour < 16) mealType = 'lunch';
      else mealType = 'dinner';
    }

    let avoidDishes = [];
    try {
      const [plans] = await pool.query(
        'SELECT plan_data FROM meal_plans WHERE user_id = ? ORDER BY created_at DESC LIMIT 1',
        [req.user.userId]
      );
      if (plans.length > 0) {
        const planData = typeof plans[0].plan_data === 'string'
          ? JSON.parse(plans[0].plan_data)
          : plans[0].plan_data;
        if (planData?.weeklyMenu) {
          const names = [];
          planData.weeklyMenu.forEach(day => {
            ['breakfast', 'lunch', 'dinner'].forEach(type => {
              const name = day?.[type]?.name;
              if (name) names.push(name);
            });
          });
          avoidDishes = names.slice(0, 50);
        }
      }
    } catch (e) {
      console.warn('[CookNow] Failed to build avoid list:', e.message);
    }

    const meal = await generateSingleMeal({
      profiles,
      mealType,
      avoidDishes
    });

    res.json({ mealType, meal });
  } catch (error) {
    console.error('[CookNow] Error:', error);
    res.status(500).json({ error: 'Failed to generate cook now meal: ' + error.message });
  }
};
