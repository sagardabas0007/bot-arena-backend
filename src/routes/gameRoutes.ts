import { Router } from 'express';
import { GameController } from '../controllers/gameController';
import { validateGameCreate, validateGameJoin, validateMove } from '../middleware/validateRequest';

const router = Router();

// GET /api/game/active OR /api/games/active - Get all active games
router.get('/active', GameController.getActiveGames);

// POST /api/game/create OR /api/games - Create a new game
router.post('/create', validateGameCreate, GameController.createGame);
router.post('/', validateGameCreate, GameController.createGame);

// POST /api/game/join OR /api/games/join - Join a bot to a game
router.post('/join', validateGameJoin, GameController.joinGame);

// GET /api/game/:id OR /api/games/:id - Get game state
router.get('/:id', GameController.getGame);

// POST /api/game/:id/move OR /api/games/:id/move - Submit a move
router.post('/:id/move', validateMove, GameController.submitMove);

// POST /api/games/:id/join - Join a specific game
router.post('/:id/join', validateGameJoin, GameController.joinGame);

// GET /api/game/:id/leaderboard OR /api/games/:id/leaderboard - Get game leaderboard
router.get('/:id/leaderboard', GameController.getGameLeaderboard);

export { router as gameRoutes };
export default router;
