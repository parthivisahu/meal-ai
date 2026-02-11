import dotenv from 'dotenv';
import PQueue from 'p-queue';
import { scrapePrice, cleanItemName } from './priceScrapingService.js';
import pool from '../config/database.js';
import { chatJson } from './llmService.js';

dotenv.config();

export const generateMealPlan = async (profiles, previousMeals = []) => {
  try {
    console.log('Previous Meals received by generateMealPlan:', previousMeals);
    
    // Extract ALL previous meal names to avoid ANY repetition
    const previousMealNames = new Set();
    if (previousMeals.length > 0) {
      previousMeals.forEach(week => {
        week.forEach(day => {
          if (day?.breakfast?.name) previousMealNames.add(day.breakfast.name.toLowerCase().trim());
          if (day?.lunch?.name) previousMealNames.add(day.lunch.name.toLowerCase().trim());
          if (day?.dinner?.name) previousMealNames.add(day.dinner.name.toLowerCase().trim());
        });
      });
    }

    const previousMealsText = previousMealNames.size > 0
      ? `STRICTLY FORBIDDEN DISHES (already used): ${Array.from(previousMealNames).join(', ')}`
      : 'None - this is the first plan';

    const householdInfo = profiles.map((p, index) => 
      `Member ${index + 1} (${p.name}): Region: ${p.region}, Diet: ${p.diet_type}, Allergies: ${p.allergies || 'None'}, Dislikes: ${p.dislikes || 'None'}, Likes: ${p.likes || 'None'}, Comfort Foods: ${p.comfort_foods || 'None'}, Cooking Time: ${p.cooking_time || 60} mins`
    ).join('\n');

    const combinedBudget = profiles.reduce((sum, p) => sum + (parseInt(p.budget) || 0), 0);
    const householdSize = profiles.length;

    // Build comprehensive constraint list
    const allergies = [...new Set(profiles.flatMap(p => (p.allergies || '').split(',').map(a => a.trim())).filter(Boolean))];
    const dislikes = [...new Set(profiles.flatMap(p => (p.dislikes || '').split(',').map(d => d.trim())).filter(Boolean))];
    const likes = [...new Set(profiles.flatMap(p => (p.likes || '').split(',').map(l => l.trim())).filter(Boolean))];
    const comfortFoods = [...new Set(profiles.flatMap(p => (p.comfort_foods || '').split(',').map(c => c.trim())).filter(Boolean))];
    const diets = [...new Set(profiles.map(p => p.diet_type))];
    const regions = [...new Set(profiles.map(p => p.region))];
    const maxCookingTime = Math.min(...profiles.map(p => parseInt(p.cooking_time) || 60));

    const normalizedDiets = diets
      .map(d => (d || '').toString().trim().toLowerCase())
      .filter(Boolean);
    const hasVegan = normalizedDiets.includes('vegan');
    const hasVegetarian = normalizedDiets.includes('veg') || normalizedDiets.includes('vegetarian');
    const hasEggetarian = normalizedDiets.includes('eggetarian') || normalizedDiets.includes('eggeterian');
    const hasNonVeg = normalizedDiets.includes('non-veg') || normalizedDiets.includes('nonveg') || normalizedDiets.includes('non vegetarian');

    const effectiveDietRule = hasVegan
      ? 'VEGAN: No meat, fish, eggs, or dairy.'
      : hasVegetarian
        ? 'STRICTLY VEGETARIAN: No meat, no fish, no eggs. Dairy is allowed.'
        : hasEggetarian
          ? 'EGGETARIAN: Vegetarian food plus eggs are allowed. No meat/fish.'
          : 'NON-VEGETARIAN: Meat, chicken, fish, eggs are all allowed.';
    const mustAvoidEggs = hasVegan || hasVegetarian;
    const mustAvoidDairy = hasVegan;

    // Detect current city from profile or IP (fallback to common Indian)
    const currentCity = profiles[0]?.city || 'Common Indian';

    // MASTER PROMPT with regional + local + common fusion
    console.log("Generating fusion meal plan (Regional + Local + Pan-Indian)...");
    
    const masterPrompt = `You are a world-class Indian meal planner who creates delicious, diverse, and culturally rich meal plans.

================================================================
HOUSEHOLD PROFILE (${householdSize} people):
================================================================
${householdInfo}

Current Location: ${currentCity}
Weekly Budget: INR ${combinedBudget}
Maximum Cooking Time: ${maxCookingTime} minutes per meal

================================================================
CRITICAL DIETARY REQUIREMENTS:
================================================================
Diets: ${diets.join(', ')}
${effectiveDietRule}
${mustAvoidEggs ? 'STRICT BAN: Do not include eggs or any egg-based dishes (omelette, French toast, scrambled eggs, etc.) in any meal.' : ''}
${mustAvoidDairy ? 'STRICT BAN: Do not include dairy (milk, ghee, butter, paneer, curd/yogurt, cheese, cream) in any meal.' : ''}

ALLERGIES (MANDATORY AVOIDANCE): ${allergies.length > 0 ? allergies.join(', ') : 'None'}
DISLIKES (AVOID): ${dislikes.length > 0 ? dislikes.join(', ') : 'None'}
LIKES (PRIORITIZE): ${likes.length > 0 ? likes.join(', ') : 'Open to all'}
COMFORT FOODS (PRIORITIZE WHEN POSSIBLE): ${comfortFoods.length > 0 ? comfortFoods.join(', ') : 'None'}

================================================================
CUISINE FUSION STRATEGY:
================================================================
You MUST create a fusion of:
1) REGIONAL SPECIALTIES (${regions.join(' + ')}):
   - Include authentic dishes from each member's home region
   - Example: If Punjabi, include Chole Bhature, Sarson ka Saag
   - Example: If Tamil, include Pongal, Sambar Rice, Appam
2) LOCAL CITY FAVORITES (${currentCity}):
   - Include popular street food and local specialties
3) PAN-INDIAN COMFORT FOOD:
   - Universal favorites: Dal Chawal, Khichdi, Pulao, simple Roti-Sabzi
   - Quick meals: Pasta, Maggi, Sandwich, Noodles
   - Popular across India: Biryani, Dosa, Paratha, Poha

WEEKLY DISTRIBUTION:
- 3 days: Regional specialties (rotate between members' regions)
- 2 days: Local city favorites
- 2 days: Pan-Indian/common favorites

================================================================
ZERO REPETITION POLICY:
================================================================
${previousMealsText}

- Every meal must be completely unique
- 21 different dishes (7 breakfasts + 7 lunches + 7 dinners)
- If roti appears Monday, use paratha/dosa/rice base other days
- Different sabzis/curries every single day

================================================================
RECIPE QUALITY STANDARDS:
================================================================
Every recipe MUST include:
- Precise measurements (1 cup, 2 tbsp, 1 tsp, 200g)
- No vague ingredients ("Vegetables" -> "Carrot", "Beans", "Peas")
- Step-by-step timing (e.g., "Saute for 5 minutes until golden")
- Visual cues (e.g., "Until onions turn translucent")
- Temperature guides (medium heat, high flame, low simmer)
- Technique details (fold gently vs stir vigorously)
- Serves: always mention "Serves ${householdSize}"
- Optional alternative suggestions

CRITICAL: You MUST respond with valid JSON only. No extra text outside JSON.

================================================================
MEAL STRUCTURE (7-DAY VARIETY):
================================================================
BREAKFASTS (Light to Medium, 15-30 mins):
- Day 1: South Indian (Idli/Dosa/Uttapam/Appam)
- Day 2: North Indian (Paratha stuffed/Puri Bhaji)
- Day 3: Western Indian (Poha/Upma/Dhokla)
- Day 4: Continental/Quick (${mustAvoidEggs ? 'Sandwich/Toast/Oats/Smoothie Bowl' : 'Sandwich/Omelette/French Toast'})
- Day 5: Regional specialty from Member 1
- Day 6: Regional specialty from Member 2
- Day 7: Local city favorite

LUNCHES (Substantial, rice-based preferred):
- 2 days: Dal-Rice combinations (different dals each day)
- 2 days: One-pot rice (Biryani/Pulao/Khichdi/Lemon Rice)
- 1 day: Regional rice specialty
- 1 day: Roti + substantial curry
- 1 day: Local favorite

DINNERS (Moderate, roti-based preferred):
- 3 days: Roti + different sabzis
- 2 days: Paratha varieties with raita/curry
- 1 day: Rice-based (Curd Rice/Khichdi/Fried Rice)
- 1 day: Regional/local specialty

SHOPPING LIST REQUIREMENTS (CRITICAL):
- Use only necessary items used in weeklyMenu
- No zero quantities or prices
- If Vegan or Vegetarian, do not include egg
- If Vegan, do not include dairy (milk, ghee, butter, paneer, curd)
- Consolidate quantities of the same item
- item: generic product name only (no brands or qty in item field)
- qty: total consolidated quantity with unit
- price: realistic market price estimate in INR

================================================================
EXAMPLE RECIPE FORMAT (MANDATORY):
================================================================
{
  "name": "Masala Dosa with Sambar",
  "ingredients": [
    "1.5 cups dosa batter (fermented)",
    "2 medium potatoes (boiled and mashed)",
    "1 medium onion (finely chopped)",
    "2 green chilies (slit)",
    "1 tsp mustard seeds",
    "1 tsp urad dal",
    "8-10 curry leaves",
    "1/2 tsp turmeric powder",
    "2 tbsp cooking oil",
    "Salt to taste",
    "Fresh coriander (for garnish)"
  ],
  "instructions": [
    "PREPARE MASALA FILLING: Heat 2 tbsp oil in a kadhai over medium flame (about 1 minute). Add 1 tsp mustard seeds and wait for them to crackle (30 seconds).",
    "Add 1 tsp urad dal and fry for 1 minute until golden. Add curry leaves and slit green chilies - they should sizzle immediately.",
    "Add finely chopped onions and saute for 4-5 minutes until they turn soft and translucent (not brown).",
    "Add 1/2 tsp turmeric and mix well for 30 seconds. Add boiled, mashed potatoes and salt to taste.",
    "Mix everything thoroughly and cook for 2-3 minutes on low flame. The masala should be dry, not watery. Keep aside.",
    "MAKE DOSA: Heat a flat non-stick tawa on medium-high heat. Test readiness by sprinkling water drops - they should sizzle and evaporate immediately.",
    "Pour 1/2 cup dosa batter in the center. Using the back of the ladle, spread in circular motions from center to edges to form a thin 8-inch circle.",
    "Drizzle 1 tsp oil around the edges and a few drops on top. Cook for 2 minutes until the edges start lifting and bottom turns golden brown.",
    "Place 2-3 tbsp of potato masala in the center of the dosa. Fold the dosa in half to form a semi-circle.",
    "Cook for 30 more seconds until crispy. Serve hot with coconut chutney and sambar."
  ],
  "time": "25 mins",
  "cals": "320 kcal per serving",
  "serves": "${householdSize}",
  "tips": "For crispier dosa, spread batter very thin. If batter is too thick, add a little water."
}

================================================================
JSON RESPONSE FORMAT (STRICTLY FOLLOW - RETURN ONLY JSON):
================================================================
{
  "weeklyMenu": [
    {
      "day": "Monday",
      "theme": "South Indian Breakfast + North Indian Lunch + Pan-Indian Dinner",
      "breakfast": { /* detailed recipe as shown above */ },
      "lunch": { /* detailed recipe */ },
      "dinner": { /* detailed recipe */ },
      "nutritionBalance": "High protein from dal, fiber from vegetables, carbs from rice and roti - balanced meal"
    }
  ],
  "shoppingList": [
    {"item": "Basmati Rice", "qty": "3kg", "price": 360}
  ],
  "regionalDistribution": {
    "${regions[0] || 'Regional 1'}": ["Monday Breakfast", "Thursday Dinner"]
  },
  "reasoning": "Explain why this plan matches the household preferences.",
  "totalCost": 1500
}

FINAL CHECKLIST:
- 21 completely unique dishes
- All regions represented (${regions.join(', ')})
- Local city favorites included
- Pan-Indian comfort food present
- Every recipe has precise measurements and clear steps
- No forbidden ingredients (allergies/dislikes)
- Diet restrictions followed
- Shopping list consolidated and complete
- All prices and quantities > 0
- Regional distribution balanced

IMPORTANT: Return ONLY a valid JSON object following the format above. Do not include any extra text.`;

    const mealPlan = await chatJson({
      messages: [{ role: 'user', content: masterPrompt }],
      task: 'meal',
      temperature: 0.85,
      maxTokens: 8000
    });

    if (!mealPlan || typeof mealPlan !== 'object') {
      throw new Error('Meal plan response was not valid JSON.');
    }
    
    const getMealText = (meal) => {
      if (!meal) return '';
      const parts = [];
      if (meal.name) parts.push(meal.name);
      if (Array.isArray(meal.ingredients)) parts.push(meal.ingredients.join(' '));
      return parts.join(' ').toLowerCase();
    };

    const findDietViolations = () => {
      const violations = [];
      const eggPatterns = [
        /\begg(s)?\b/i,
        /\bomelet(te)?\b/i,
        /\bfrittata\b/i,
        /\bquiche\b/i,
        /\bfrench toast\b/i,
        /\bscrambled egg(s)?\b/i,
        /\bpoached egg(s)?\b/i
      ];
      const dairyPatterns = [
        /\bmilk\b/i,
        /\bghee\b/i,
        /\bbutter\b/i,
        /\bpaneer\b/i,
        /\bcurd\b/i,
        /\byogurt\b/i,
        /\bcheese\b/i,
        /\bcream\b/i
      ];

      mealPlan.weeklyMenu?.forEach(day => {
        ['breakfast', 'lunch', 'dinner'].forEach(mealType => {
          const meal = day[mealType];
          const text = getMealText(meal);
          if (!text) return;

          if (mustAvoidEggs && eggPatterns.some(re => re.test(text))) {
            violations.push(`${day.day} ${mealType}: egg content detected`);
          }
          if (mustAvoidDairy && dairyPatterns.some(re => re.test(text))) {
            violations.push(`${day.day} ${mealType}: dairy content detected`);
          }
        });
      });

      return violations;
    };

    // Validation: Check for within-week repetition
    const currentWeekDishes = new Set();
    let hasRepetition = false;
    
    if (mealPlan.weeklyMenu) {
      mealPlan.weeklyMenu.forEach(day => {
        ['breakfast', 'lunch', 'dinner'].forEach(mealType => {
          const dishName = day[mealType]?.name?.toLowerCase().trim();
          if (dishName) {
            if (currentWeekDishes.has(dishName)) {
              console.warn(`WARN: Repetition detected: "${dishName}" appears multiple times.`);
              hasRepetition = true;
            }
            currentWeekDishes.add(dishName);
          }
        });
      });
    }

    // Validation: Check recipe quality
    let qualityIssues = [];
    mealPlan.weeklyMenu?.forEach(day => {
      ['breakfast', 'lunch', 'dinner'].forEach(mealType => {
        const meal = day[mealType];
        if (meal) {
          if (!meal.ingredients || meal.ingredients.length < 3) {
            qualityIssues.push(`${day.day} ${mealType}: Too few ingredients`);
          }
          if (!meal.instructions || meal.instructions.length < 5) {
            qualityIssues.push(`${day.day} ${mealType}: Instructions too brief`);
          }
          if (!meal.time || !meal.cals) {
            qualityIssues.push(`${day.day} ${mealType}: Missing time or calories`);
          }
        }
      });
    });

    if (hasRepetition) {
      console.warn('WARN: Meal plan has repetitions. Consider regenerating.');
    } else {
      console.log('OK: Meal plan is diverse - no repetitions detected.');
    }

    if (qualityIssues.length > 0) {
      console.warn('WARN: Recipe quality issues:', qualityIssues);
    } else {
      console.log('OK: All recipes meet quality standards.');
    }

    const dietViolations = findDietViolations();
    if (dietViolations.length > 0) {
      console.warn('WARN: Diet violations detected:', dietViolations);
      throw new Error(`Diet violations detected: ${dietViolations.join('; ')}`);
    }

    // Ensure defaults
    mealPlan.shoppingList = mealPlan.shoppingList || [];
    mealPlan.reasoning = mealPlan.reasoning || "Meal plan generated based on preferences.";
    mealPlan.totalCost = typeof mealPlan.totalCost === 'number' ? mealPlan.totalCost : 0;
    mealPlan.regionalDistribution = mealPlan.regionalDistribution || {};

    console.log('OK: Generated fusion meal plan with', currentWeekDishes.size, 'unique dishes');
    return mealPlan;

  } catch (error) {
    console.error('Meal plan generation error:', error);
    throw new Error('Failed to generate meal plan: ' + error.message);
  }
};

export const generateSingleMeal = async ({ profiles, mealType, avoidDishes = [] }) => {
  try {
    const householdInfo = profiles.map((p, index) =>
      `Member ${index + 1} (${p.name}): Region: ${p.region}, Diet: ${p.diet_type}, Allergies: ${p.allergies || 'None'}, Dislikes: ${p.dislikes || 'None'}, Likes: ${p.likes || 'None'}, Comfort Foods: ${p.comfort_foods || 'None'}, Cooking Time: ${p.cooking_time || 60} mins`
    ).join('\n');

    const householdSize = profiles.length;
    const allergies = [...new Set(profiles.flatMap(p => (p.allergies || '').split(',').map(a => a.trim())).filter(Boolean))];
    const dislikes = [...new Set(profiles.flatMap(p => (p.dislikes || '').split(',').map(d => d.trim())).filter(Boolean))];
    const likes = [...new Set(profiles.flatMap(p => (p.likes || '').split(',').map(l => l.trim())).filter(Boolean))];
    const comfortFoods = [...new Set(profiles.flatMap(p => (p.comfort_foods || '').split(',').map(c => c.trim())).filter(Boolean))];
    const diets = [...new Set(profiles.map(p => p.diet_type))];
    const maxCookingTime = Math.min(...profiles.map(p => parseInt(p.cooking_time) || 60));

    const normalizedDiets = diets
      .map(d => (d || '').toString().trim().toLowerCase())
      .filter(Boolean);
    const hasVegan = normalizedDiets.includes('vegan');
    const hasVegetarian = normalizedDiets.includes('veg') || normalizedDiets.includes('vegetarian');
    const hasEggetarian = normalizedDiets.includes('eggetarian') || normalizedDiets.includes('eggeterian');
    const effectiveDietRule = hasVegan
      ? 'VEGAN: No meat, fish, eggs, or dairy.'
      : hasVegetarian
        ? 'STRICTLY VEGETARIAN: No meat, no fish, no eggs. Dairy is allowed.'
        : hasEggetarian
          ? 'EGGETARIAN: Vegetarian food plus eggs are allowed. No meat/fish.'
          : 'NON-VEGETARIAN: Meat, chicken, fish, eggs are all allowed.';
    const mustAvoidEggs = hasVegan || hasVegetarian;
    const mustAvoidDairy = hasVegan;

    const avoidText = avoidDishes.length > 0
      ? `STRICTLY FORBIDDEN DISHES: ${avoidDishes.join(', ')}`
      : 'None';

    const prompt = `You are a world-class Indian meal planner.

Generate ONE ${mealType.toUpperCase()} recipe as JSON with the following format:
{
  "name": "Dish Name",
  "ingredients": ["..."],
  "instructions": ["..."],
  "time": "25 mins",
  "cals": "320 kcal per serving",
  "serves": "${householdSize}",
  "tips": "..."
}

HOUSEHOLD PROFILE (${householdSize} people):
${householdInfo}

Maximum Cooking Time: ${maxCookingTime} minutes

DIET RULES:
${effectiveDietRule}
${mustAvoidEggs ? 'STRICT BAN: Do not include eggs or egg-based dishes.' : ''}
${mustAvoidDairy ? 'STRICT BAN: Do not include dairy (milk, ghee, butter, paneer, curd/yogurt, cheese, cream).' : ''}

ALLERGIES (MANDATORY AVOIDANCE): ${allergies.length > 0 ? allergies.join(', ') : 'None'}
DISLIKES (AVOID): ${dislikes.length > 0 ? dislikes.join(', ') : 'None'}
LIKES (PRIORITIZE): ${likes.length > 0 ? likes.join(', ') : 'Open to all'}
COMFORT FOODS (PRIORITIZE WHEN POSSIBLE): ${comfortFoods.length > 0 ? comfortFoods.join(', ') : 'None'}

${avoidText}

RECIPE QUALITY:
- Precise measurements
- Step-by-step timing and cues
- No vague ingredients
- Appropriate for ${mealType}

Return ONLY valid JSON.`;

    const meal = await chatJson({
      messages: [{ role: 'user', content: prompt }],
      task: 'meal',
      temperature: 0.7,
      maxTokens: 1200
    });

    if (!meal || typeof meal !== 'object') {
      throw new Error('Single meal response was not valid JSON.');
    }

    return meal;
  } catch (error) {
    console.error('Single meal generation error:', error);
    throw new Error('Failed to generate meal: ' + error.message);
  }
};

// --- PRICE CALCULATION UTILS ---

const parseQty = (qtyStr) => {
  if (!qtyStr) return { val: 1, unit: 'unit' };
  const val = parseFloat(qtyStr);
  const unit = qtyStr.replace(/[0-9.]/g, '').toLowerCase().trim();
  
  if (unit === 'g' || unit === 'gm') return { val: val / 1000, unit: 'kg' };
  if (unit === 'ml') return { val: val / 1000, unit: 'l' };
  if (unit === 'kg' || unit === 'l' || unit === 'litre') return { val, unit: unit[0] };
  
  return { val, unit: 'unit' };
};

const calculateTotal = (scraped, targetQtyStr) => {
  if (!scraped || scraped.price == null) return null;
  
  const target = parseQty(targetQtyStr);
  const source = parseQty(scraped.unit);
  
  let finalPrice = scraped.price;

  if (target.unit === source.unit) {
    const pricePerUnit = scraped.price / source.val;
    finalPrice = Math.round(pricePerUnit * target.val * 100) / 100;
  }
  
  const isEst = scraped.isEstimate === true;
  
  return { price: finalPrice, isEstimate: isEst };
};

export const comparePrices = async (shoppingList, mealPlanId = null) => {
  try {
    const comparisonResults = [];
    const totals = {
      bigbasket: 0,
      blinkit: 0,
      zepto: 0,
      instamart: 0
    };
    const foundCounts = {
      bigbasket: 0,
      blinkit: 0,
      zepto: 0,
      instamart: 0
    };

    console.log(`\nCART: Comparing prices for ${shoppingList.length} items...\n`);

    const queue = new PQueue({ concurrency: 5 });
    const platforms = ['bigbasket', 'blinkit', 'zepto', 'instamart'];
    const localCache = new Map();

    const tasks = shoppingList.map(item => {
      return queue.add(async () => {
        const searchName = cleanItemName(item.item);
        
        const pricePromises = platforms.map(async (platform) => {
          const cacheKey = `${platform}:${searchName}`;
          if (localCache.has(cacheKey)) {
            return { platform, price: localCache.get(cacheKey) };
          }
          try {
            const price = await scrapePrice(platform, searchName, { allowAiMatch: false });
            localCache.set(cacheKey, price);
            return { platform, price };
          } catch {
            return { platform, price: null };
          }
        });

        const results = await Promise.all(pricePromises);
        
        const itemComparison = {
          item: item.item,
          qty: item.qty
        };

        results.forEach(({ platform, price }) => {
          const calculated = calculateTotal(price, item.qty);
          itemComparison[platform] = calculated?.price || null;
          
          if (!itemComparison.isEstimate) itemComparison.isEstimate = {};
          itemComparison.isEstimate[platform] = calculated?.isEstimate || false;

          if (calculated?.price !== null) {
            totals[platform] += calculated.price;
            foundCounts[platform]++;
          }
        });

        comparisonResults.push(itemComparison);
      });
    });

    await Promise.all(tasks);

    const totalItems = shoppingList.length;
    const validPlatforms = platforms.filter(platform => {
      const coverage = foundCounts[platform] / totalItems;
      return coverage >= 0.5;
    });

    let bestPlatform = 'N/A';
    let minTotal = Infinity;

    if (validPlatforms.length > 0) {
      validPlatforms.forEach(platform => {
        if (totals[platform] < minTotal) {
          minTotal = totals[platform];
          bestPlatform = platform;
        }
      });
    }

    let recommendation = "Could not compare prices due to insufficient data.";
    
    if (bestPlatform !== 'N/A') {
      const missingCount = totalItems - foundCounts[bestPlatform];
      recommendation = `OK: Best platform: ${bestPlatform.toUpperCase()} - INR ${minTotal.toFixed(2)}`;
      if (missingCount > 0) recommendation += ` (${missingCount} missing)`;
    }
    
    // SAVE RESULTS TO DB
    if (mealPlanId) {
        try {
            // 1. Fetch current plan data
            const [rows] = await pool.query('SELECT plan_data FROM meal_plans WHERE id = ?', [mealPlanId]);
            if (rows.length > 0) {
                const planData = typeof rows[0].plan_data === 'string' 
                    ? JSON.parse(rows[0].plan_data) 
                    : rows[0].plan_data;

                // 2. Update Shopping List Prices with REAL prices from best platform (or lowest available)
                // This converts "Estimated Cost" to "Real Cost" for next load
                planData.shoppingList = planData.shoppingList.map((item, idx) => {
                    const comp = comparisonResults[idx];
                    let bestPrice = item.price; // fallback to original estimate
                    
                    // Try to use best platform price
                    if (bestPlatform !== 'N/A' && comp[bestPlatform] !== null) {
                        bestPrice = comp[bestPlatform];
                    } else {
                        // Or lowest available
                        const prices = platforms
                            .map(p => comp[p])
                            .filter(p => p !== null)
                            .sort((a, b) => a - b);
                        if (prices.length > 0) bestPrice = prices[0];
                    }
                    
                    return { ...item, price: bestPrice };
                });

                // 3. Update Total Cost
                planData.totalCost = planData.shoppingList.reduce((sum, item) => sum + (item.price || 0), 0);

                // 4. Attach Comparison Data
                planData.priceComparison = {
                    results: comparisonResults,
                    totals: totals,
                    recommendation: recommendation,
                    lastUpdated: new Date().toISOString()
                };
                planData.shoppingListStale = false;

                // 5. Save back to DB
                await pool.query('UPDATE meal_plans SET plan_data = ? WHERE id = ?', [JSON.stringify(planData), mealPlanId]);
                console.log(`[DB] Saved price comparison to Meal Plan #${mealPlanId}`);
            }
        } catch (dbErr) {
            console.error('[DB] Failed to save price comparison:', dbErr.message);
        }
    }
    
    return {
      comparison: comparisonResults,
      totals: totals,
      foundCounts: foundCounts,
      bestPlatform: bestPlatform,
      recommendation: recommendation
    };

  } catch (error) {
    console.error('Price comparison error:', error);
    throw new Error('Failed to compare prices: ' + error.message);
  }
};

