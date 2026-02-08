import { prisma } from '../config/database';
import { Bot as PrismaBot, Prisma } from '@prisma/client';

export interface BotWithStats extends PrismaBot {
  winRate: number;
  recentGames: {
    id: string;
    gameId: string;
    position: number;
    completionTime: number | null;
    collisions: number;
    eliminated: boolean;
    game: {
      id: string;
      status: string;
      arena: {
        name: string;
        tier: number;
      };
      createdAt: Date;
    };
  }[];
}

export const BotModel = {
  /**
   * Create a new bot
   */
  async create(walletAddress: string, username: string, characterId: number): Promise<PrismaBot> {
    return prisma.bot.create({
      data: {
        walletAddress,
        username,
        characterId,
      },
    });
  },

  /**
   * Find bot by wallet address
   */
  async findByWallet(walletAddress: string): Promise<PrismaBot | null> {
    return prisma.bot.findUnique({
      where: { walletAddress },
    });
  },

  /**
   * Find bot by ID
   */
  async findById(id: string): Promise<PrismaBot | null> {
    return prisma.bot.findUnique({
      where: { id },
    });
  },

  /**
   * Update bot statistics after a game
   */
  async updateStats(
    id: string,
    won: boolean,
    earnings: number
  ): Promise<PrismaBot> {
    const updateData: Prisma.BotUpdateInput = {
      totalGames: { increment: 1 },
    };

    if (won) {
      updateData.totalWins = { increment: 1 };
    }

    if (earnings > 0) {
      updateData.totalEarnings = { increment: earnings };
    }

    return prisma.bot.update({
      where: { id },
      data: updateData,
    });
  },

  /**
   * Get leaderboard - top N bots sorted by wins or earnings
   */
  async getLeaderboard(
    limit: number = 20,
    sortBy: 'wins' | 'earnings' = 'wins'
  ): Promise<PrismaBot[]> {
    const orderBy: Prisma.BotOrderByWithRelationInput =
      sortBy === 'wins'
        ? { totalWins: 'desc' }
        : { totalEarnings: 'desc' };

    return prisma.bot.findMany({
      take: limit,
      orderBy: [orderBy, { totalGames: 'desc' }],
      where: {
        totalGames: { gt: 0 },
      },
    });
  },

  /**
   * Get bot with recent game history
   */
  async findByWalletWithHistory(walletAddress: string): Promise<BotWithStats | null> {
    const bot = await prisma.bot.findUnique({
      where: { walletAddress },
      include: {
        gamesPlayed: {
          include: {
            game: {
              include: {
                arena: {
                  select: {
                    name: true,
                    tier: true,
                  },
                },
              },
            },
          },
          orderBy: { createdAt: 'desc' },
          take: 20,
        },
      },
    });

    if (!bot) return null;

    const winRate =
      bot.totalGames > 0
        ? Math.round((bot.totalWins / bot.totalGames) * 100)
        : 0;

    return {
      ...bot,
      winRate,
      recentGames: (bot as any).gamesPlayed,
    };
  },
};

export default BotModel;
