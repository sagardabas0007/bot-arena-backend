import { Router } from 'express';
import { StatsController } from '../controllers/statsController';

const router = Router();

router.get('/:walletAddress', StatsController.getBotStats);

export { router as statsRoutes };
export default router;
