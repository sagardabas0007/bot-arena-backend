import { Router } from 'express';
import { GameController } from '../controllers/gameController';
import { validateGameCreate, validateGameJoin, validateMove } from '../middleware/validateRequest';

const router = Router();

// POST /api/game/create - Create a new game
router.post('/create', validateGameCreate, GameController.createGame);

// POST /api/game/join - Join a bot to a game
router.post('/join', validateGameJoin, GameController.joinGame);

// GET /api/game/:id - Get game state
router.get('/:id', GameController.getGame);

// POST /api/game/:id/move - Submit a move
router.post('/:id/move', validateMove, GameController.submitMove);

// GET /api/game/:id/leaderboard - Get game leaderboard
router.get('/:id/leaderboard', GameController.getGameLeaderboard);

export { router as gameRoutes };
export default router;
