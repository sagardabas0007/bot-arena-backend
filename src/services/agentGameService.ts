import { prisma } from '../config/database';
import { GameStatus } from '@prisma/client';
import { GameService, GameState, activeGames } from './gameService';
import { GameModel } from '../models/Game';
import { PathfindingService, Position } from './pathfindingService';
import { logger } from '../utils/logger';
import { Server as SocketIOServer } from 'socket.io';

type Direction = 'up' | 'down' | 'left' | 'right';

const DIRECTION_DELTAS: Record<Direction, { dx: number; dy: number }> = {
  up: { dx: 0, dy: -1 },
  down: { dx: 0, dy: 1 },
  left: { dx: -1, dy: 0 },
  right: { dx: 1, dy: 0 },
};

export const AgentGameService = {
  /**
   * Translate a direction string into a target position
   */
  translateDirection(position: Position, direction: Direction): Position {
    const delta = DIRECTION_DELTAS[direction];
    return {
      x: position.x + delta.dx,
      y: position.y + delta.dy,
    };
  },

  /**
   * Submit a direction-based move for an agent
   */
  async submitAgentMove(gameId: string, botId: string, direction: Direction) {
    const gameState = GameService.getGameState(gameId);
    if (!gameState) {
      throw new Error('Game state not found. Level may not have started.');
    }

    const currentPosition = gameState.botPositions.get(botId);
    if (!currentPosition) {
      throw new Error('Bot is not active in this game');
    }

    const targetPosition = this.translateDirection(currentPosition, direction);

    const result = await GameService.processMove(gameId, botId, {
      toX: targetPosition.x,
      toY: targetPosition.y,
    });

    // Check and handle level transition after each move
    await this.checkAndHandleLevelTransition(gameId);

    return result;
  },

  /**
   * Check if level is complete and handle transitions
   */
  async checkAndHandleLevelTransition(gameId: string, io?: SocketIOServer) {
    const levelComplete = await GameService.checkLevelComplete(gameId);
    if (!levelComplete) return null;

    const game = await GameModel.findById(gameId);
    if (!game) return null;

    const currentLevel = game.currentLevel;

    // Run elimination
    const eliminationResult = await GameService.eliminateBots(gameId, currentLevel);

    if (io) {
      io.to(gameId).emit('level_complete', {
        gameId,
        level: currentLevel,
        ...eliminationResult,
      });
    }

    // Check if game is over (level 3 completed)
    if (currentLevel >= 3) {
      const winnerId = eliminationResult.qualified[0];
      if (winnerId) {
        const result = await GameService.completeGame(gameId, winnerId);
        if (io) {
          io.to(gameId).emit('game_complete', {
            gameId,
            ...result,
          });
        }
        return { type: 'game_complete', ...result };
      }
    } else {
      // Start next level
      const nextLevel = currentLevel + 1;
      const levelData = await GameService.startLevel(gameId, nextLevel);
      if (io) {
        io.to(gameId).emit('level_start', {
          gameId,
          level: nextLevel,
          ...levelData,
        });
      }
      return { type: 'level_start', level: nextLevel, ...levelData };
    }

    return null;
  },

  /**
   * Get aggregated game state for polling
   */
  async getAgentGameState(gameId: string, botId: string) {
    const game = await GameModel.findById(gameId);
    if (!game) {
      throw new Error('Game not found');
    }

    const gameState = GameService.getGameState(gameId);

    // Find the agent's participant record
    const agentParticipant = game.participants.find((p) => p.botId === botId);
    if (!agentParticipant) {
      throw new Error('Agent is not a participant in this game');
    }

    const result: any = {
      gameId: game.id,
      status: game.status,
      currentLevel: game.currentLevel,
      prizePool: game.prizePool,
      participantCount: game.participants.length,
      maxParticipants: GameService.getMaxBotsPerGame(),
      arena: {
        id: game.arena.id,
        name: game.arena.name,
        tier: game.arena.tier,
        difficulty: game.arena.difficulty,
        gridRows: game.arena.gridRows,
        gridCols: game.arena.gridCols,
        timeLimit: game.arena.timeLimit,
      },
      agent: {
        botId: agentParticipant.botId,
        position: agentParticipant.position,
        collisions: agentParticipant.collisions,
        eliminated: agentParticipant.eliminated,
        eliminatedAt: agentParticipant.eliminatedAt,
        level1Time: agentParticipant.level1Time,
        level2Time: agentParticipant.level2Time,
        level3Time: agentParticipant.level3Time,
      },
    };

    // Include live data if game is in progress
    if (gameState) {
      const currentPosition = gameState.botPositions.get(botId);
      const elapsedMs = Date.now() - gameState.startTime;
      const timeLimitMs = game.arena.timeLimit * 1000;

      result.liveData = {
        grid: gameState.grid,
        endPosition: gameState.endPosition,
        myPosition: currentPosition || null,
        botPositions: Object.fromEntries(gameState.botPositions),
        elapsedMs,
        timeRemainingMs: Math.max(0, timeLimitMs - elapsedMs),
        finished: gameState.botFinishTimes.has(botId),
        finishTime: gameState.botFinishTimes.get(botId) || null,
      };
    }

    // Include winner info if game is completed
    if (game.status === GameStatus.COMPLETED && game.winnerId) {
      const winnerParticipant = game.participants.find((p) => p.botId === game.winnerId);
      result.winner = {
        botId: game.winnerId,
        username: winnerParticipant?.bot.username,
        isMe: game.winnerId === botId,
      };
    }

    return result;
  },

  /**
   * Get optimal path as directions
   */
  async getOptimalPath(gameId: string, botId: string) {
    const gameState = GameService.getGameState(gameId);
    if (!gameState) {
      throw new Error('Game state not found. Level may not have started.');
    }

    const currentPosition = gameState.botPositions.get(botId);
    if (!currentPosition) {
      throw new Error('Bot is not active in this game');
    }

    if (gameState.botFinishTimes.has(botId)) {
      return { path: [], directions: [], message: 'Already at finish' };
    }

    const path = PathfindingService.findPath(
      gameState.grid,
      currentPosition,
      gameState.endPosition
    );

    if (path.length === 0) {
      return { path: [], directions: [], message: 'No path found' };
    }

    // Convert path to directions
    const directions: Direction[] = [];
    for (let i = 0; i < path.length - 1; i++) {
      const dx = path[i + 1].x - path[i].x;
      const dy = path[i + 1].y - path[i].y;

      if (dx === 1) directions.push('right');
      else if (dx === -1) directions.push('left');
      else if (dy === 1) directions.push('down');
      else if (dy === -1) directions.push('up');
    }

    return {
      path,
      directions,
      stepsRemaining: directions.length,
    };
  },

  /**
   * Find games in WAITING status
   */
  async findWaitingGames(arenaId?: string) {
    const where: any = { status: GameStatus.WAITING };
    if (arenaId) {
      where.arenaId = arenaId;
    }

    const games = await prisma.game.findMany({
      where,
      include: {
        arena: {
          select: {
            id: true,
            name: true,
            tier: true,
            difficulty: true,
            entryFee: true,
            gridRows: true,
            gridCols: true,
            timeLimit: true,
          },
        },
        _count: {
          select: { participants: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return games.map((g) => ({
      gameId: g.id,
      arena: g.arena,
      participantCount: g._count.participants,
      maxParticipants: GameService.getMaxBotsPerGame(),
      prizePool: g.prizePool,
      createdAt: g.createdAt,
    }));
  },

  /**
   * After an agent joins, auto-ready and potentially start the game
   */
  async autoReadyAndMaybeStart(gameId: string, io?: SocketIOServer) {
    const game = await GameModel.findById(gameId);
    if (!game) return;

    const participantCount = game.participants.length;
    const maxBots = GameService.getMaxBotsPerGame();

    // Auto-start if game is at capacity
    if (participantCount >= maxBots) {
      logger.info(`Game ${gameId} at capacity (${participantCount}/${maxBots}), auto-starting`);
      const levelData = await GameService.startLevel(gameId, 1);

      if (io) {
        io.to(gameId).emit('game_start', {
          gameId,
          level: 1,
          ...levelData,
        });
      }

      return { autoStarted: true, levelData };
    }

    // If at least 2 participants, schedule a delayed start (30 seconds)
    if (participantCount >= 2) {
      logger.info(
        `Game ${gameId} has ${participantCount} participants, eligible for auto-start on capacity`
      );
    }

    return { autoStarted: false };
  },
};

export default AgentGameService;
