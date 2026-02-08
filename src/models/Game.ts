import { prisma } from '../config/database';
import { Game as PrismaGame, GameStatus, Prisma } from '@prisma/client';

export interface GameWithRelations extends PrismaGame {
  arena: {
    id: string;
    tier: number;
    name: string;
    entryFee: Prisma.Decimal;
    difficulty: string;
    gridRows: number;
    gridCols: number;
    obstacleCount: number;
    timeLimit: number;
  };
  participants: {
    id: string;
    botId: string;
    position: number;
    completionTime: number | null;
    collisions: number;
    eliminated: boolean;
    eliminatedAt: number | null;
    level1Time: number | null;
    level2Time: number | null;
    level3Time: number | null;
    bot: {
      id: string;
      walletAddress: string;
      username: string;
      characterId: number;
    };
  }[];
}

export const GameModel = {
  /**
   * Create a new game for an arena
   */
  async create(arenaId: string, prizePool: number): Promise<PrismaGame> {
    return prisma.game.create({
      data: {
        arenaId,
        status: GameStatus.WAITING,
        currentLevel: 1,
        prizePool: new Prisma.Decimal(prizePool),
      },
    });
  },

  /**
   * Find game by ID with participants and arena info
   */
  async findById(id: string): Promise<GameWithRelations | null> {
    return prisma.game.findUnique({
      where: { id },
      include: {
        arena: true,
        participants: {
          include: {
            bot: {
              select: {
                id: true,
                walletAddress: true,
                username: true,
                characterId: true,
              },
            },
          },
          orderBy: { position: 'asc' },
        },
      },
    }) as Promise<GameWithRelations | null>;
  },

  /**
   * Find games by status
   */
  async findByStatus(status: GameStatus): Promise<PrismaGame[]> {
    return prisma.game.findMany({
      where: { status },
      include: {
        arena: true,
        participants: {
          include: {
            bot: {
              select: {
                id: true,
                walletAddress: true,
                username: true,
                characterId: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  },

  /**
   * Update game status
   */
  async updateStatus(id: string, status: GameStatus, currentLevel?: number): Promise<PrismaGame> {
    const updateData: Prisma.GameUpdateInput = { status };

    if (currentLevel !== undefined) {
      updateData.currentLevel = currentLevel;
    }

    if (status === GameStatus.COMPLETED || status === GameStatus.CANCELLED) {
      updateData.endTime = new Date();
    }

    if (
      status === GameStatus.LEVEL_1 &&
      !await prisma.game.findFirst({ where: { id, startTime: { not: null } } })
    ) {
      updateData.startTime = new Date();
    }

    return prisma.game.update({
      where: { id },
      data: updateData,
    });
  },

  /**
   * Set the winner of a game
   */
  async setWinner(id: string, winnerId: string): Promise<PrismaGame> {
    return prisma.game.update({
      where: { id },
      data: {
        winnerId,
        status: GameStatus.COMPLETED,
        endTime: new Date(),
      },
    });
  },

  /**
   * Get all active games (not completed or cancelled)
   */
  async getActiveGames(): Promise<PrismaGame[]> {
    return prisma.game.findMany({
      where: {
        status: {
          notIn: [GameStatus.COMPLETED, GameStatus.CANCELLED],
        },
      },
      include: {
        arena: true,
        participants: {
          include: {
            bot: {
              select: {
                id: true,
                walletAddress: true,
                username: true,
                characterId: true,
              },
            },
          },
        },
        _count: {
          select: { participants: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  },

  /**
   * Update prize pool amount
   */
  async updatePrizePool(id: string, amount: number): Promise<PrismaGame> {
    return prisma.game.update({
      where: { id },
      data: {
        prizePool: new Prisma.Decimal(amount),
      },
    });
  },
};

export default GameModel;
