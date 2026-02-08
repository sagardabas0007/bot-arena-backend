import { Router } from 'express';
import { BotController } from '../controllers/botController';
import { validateBotRegister } from '../middleware/validateRequest';

const router = Router();

// POST /api/bot/register - Register a new bot
router.post('/register', validateBotRegister, BotController.registerBot);

// GET /api/bot/leaderboard - Get global leaderboard
router.get('/leaderboard', BotController.getLeaderboard);

// GET /api/bot/:walletAddress - Get bot by wallet address
router.get('/:walletAddress', BotController.getBot);

export { router as botRoutes };
export default router;
