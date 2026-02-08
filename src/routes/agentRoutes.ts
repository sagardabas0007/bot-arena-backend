import { Router } from 'express';
import { AgentController } from '../controllers/agentController';
import { agentAuthMiddleware } from '../middleware/agentAuth';
import {
  validateAgentRegister,
  validateAgentJoinGame,
  validateAgentCreateGame,
  validateAgentMove,
  validateGameIdParam,
} from '../middleware/validateAgentRequest';

const router = Router();

// Public route - no auth required
router.post('/register', validateAgentRegister, AgentController.register);

// All routes below require agent API key authentication
router.use(agentAuthMiddleware);

// Agent profile
router.get('/me', AgentController.getProfile);

// Arena discovery
router.get('/arenas', AgentController.listArenas);

// Game discovery
router.get('/games/waiting', AgentController.findWaitingGames);
router.get('/games/active', AgentController.getActiveGames);

// Game actions
router.post('/games/join', validateAgentJoinGame, AgentController.joinGame);
router.post('/games/create-and-join', validateAgentCreateGame, AgentController.createAndJoinGame);

// Game state and moves (parameterized routes last)
router.get('/games/:gameId/state', validateGameIdParam, AgentController.getGameState);
router.post('/games/:gameId/move', validateAgentMove, AgentController.submitMove);
router.get('/games/:gameId/path', validateGameIdParam, AgentController.getOptimalPath);
router.get('/games/:gameId/moves', validateGameIdParam, AgentController.getMoveHistory);
router.get('/games/:gameId/leaderboard', validateGameIdParam, AgentController.getGameLeaderboard);

// Stats
router.get('/stats', AgentController.getStats);

export { router as agentRoutes };
export default router;
