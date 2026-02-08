import { Router } from 'express';
import { ArenaController } from '../controllers/arenaController';

const router = Router();

// GET /api/arena/list - List all arenas
router.get('/list', ArenaController.listArenas);

// POST /api/arena/seed - Seed arena tiers (admin)
router.post('/seed', ArenaController.seedArenas);

// GET /api/arena/:id - Get specific arena
router.get('/:id', ArenaController.getArena);

export { router as arenaRoutes };
export default router;
