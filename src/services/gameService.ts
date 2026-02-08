import { prisma } from '../config/database';
import { GameStatus, Prisma } from '@prisma/client';
import { GameModel } from '../models/Game';
import { ArenaModel } from '../models/Arena';
import { BotModel } from '../models/Bot';
import { PathfindingService, Position } from './pathfindingService';
import { CollisionService } from './collisionService';
import { ContractService } from './contractService';
import { logger } from '../utils/logger';

// Maximum bots per arena game
const MAX_BOTS_PER_GAME = 10;

// Elimination rules per level
const ELIMINATION_MAP: Record<number, number> = {
  1: 2, // Level 1: eliminate bottom 2 (10 -> 8)
  2: 4, // Level 2: eliminate bottom 4 (8 -> 4)
  3: 3, // Level 3: eliminate bottom 3 (4 -> 1 winner)
};

// In-memory store for active game grids and bot positions
export interface GameState {
  grid: number[][];
  botPositions: Map<string, Position>;
  endPosition: Position;
  startTime: number;
  moveCounters: Map<string, number>;
  botFinishTimes: Map<string, number>;
}

export const activeGames: Map<string, GameState> = new Map();

export const GameService = {
  /**
   * Create a new game session for an arena.
   */
  async createGame(arenaId: string) {
    const arena = await ArenaModel.findById(arenaId);
    if (!arena) {
      throw new Error('Arena not found');
    }

    if (!arena.isActive) {
      throw new Error('Arena is not active');
    }

    const game = await GameModel.create(arenaId, 0);

    logger.info(`Game ${game.id} created for arena ${arena.name} (tier ${arena.tier})`);

    return game;
  },

  /**
   * Add a bot to a game. Returns the updated game when successful.
   */
  async joinGame(gameId: string, botId: string) {
    const game = await GameModel.findById(gameId);
    if (!game) {
      throw new Error('Game not found');
    }

    if (game.status !== GameStatus.WAITING) {
      throw new Error('Game is not accepting new players');
    }

    // Check if game is full
    const participantCount = game.participants.length;
    if (participantCount >= MAX_BOTS_PER_GAME) {
      throw new Error('Game is full');
    }

    // Check if bot is already in the game
    const alreadyJoined = game.participants.some((p) => p.botId === botId);
    if (alreadyJoined) {
      throw new Error('Bot has already joined this game');
    }

    // Verify bot exists
    const bot = await BotModel.findById(botId);
    if (!bot) {
      throw new Error('Bot not found');
    }

    // Add bot to game
    const position = participantCount + 1;
    await prisma.botGame.create({
      data: {
        botId,
        gameId,
        position,
      },
    });

    // Update prize pool with entry fee
    const arena = game.arena;
    const newPrizePool = Number(game.prizePool) + Number(arena.entryFee);
    await GameModel.updatePrizePool(gameId, newPrizePool);

    const updatedGame = await GameModel.findById(gameId);

    logger.info(
      `Bot ${bot.username} joined game ${gameId}. Participants: ${participantCount + 1}/${MAX_BOTS_PER_GAME}`
    );

    return updatedGame;
  },

  /**
   * Start a level: generate grid, place obstacles, set bot positions to (0,0).
   */
  async startLevel(gameId: string, level: number): Promise<any> {
    const game = await GameModel.findById(gameId);
    if (!game) {
      throw new Error('Game not found');
    }

    const arena = game.arena;
    const { gridRows, gridCols, obstacleCount } = arena;

    // Scale obstacle count by level
    const levelObstacleCount = Math.floor(obstacleCount * (1 + (level - 1) * 0.3));

    // Generate the grid
    const grid = GameService.generateGrid(gridRows, gridCols, levelObstacleCount);
    const endPosition: Position = { x: gridCols - 1, y: gridRows - 1 };

    // Ensure a path exists
    const path = PathfindingService.findPath(grid, { x: 0, y: 0 }, endPosition);
    if (path.length === 0) {
      // Regenerate if no path (should be rare due to generateGrid logic)
      logger.warn(`No path found for game ${gameId} level ${level}, regenerating grid`);
      return GameService.startLevel(gameId, level);
    }

    // Get active (non-eliminated) participants
    const activeParticipants = game.participants.filter((p) => !p.eliminated);

    // Initialize bot positions at (0, 0)
    const botPositions = new Map<string, Position>();
    const moveCounters = new Map<string, number>();
    const botFinishTimes = new Map<string, number>();

    for (const participant of activeParticipants) {
      botPositions.set(participant.botId, { x: 0, y: 0 });
      moveCounters.set(participant.botId, 0);
    }

    // Store game state in memory
    const gameState: GameState = {
      grid,
      botPositions,
      endPosition,
      startTime: Date.now(),
      moveCounters,
      botFinishTimes,
    };
    activeGames.set(gameId, gameState);

    // Update game status
    const statusMap: Record<number, GameStatus> = {
      1: GameStatus.LEVEL_1,
      2: GameStatus.LEVEL_2,
      3: GameStatus.LEVEL_3,
    };

    await GameModel.updateStatus(gameId, statusMap[level], level);

    logger.info(
      `Level ${level} started for game ${gameId}. Grid: ${gridRows}x${gridCols}, Obstacles: ${levelObstacleCount}, Bots: ${activeParticipants.length}`
    );

    return {
      grid,
      endPosition,
      botPositions: Object.fromEntries(botPositions),
      level,
      timeLimit: arena.timeLimit,
    };
  },

  /**
   * Process a move from a bot. Validates the move, checks for collisions.
   */
  async processMove(
    gameId: string,
    botId: string,
    move: { toX: number; toY: number }
  ) {
    const gameState = activeGames.get(gameId);
    if (!gameState) {
      throw new Error('Game state not found. Level may not have started.');
    }

    const currentPosition = gameState.botPositions.get(botId);
    if (!currentPosition) {
      throw new Error('Bot is not active in this game');
    }

    // Check if bot already finished
    if (gameState.botFinishTimes.has(botId)) {
      throw new Error('Bot has already reached the finish');
    }

    const newPosition: Position = { x: move.toX, y: move.toY };

    // Validate move is adjacent
    if (!PathfindingService.isValidMove(currentPosition, newPosition)) {
      throw new Error('Invalid move: must move to an adjacent cell (up/down/left/right)');
    }

    // Check boundary collision
    const gridSize = {
      rows: gameState.grid.length,
      cols: gameState.grid[0].length,
    };
    if (CollisionService.checkBoundaryCollision(newPosition, gridSize)) {
      throw new Error('Invalid move: out of bounds');
    }

    // Get current game to determine level
    const game = await GameModel.findById(gameId);
    if (!game) {
      throw new Error('Game not found');
    }

    const moveNumber = (gameState.moveCounters.get(botId) || 0) + 1;
    gameState.moveCounters.set(botId, moveNumber);

    // Check obstacle collision
    let isCollision = false;
    let collisionResult = null;

    if (CollisionService.checkObstacleCollision(gameState.grid, newPosition)) {
      isCollision = true;
      collisionResult = await CollisionService.handleCollision(gameId, botId);

      // On collision, bot stays at current position (does not move into obstacle)
      // Record the collision move
      await prisma.move.create({
        data: {
          gameId,
          botId,
          level: game.currentLevel,
          fromX: currentPosition.x,
          fromY: currentPosition.y,
          toX: newPosition.x,
          toY: newPosition.y,
          moveNumber,
          isCollision: true,
        },
      });

      logger.info(
        `Bot ${botId} collided with obstacle at (${newPosition.x}, ${newPosition.y}) in game ${gameId}`
      );

      return {
        success: false,
        isCollision: true,
        penalty: collisionResult.penalty,
        totalCollisions: collisionResult.collisions,
        position: currentPosition,
        moveNumber,
      };
    }

    // Check bot-to-bot collision (exclude finished bots so they don't block the goal)
    const botPositionsArray = Array.from(gameState.botPositions.entries())
      .filter(([id]) => !gameState.botFinishTimes.has(id))
      .map(([id, pos]) => ({ botId: id, position: pos }));
    const blockingBot = CollisionService.checkBotCollision(
      botPositionsArray,
      botId,
      newPosition
    );
    if (blockingBot) {
      // Bot can't move to a position occupied by another bot
      return {
        success: false,
        isCollision: false,
        blocked: true,
        blockedBy: blockingBot,
        position: currentPosition,
        moveNumber,
      };
    }

    // Valid move - update position
    gameState.botPositions.set(botId, newPosition);

    // Record the move
    await prisma.move.create({
      data: {
        gameId,
        botId,
        level: game.currentLevel,
        fromX: currentPosition.x,
        fromY: currentPosition.y,
        toX: newPosition.x,
        toY: newPosition.y,
        moveNumber,
        isCollision: false,
      },
    });

    // Check if bot reached the finish
    let finished = false;
    if (
      newPosition.x === gameState.endPosition.x &&
      newPosition.y === gameState.endPosition.y
    ) {
      finished = true;
      const finishTime = Date.now() - gameState.startTime;
      gameState.botFinishTimes.set(botId, finishTime);

      // Update the level time for this bot
      const levelTimeField =
        game.currentLevel === 1
          ? 'level1Time'
          : game.currentLevel === 2
            ? 'level2Time'
            : 'level3Time';

      const botGame = await prisma.botGame.findUnique({
        where: { botId_gameId: { botId, gameId } },
      });
      if (botGame) {
        await prisma.botGame.update({
          where: { id: botGame.id },
          data: { [levelTimeField]: finishTime },
        });
      }

      logger.info(
        `Bot ${botId} finished level ${game.currentLevel} in game ${gameId} (${finishTime}ms)`
      );
    }

    return {
      success: true,
      isCollision: false,
      position: newPosition,
      moveNumber,
      finished,
      finishTime: finished ? gameState.botFinishTimes.get(botId) : undefined,
    };
  },

  /**
   * Check if all bots have finished the current level or timed out.
   */
  async checkLevelComplete(gameId: string): Promise<boolean> {
    const gameState = activeGames.get(gameId);
    if (!gameState) {
      return false;
    }

    const game = await GameModel.findById(gameId);
    if (!game) {
      return false;
    }

    const activeParticipants = game.participants.filter((p) => !p.eliminated);
    const allFinished = activeParticipants.every((p) =>
      gameState.botFinishTimes.has(p.botId)
    );

    // Check timeout
    const elapsedMs = Date.now() - gameState.startTime;
    const timeLimitMs = game.arena.timeLimit * 1000;
    const timedOut = elapsedMs >= timeLimitMs;

    if (allFinished || timedOut) {
      if (timedOut) {
        logger.info(`Level ${game.currentLevel} timed out for game ${gameId}`);
        // Assign a very large finish time to bots that didn't finish
        for (const participant of activeParticipants) {
          if (!gameState.botFinishTimes.has(participant.botId)) {
            gameState.botFinishTimes.set(participant.botId, timeLimitMs + 999999);
          }
        }
      }
      return true;
    }

    return false;
  },

  /**
   * Eliminate the bottom bots based on level performance.
   * Level 1: eliminate bottom 2 (10 -> 8)
   * Level 2: eliminate bottom 4 (8 -> 4)
   * Level 3: eliminate bottom 3 (4 -> 1 winner)
   */
  async eliminateBots(gameId: string, level: number) {
    const gameState = activeGames.get(gameId);
    if (!gameState) {
      throw new Error('Game state not found');
    }

    const game = await GameModel.findById(gameId);
    if (!game) {
      throw new Error('Game not found');
    }

    const activeParticipants = game.participants.filter((p) => !p.eliminated);
    const eliminationCount = ELIMINATION_MAP[level] || 0;

    // Sort by finish time (including collision penalties)
    const rankings = activeParticipants.map((p) => {
      const finishTime = gameState.botFinishTimes.get(p.botId) || Infinity;
      const penaltyMs = p.collisions * CollisionService.getPenaltySeconds() * 1000;
      return {
        botId: p.botId,
        botGameId: p.id,
        totalTime: finishTime + penaltyMs,
        collisions: p.collisions,
      };
    });

    rankings.sort((a, b) => a.totalTime - b.totalTime);

    // Determine who gets eliminated (bottom N)
    const qualifiedCount = rankings.length - eliminationCount;
    const qualified = rankings.slice(0, qualifiedCount);
    const eliminated = rankings.slice(qualifiedCount);

    // Mark eliminated bots in database
    for (const bot of eliminated) {
      await prisma.botGame.update({
        where: { id: bot.botGameId },
        data: {
          eliminated: true,
          eliminatedAt: level,
        },
      });
    }

    // Update positions for qualified bots
    for (let i = 0; i < qualified.length; i++) {
      await prisma.botGame.update({
        where: { id: qualified[i].botGameId },
        data: { position: i + 1 },
      });
    }

    logger.info(
      `Level ${level} elimination for game ${gameId}: ${eliminated.length} eliminated, ${qualified.length} qualified`
    );

    return {
      qualified: qualified.map((q) => q.botId),
      eliminated: eliminated.map((e) => e.botId),
      rankings,
    };
  },

  /**
   * Finalize a game: set winner, distribute prizes, update stats.
   */
  async completeGame(gameId: string, winnerId: string) {
    const game = await GameModel.findById(gameId);
    if (!game) {
      throw new Error('Game not found');
    }

    // Set winner
    await GameModel.setWinner(gameId, winnerId);

    // Calculate prize (winner gets 90% of pool)
    const prizePool = Number(game.prizePool);
    const winnerPrize = prizePool * 0.9;

    // Update winner stats
    await BotModel.updateStats(winnerId, true, winnerPrize);

    // Update all participants game count
    for (const participant of game.participants) {
      if (participant.botId !== winnerId) {
        await BotModel.updateStats(participant.botId, false, 0);
      }
    }

    // Update completion time for winner
    const winnerBotGame = await prisma.botGame.findUnique({
      where: { botId_gameId: { botId: winnerId, gameId } },
    });
    if (winnerBotGame) {
      const totalTime =
        (winnerBotGame.level1Time || 0) +
        (winnerBotGame.level2Time || 0) +
        (winnerBotGame.level3Time || 0);
      await prisma.botGame.update({
        where: { id: winnerBotGame.id },
        data: { completionTime: totalTime },
      });
    }

    // Attempt on-chain completion
    try {
      const winner = await BotModel.findById(winnerId);
      if (winner) {
        await ContractService.completeGameOnChain(gameId, winner.walletAddress);
      }
    } catch (error) {
      logger.error(`Failed to complete game on-chain: ${error}`);
      // Game is still completed in the database even if on-chain fails
    }

    // Clean up in-memory state
    activeGames.delete(gameId);

    logger.info(
      `Game ${gameId} completed. Winner: ${winnerId}, Prize: $${winnerPrize.toFixed(2)}`
    );

    return {
      winnerId,
      prizePool,
      winnerPrize,
    };
  },

  /**
   * Generate a grid with random obstacles, ensuring start and end are clear
   * and a valid path exists.
   */
  generateGrid(rows: number, cols: number, obstacleCount: number): number[][] {
    // Initialize empty grid (0 = empty)
    const grid: number[][] = Array.from({ length: rows }, () =>
      Array(cols).fill(0)
    );

    // Mark start (0,0) and end (cols-1, rows-1)
    grid[0][0] = 2; // Start
    grid[rows - 1][cols - 1] = 3; // End

    // Place obstacles randomly
    let placed = 0;
    const maxAttempts = obstacleCount * 10;
    let attempts = 0;

    while (placed < obstacleCount && attempts < maxAttempts) {
      const x = Math.floor(Math.random() * cols);
      const y = Math.floor(Math.random() * rows);

      // Don't place obstacle on start, end, or existing obstacle
      if (grid[y][x] !== 0) {
        attempts++;
        continue;
      }

      // Don't place obstacles adjacent to start or end to ensure accessibility
      if (
        (x <= 1 && y <= 1) || // Near start
        (x >= cols - 2 && y >= rows - 2) // Near end
      ) {
        attempts++;
        continue;
      }

      // Temporarily place obstacle
      grid[y][x] = 1;

      // Verify path still exists
      const hasPath = PathfindingService.hasPath(
        grid,
        { x: 0, y: 0 },
        { x: cols - 1, y: rows - 1 }
      );

      if (hasPath) {
        placed++;
      } else {
        // Remove obstacle if it blocks the path
        grid[y][x] = 0;
      }

      attempts++;
    }

    logger.debug(`Generated grid ${rows}x${cols} with ${placed} obstacles`);

    return grid;
  },

  /**
   * Get current game state from in-memory store.
   */
  getGameState(gameId: string): GameState | undefined {
    return activeGames.get(gameId);
  },

  /**
   * Get the max bots per game.
   */
  getMaxBotsPerGame(): number {
    return MAX_BOTS_PER_GAME;
  },
};

export default GameService;
