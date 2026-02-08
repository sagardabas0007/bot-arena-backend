import { prisma } from '../config/database';
import { logger } from '../utils/logger';

export interface Position {
  x: number;
  y: number;
}

export interface GridSize {
  rows: number;
  cols: number;
}

export interface BotPosition {
  botId: string;
  position: Position;
}

// Collision penalty in seconds
const COLLISION_PENALTY_SECONDS = 10;

export const CollisionService = {
  /**
   * Check if a position contains an obstacle.
   *
   * @param grid - 2D array where 1 = obstacle
   * @param position - The position to check
   * @returns true if the position has an obstacle
   */
  checkObstacleCollision(grid: number[][], position: Position): boolean {
    if (
      position.y < 0 ||
      position.y >= grid.length ||
      position.x < 0 ||
      position.x >= grid[0].length
    ) {
      return false; // Out of bounds is handled separately
    }
    return grid[position.y][position.x] === 1;
  },

  /**
   * Check if a position is outside the grid boundaries.
   *
   * @param position - The position to check
   * @param gridSize - The dimensions of the grid
   * @returns true if the position is out of bounds
   */
  checkBoundaryCollision(position: Position, gridSize: GridSize): boolean {
    return (
      position.x < 0 ||
      position.x >= gridSize.cols ||
      position.y < 0 ||
      position.y >= gridSize.rows
    );
  },

  /**
   * Handle a collision event: increment collision count for the bot and apply time penalty.
   *
   * @param gameId - The game ID
   * @param botId - The bot that collided
   * @returns The updated collision count and penalty applied
   */
  async handleCollision(
    gameId: string,
    botId: string
  ): Promise<{ collisions: number; penalty: number }> {
    // Increment collision counter for this bot in this game
    const botGame = await prisma.botGame.findUnique({
      where: {
        botId_gameId: {
          botId,
          gameId,
        },
      },
    });

    if (!botGame) {
      logger.error(`BotGame not found for bot ${botId} in game ${gameId}`);
      throw new Error('Bot is not a participant in this game');
    }

    const updatedBotGame = await prisma.botGame.update({
      where: { id: botGame.id },
      data: {
        collisions: { increment: 1 },
      },
    });

    // Record the collision as a move with isCollision flag
    const penalty = COLLISION_PENALTY_SECONDS;

    logger.info(
      `Collision: Bot ${botId} in game ${gameId}. Total collisions: ${updatedBotGame.collisions}. Penalty: +${penalty}s`
    );

    return {
      collisions: updatedBotGame.collisions,
      penalty,
    };
  },

  /**
   * Check if another bot is currently at the given position.
   *
   * @param positions - Array of all bot positions in the game
   * @param botId - The bot trying to move
   * @param newPosition - The target position
   * @returns The ID of the blocking bot, or null if position is free
   */
  checkBotCollision(
    positions: BotPosition[],
    botId: string,
    newPosition: Position
  ): string | null {
    for (const bp of positions) {
      if (bp.botId !== botId) {
        if (bp.position.x === newPosition.x && bp.position.y === newPosition.y) {
          return bp.botId;
        }
      }
    }
    return null;
  },

  /**
   * Calculate total time penalty for a bot based on collision count.
   *
   * @param collisionCount - Number of collisions the bot has had
   * @returns Total penalty in seconds
   */
  calculateTotalPenalty(collisionCount: number): number {
    return collisionCount * COLLISION_PENALTY_SECONDS;
  },

  /**
   * Get the collision penalty constant value.
   */
  getPenaltySeconds(): number {
    return COLLISION_PENALTY_SECONDS;
  },
};

export default CollisionService;
