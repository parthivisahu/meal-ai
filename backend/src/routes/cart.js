import express from 'express';
import { addToCart, initiateCheckout, getOrderHistory, cancelOrder } from '../controllers/cartController.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

// Cart operations
router.post('/add', addToCart);
router.post('/checkout', initiateCheckout);
router.post('/cancel', cancelOrder);

// Order history
router.get('/history', getOrderHistory);

export default router;
