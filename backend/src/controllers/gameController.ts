import { Request, Response, NextFunction } from 'express';
import { validationResult } from 'express-validator';
import { GameService } from '../services/gameService';
import { GameModel } from '../models/Game';
import { BotModel } from '../models/Bot';
import { logger } from '../utils/logger';

export const GameController = {
  /**
   * POST /api/game/create
   * Create a new game session for an arena.
   */
  async createGame(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ success: false, errors: errors.array() });
        return;
      }

      const { arenaId } = req.body;

      const game = await GameService.createGame(arenaId);

      res.status(201).json({
        success: true,
        data: {
          gameId: game.id,
          arenaId: game.arenaId,
          status: game.status,
          prizePool: game.prizePool,
        },
      });
    } catch (error: any) {
      logger.error(`Create game error: ${error.message}`);
      if (
        error.message === 'Arena not found' ||
        error.message === 'Arena is not active'
      ) {
        res.status(400).json({ success: false, error: error.message });
        return;
      }
      next(error);
    }
  },

  /**
   * POST /api/game/join
   * Join a bot to an existing game.
   */
  async joinGame(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ success: false, errors: errors.array() });
        return;
      }

      const { gameId, walletAddress, characterId } = req.body;

      // Find or create bot
      let bot = await BotModel.findByWallet(walletAddress);
      if (!bot) {
        // Auto-create bot with a default username based on wallet
        const shortWallet = `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`;
        bot = await BotModel.create(walletAddress, `Player_${shortWallet}`, characterId);
      }

      const game = await GameService.joinGame(gameId, bot.id);

      res.status(200).json({
        success: true,
        data: {
          gameId: game!.id,
          botId: bot.id,
          participantCount: game!.participants.length,
          maxParticipants: GameService.getMaxBotsPerGame(),
          prizePool: game!.prizePool,
          status: game!.status,
        },
      });
    } catch (error: any) {
      logger.error(`Join game error: ${error.message}`);
      if (
        error.message === 'Game not found' ||
        error.message === 'Game is not accepting new players' ||
        error.message === 'Game is full' ||
        error.message === 'Bot has already joined this game' ||
        error.message === 'Bot not found'
      ) {
        res.status(400).json({ success: false, error: error.message });
        return;
      }
      next(error);
    }
  },

  /**
   * GET /api/game/:id
   * Get full game state with participants.
   */
  async getGame(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const game = await GameModel.findById(id);

      if (!game) {
        res.status(404).json({ success: false, error: 'Game not found' });
        return;
      }

      // Include in-memory game state if available
      const gameState = GameService.getGameState(id);
      let liveData: any = null;

      if (gameState) {
        liveData = {
          grid: gameState.grid,
          endPosition: gameState.endPosition,
          botPositions: Object.fromEntries(gameState.botPositions),
          elapsedTime: Date.now() - gameState.startTime,
        };
      }

      res.status(200).json({
        success: true,
        data: {
          id: game.id,
          arenaId: game.arenaId,
          arena: game.arena,
          status: game.status,
          currentLevel: game.currentLevel,
          prizePool: game.prizePool,
          winnerId: game.winnerId,
          startTime: game.startTime,
          endTime: game.endTime,
          participants: game.participants.map((p) => ({
            botId: p.botId,
            username: p.bot.username,
            characterId: p.bot.characterId,
            walletAddress: p.bot.walletAddress,
            position: p.position,
            completionTime: p.completionTime,
            collisions: p.collisions,
            eliminated: p.eliminated,
            eliminatedAt: p.eliminatedAt,
          })),
          liveData,
        },
      });
    } catch (error: any) {
      logger.error(`Get game error: ${error.message}`);
      next(error);
    }
  },

  /**
   * POST /api/game/:id/move
   * Submit a move for a bot in an active game.
   */
  async submitMove(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ success: false, errors: errors.array() });
        return;
      }

      const { id: gameId } = req.params;
      const { botId, toX, toY } = req.body;

      const result = await GameService.processMove(gameId, botId, { toX, toY });

      // Check if level is complete after this move
      const levelComplete = await GameService.checkLevelComplete(gameId);

      res.status(200).json({
        success: true,
        data: {
          ...result,
          levelComplete,
        },
      });
    } catch (error: any) {
      logger.error(`Submit move error: ${error.message}`);
      if (
        error.message.includes('Invalid move') ||
        error.message.includes('Bot is not active') ||
        error.message.includes('already reached the finish') ||
        error.message.includes('Game state not found')
      ) {
        res.status(400).json({ success: false, error: error.message });
        return;
      }
      next(error);
    }
  },

  /**
   * GET /api/game/:id/leaderboard
   * Get current rankings for a game.
   */
  async getGameLeaderboard(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id: gameId } = req.params;
      const game = await GameModel.findById(gameId);

      if (!game) {
        res.status(404).json({ success: false, error: 'Game not found' });
        return;
      }

      const gameState = GameService.getGameState(gameId);

      // Build rankings from participants
      const rankings = game.participants
        .map((p) => {
          const finishTime = gameState?.botFinishTimes?.get(p.botId);
          const penaltyMs = p.collisions * 10 * 1000; // 10 second penalty per collision
          const totalTime = finishTime ? finishTime + penaltyMs : null;

          return {
            botId: p.botId,
            username: p.bot.username,
            characterId: p.bot.characterId,
            walletAddress: p.bot.walletAddress,
            position: p.position,
            collisions: p.collisions,
            eliminated: p.eliminated,
            eliminatedAt: p.eliminatedAt,
            level1Time: p.level1Time,
            level2Time: p.level2Time,
            level3Time: p.level3Time,
            completionTime: p.completionTime,
            currentLevelTime: totalTime,
          };
        })
        .sort((a, b) => {
          // Non-eliminated first
          if (a.eliminated !== b.eliminated) return a.eliminated ? 1 : -1;
          // Then by position
          return a.position - b.position;
        });

      res.status(200).json({
        success: true,
        data: {
          gameId,
          currentLevel: game.currentLevel,
          status: game.status,
          prizePool: game.prizePool,
          rankings,
        },
      });
    } catch (error: any) {
      logger.error(`Get game leaderboard error: ${error.message}`);
      next(error);
    }
  },
};

export default GameController;
