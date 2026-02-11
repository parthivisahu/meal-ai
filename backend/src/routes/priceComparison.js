import express from 'express';
import { ingestPrice, comparePrices } from '../controllers/priceComparisonController.js';
import { authenticateToken, optionalAuth } from '../middleware/auth.js';

const router = express.Router();

// Ingest route with optional auth (works with or without token)
router.post('/ingest', optionalAuth, ingestPrice);

// Protected routes (require auth)
router.use(authenticateToken);
router.get('/compare', comparePrices);
router.post('/compare', comparePrices);

export default router;
