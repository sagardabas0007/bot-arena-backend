import { Response, NextFunction } from 'express';
import { AgentRequest } from '../middleware/agentAuth';
import { AgentModel } from '../models/Agent';
import { AgentGameService } from '../services/agentGameService';
import { GameService } from '../services/gameService';
import { GameModel } from '../models/Game';
import { ArenaModel } from '../models/Arena';
import { prisma } from '../config/database';
import { GameStatus } from '@prisma/client';
import { logger } from '../utils/logger';

export const AgentController = {
  /**
   * POST /api/agent/register
   * Create a new agent and return the API key (shown once)
   */
  async register(req: AgentRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { name, description } = req.body;

      const agent = await AgentModel.create(name, description);

      res.status(201).json({
        success: true,
        data: {
          id: agent.id,
          name: agent.name,
          apiKey: agent.apiKey,
          botId: agent.botId,
          description: agent.description,
          skillRating: agent.skillRating,
          message: 'Save your API key! It will not be shown again.',
        },
      });
    } catch (error: any) {
      logger.error(`Agent register error: ${error.message}`);
      next(error);
    }
  },

  /**
   * GET /api/agent/me
   * Get agent profile
   */
  async getProfile(req: AgentRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const agent = await AgentModel.findById(req.agent!.id);
      if (!agent) {
        res.status(404).json({ success: false, error: 'Agent not found' });
        return;
      }

      res.json({
        success: true,
        data: {
          id: agent.id,
          name: agent.name,
          botId: agent.botId,
          description: agent.description,
          skillRating: agent.skillRating,
          isActive: agent.isActive,
          bot: {
            id: agent.bot.id,
            username: agent.bot.username,
            totalWins: agent.bot.totalWins,
            totalGames: agent.bot.totalGames,
            totalEarnings: agent.bot.totalEarnings,
            winRate: agent.bot.totalGames > 0
              ? Math.round((agent.bot.totalWins / agent.bot.totalGames) * 100)
              : 0,
          },
          createdAt: agent.createdAt,
        },
      });
    } catch (error: any) {
      logger.error(`Agent getProfile error: ${error.message}`);
      next(error);
    }
  },

  /**
   * GET /api/agent/arenas
   * List all arenas with waiting game counts
   */
  async listArenas(req: AgentRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const arenas = await ArenaModel.findAll();

      // Count waiting games per arena
      const waitingCounts = await prisma.game.groupBy({
        by: ['arenaId'],
        where: { status: GameStatus.WAITING },
        _count: { id: true },
      });

      const countMap = new Map(waitingCounts.map((c) => [c.arenaId, c._count.id]));

      const data = arenas.map((arena) => ({
        id: arena.id,
        name: arena.name,
        tier: arena.tier,
        difficulty: arena.difficulty,
        entryFee: arena.entryFee,
        gridRows: arena.gridRows,
        gridCols: arena.gridCols,
        obstacleCount: arena.obstacleCount,
        timeLimit: arena.timeLimit,
        description: arena.description,
        waitingGames: countMap.get(arena.id) || 0,
        recommended: arena.tier === 1,
      }));

      res.json({ success: true, data });
    } catch (error: any) {
      logger.error(`Agent listArenas error: ${error.message}`);
      next(error);
    }
  },

  /**
   * GET /api/agent/games/waiting
   * Find games in WAITING status
   */
  async findWaitingGames(req: AgentRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const arenaId = req.query.arenaId as string | undefined;
      const games = await AgentGameService.findWaitingGames(arenaId);

      res.json({ success: true, data: games });
    } catch (error: any) {
      logger.error(`Agent findWaitingGames error: ${error.message}`);
      next(error);
    }
  },

  /**
   * GET /api/agent/games/active
   * Get agent's current in-progress games
   */
  async getActiveGames(req: AgentRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const botId = req.agent!.botId;

      const botGames = await prisma.botGame.findMany({
        where: {
          botId,
          game: {
            status: {
              notIn: [GameStatus.COMPLETED, GameStatus.CANCELLED],
            },
          },
        },
        include: {
          game: {
            include: {
              arena: {
                select: {
                  id: true,
                  name: true,
                  tier: true,
                  difficulty: true,
                },
              },
              _count: { select: { participants: true } },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      });

      const data = botGames.map((bg) => ({
        gameId: bg.gameId,
        status: bg.game.status,
        currentLevel: bg.game.currentLevel,
        arena: bg.game.arena,
        participantCount: bg.game._count.participants,
        eliminated: bg.eliminated,
        position: bg.position,
        collisions: bg.collisions,
      }));

      res.json({ success: true, data });
    } catch (error: any) {
      logger.error(`Agent getActiveGames error: ${error.message}`);
      next(error);
    }
  },

  /**
   * POST /api/agent/games/join
   * Join an existing game
   */
  async joinGame(req: AgentRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { gameId } = req.body;
      const botId = req.agent!.botId;

      const game = await GameService.joinGame(gameId, botId);
      const io = req.app.get('io');
      const autoStart = await AgentGameService.autoReadyAndMaybeStart(gameId, io);

      res.json({
        success: true,
        data: {
          gameId: game!.id,
          botId,
          participantCount: game!.participants.length,
          maxParticipants: GameService.getMaxBotsPerGame(),
          status: game!.status,
          prizePool: game!.prizePool,
          autoStarted: autoStart?.autoStarted || false,
        },
      });
    } catch (error: any) {
      logger.error(`Agent joinGame error: ${error.message}`);
      const clientErrors = [
        'Game not found',
        'Game is not accepting new players',
        'Game is full',
        'Bot has already joined this game',
        'Bot not found',
      ];
      if (clientErrors.includes(error.message)) {
        const status = error.message === 'Game not found' ? 404
          : error.message === 'Bot has already joined this game' ? 409
          : 400;
        res.status(status).json({ success: false, error: error.message });
        return;
      }
      next(error);
    }
  },

  /**
   * POST /api/agent/games/create-and-join
   * Create a new game and join it
   */
  async createAndJoinGame(req: AgentRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { arenaId } = req.body;
      const botId = req.agent!.botId;

      const game = await GameService.createGame(arenaId);
      const updatedGame = await GameService.joinGame(game.id, botId);

      res.status(201).json({
        success: true,
        data: {
          gameId: game.id,
          botId,
          participantCount: updatedGame!.participants.length,
          maxParticipants: GameService.getMaxBotsPerGame(),
          status: updatedGame!.status,
          prizePool: updatedGame!.prizePool,
          arena: updatedGame!.arena,
        },
      });
    } catch (error: any) {
      logger.error(`Agent createAndJoinGame error: ${error.message}`);
      if (error.message === 'Arena not found' || error.message === 'Arena is not active') {
        res.status(400).json({ success: false, error: error.message });
        return;
      }
      next(error);
    }
  },

  /**
   * GET /api/agent/games/:gameId/state
   * Get full polling state
   */
  async getGameState(req: AgentRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { gameId } = req.params;
      const botId = req.agent!.botId;

      const state = await AgentGameService.getAgentGameState(gameId, botId);

      res.json({ success: true, data: state });
    } catch (error: any) {
      logger.error(`Agent getGameState error: ${error.message}`);
      if (error.message === 'Game not found') {
        res.status(404).json({ success: false, error: error.message });
        return;
      }
      if (error.message === 'Agent is not a participant in this game') {
        res.status(403).json({ success: false, error: error.message });
        return;
      }
      next(error);
    }
  },

  /**
   * POST /api/agent/games/:gameId/move
   * Submit a direction-based move
   */
  async submitMove(req: AgentRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { gameId } = req.params;
      const { direction } = req.body;
      const botId = req.agent!.botId;

      const result = await AgentGameService.submitAgentMove(gameId, botId, direction);

      res.json({ success: true, data: result });
    } catch (error: any) {
      logger.error(`Agent submitMove error: ${error.message}`);
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
   * GET /api/agent/games/:gameId/path
   * Get A* optimal path
   */
  async getOptimalPath(req: AgentRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { gameId } = req.params;
      const botId = req.agent!.botId;

      const pathData = await AgentGameService.getOptimalPath(gameId, botId);

      res.json({ success: true, data: pathData });
    } catch (error: any) {
      logger.error(`Agent getOptimalPath error: ${error.message}`);
      if (error.message.includes('Game state not found') || error.message.includes('not active')) {
        res.status(400).json({ success: false, error: error.message });
        return;
      }
      next(error);
    }
  },

  /**
   * GET /api/agent/games/:gameId/moves
   * Get move history
   */
  async getMoveHistory(req: AgentRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { gameId } = req.params;
      const botId = req.agent!.botId;

      const moves = await prisma.move.findMany({
        where: { gameId, botId },
        orderBy: { moveNumber: 'asc' },
        select: {
          id: true,
          level: true,
          fromX: true,
          fromY: true,
          toX: true,
          toY: true,
          moveNumber: true,
          isCollision: true,
          timestamp: true,
        },
      });

      res.json({ success: true, data: { gameId, botId, moves } });
    } catch (error: any) {
      logger.error(`Agent getMoveHistory error: ${error.message}`);
      next(error);
    }
  },

  /**
   * GET /api/agent/games/:gameId/leaderboard
   * Get current rankings
   */
  async getGameLeaderboard(req: AgentRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { gameId } = req.params;
      const botId = req.agent!.botId;

      const game = await GameModel.findById(gameId);
      if (!game) {
        res.status(404).json({ success: false, error: 'Game not found' });
        return;
      }

      const gameState = GameService.getGameState(gameId);

      const rankings = game.participants
        .map((p) => {
          const finishTime = gameState?.botFinishTimes?.get(p.botId);
          const penaltyMs = p.collisions * 10 * 1000;
          const totalTime = finishTime ? finishTime + penaltyMs : null;

          return {
            botId: p.botId,
            username: p.bot.username,
            position: p.position,
            collisions: p.collisions,
            eliminated: p.eliminated,
            eliminatedAt: p.eliminatedAt,
            currentLevelTime: totalTime,
            isMe: p.botId === botId,
          };
        })
        .sort((a, b) => {
          if (a.eliminated !== b.eliminated) return a.eliminated ? 1 : -1;
          return a.position - b.position;
        });

      const myRank = rankings.findIndex((r) => r.isMe) + 1;

      res.json({
        success: true,
        data: {
          gameId,
          currentLevel: game.currentLevel,
          status: game.status,
          prizePool: game.prizePool,
          myRank,
          rankings,
        },
      });
    } catch (error: any) {
      logger.error(`Agent getGameLeaderboard error: ${error.message}`);
      next(error);
    }
  },

  /**
   * GET /api/agent/stats
   * Comprehensive agent performance stats
   */
  async getStats(req: AgentRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const agent = await AgentModel.findById(req.agent!.id);
      if (!agent) {
        res.status(404).json({ success: false, error: 'Agent not found' });
        return;
      }

      const botId = agent.botId;

      // Get all games played
      const botGames = await prisma.botGame.findMany({
        where: { botId },
        include: {
          game: {
            include: {
              arena: { select: { name: true, tier: true } },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      });

      const totalGames = botGames.length;
      const wins = botGames.filter((bg) => bg.game.winnerId === botId).length;
      const eliminations = botGames.filter((bg) => bg.eliminated).length;
      const totalCollisions = botGames.reduce((sum, bg) => sum + bg.collisions, 0);

      // Recent games (last 10)
      const recentGames = botGames.slice(0, 10).map((bg) => ({
        gameId: bg.gameId,
        arena: bg.game.arena,
        status: bg.game.status,
        position: bg.position,
        eliminated: bg.eliminated,
        eliminatedAt: bg.eliminatedAt,
        collisions: bg.collisions,
        won: bg.game.winnerId === botId,
        completionTime: bg.completionTime,
        createdAt: bg.createdAt,
      }));

      res.json({
        success: true,
        data: {
          agent: {
            id: agent.id,
            name: agent.name,
            skillRating: agent.skillRating,
          },
          stats: {
            totalGames,
            wins,
            losses: totalGames - wins,
            winRate: totalGames > 0 ? Math.round((wins / totalGames) * 100) : 0,
            eliminations,
            totalCollisions,
            totalEarnings: agent.bot.totalEarnings,
          },
          recentGames,
        },
      });
    } catch (error: any) {
      logger.error(`Agent getStats error: ${error.message}`);
      next(error);
    }
  },
};

export default AgentController;
