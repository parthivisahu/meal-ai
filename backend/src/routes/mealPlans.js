import express from 'express';
import { 
  createMealPlan, 
  getMealPlans, 
  getMealPlanById,
  regenerateMealPlan,
  replaceMeal,
  cookNow
} from '../controllers/mealPlanController.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

// Create new meal plan
router.post('/', createMealPlan);

// Cook now (single meal)
router.post('/cook-now', cookNow);

// Get all meal plans for user
router.get('/', getMealPlans);

// Get specific meal plan by ID
router.get('/:id', getMealPlanById);

// Regenerate existing meal plan
router.post('/:id/regenerate', regenerateMealPlan);
// Replace a single meal in a plan
router.post('/:id/replace-meal', replaceMeal);

export default router;
