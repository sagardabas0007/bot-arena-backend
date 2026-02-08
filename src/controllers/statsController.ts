import { Request, Response, NextFunction } from 'express';
import { BotModel } from '../models/Bot';
import { prisma } from '../config/database';
import { GameStatus } from '@prisma/client';
import { logger } from '../utils/logger';

export const StatsController = {
  /**
   * GET /api/stats/:walletAddress
   * Get comprehensive stats for a bot by wallet address, including recent games.
   */
  async getBotStats(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { walletAddress } = req.params;

      const botWithHistory = await BotModel.findByWalletWithHistory(walletAddress);

      if (!botWithHistory) {
        res.status(404).json({ success: false, error: 'Bot not found' });
        return;
      }

      // Get additional aggregate stats
      const bot = await prisma.bot.findUnique({
        where: { walletAddress },
      });

      if (!bot) {
        res.status(404).json({ success: false, error: 'Bot not found' });
        return;
      }

      // Get total games by arena tier
      const gamesByArena = await prisma.botGame.findMany({
        where: { botId: bot.id },
        include: {
          game: {
            include: {
              arena: {
                select: {
                  tier: true,
                  name: true,
                },
              },
            },
          },
        },
      });

      // Aggregate stats per arena
      const arenaStats: Record<
        number,
        {
          tier: number;
          name: string;
          gamesPlayed: number;
          wins: number;
          avgCollisions: number;
          totalCollisions: number;
        }
      > = {};

      for (const bg of gamesByArena) {
        const tier = bg.game.arena.tier;
        if (!arenaStats[tier]) {
          arenaStats[tier] = {
            tier,
            name: bg.game.arena.name,
            gamesPlayed: 0,
            wins: 0,
            avgCollisions: 0,
            totalCollisions: 0,
          };
        }
        arenaStats[tier].gamesPlayed++;
        arenaStats[tier].totalCollisions += bg.collisions;

        if (bg.game.winnerId === bot.id) {
          arenaStats[tier].wins++;
        }
      }

      // Calculate average collisions per arena
      for (const tier in arenaStats) {
        const stats = arenaStats[tier];
        stats.avgCollisions =
          stats.gamesPlayed > 0
            ? Math.round((stats.totalCollisions / stats.gamesPlayed) * 10) / 10
            : 0;
      }

      // Get current active games for this bot
      const activeGames = await prisma.botGame.findMany({
        where: {
          botId: bot.id,
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
                  name: true,
                  tier: true,
                },
              },
            },
          },
        },
      });

      // Get total collisions across all games
      const totalCollisions = await prisma.botGame.aggregate({
        where: { botId: bot.id },
        _sum: { collisions: true },
      });

      // Get best completion time
      const bestTime = await prisma.botGame.findFirst({
        where: {
          botId: bot.id,
          completionTime: { not: null },
        },
        orderBy: { completionTime: 'asc' },
        select: {
          completionTime: true,
          game: {
            select: {
              arena: {
                select: { name: true, tier: true },
              },
            },
          },
        },
      });

      res.status(200).json({
        success: true,
        data: {
          bot: {
            id: bot.id,
            walletAddress: bot.walletAddress,
            username: bot.username,
            characterId: bot.characterId,
            totalWins: bot.totalWins,
            totalGames: bot.totalGames,
            totalEarnings: bot.totalEarnings,
            winRate: botWithHistory.winRate,
            createdAt: bot.createdAt,
          },
          stats: {
            totalCollisions: totalCollisions._sum.collisions || 0,
            avgCollisionsPerGame:
              bot.totalGames > 0
                ? Math.round(
                    ((totalCollisions._sum.collisions || 0) / bot.totalGames) * 10
                  ) / 10
                : 0,
            bestCompletionTime: bestTime
              ? {
                  time: bestTime.completionTime,
                  arena: bestTime.game.arena,
                }
              : null,
            arenaBreakdown: Object.values(arenaStats).sort((a, b) => a.tier - b.tier),
          },
          activeGames: activeGames.map((ag) => ({
            gameId: ag.gameId,
            arenaName: ag.game.arena.name,
            arenaTier: ag.game.arena.tier,
            status: ag.game.status,
            position: ag.position,
            eliminated: ag.eliminated,
          })),
          recentGames: botWithHistory.recentGames.map((rg: any) => ({
            gameId: rg.gameId,
            arenaName: rg.game.arena.name,
            arenaTier: rg.game.arena.tier,
            position: rg.position,
            completionTime: rg.completionTime,
            collisions: rg.collisions,
            eliminated: rg.eliminated,
            status: rg.game.status,
            playedAt: rg.game.createdAt,
          })),
        },
      });
    } catch (error: any) {
      logger.error(`Get bot stats error: ${error.message}`);
      next(error);
    }
  },

  /**
   * GET /api/stats/global/overview
   * Get global platform statistics.
   */
  async getGlobalStats(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const totalBots = await prisma.bot.count();
      const totalGames = await prisma.game.count({
        where: { status: GameStatus.COMPLETED },
      });
      const activeGames = await prisma.game.count({
        where: {
          status: {
            notIn: [GameStatus.COMPLETED, GameStatus.CANCELLED],
          },
        },
      });

      const totalPrizePool = await prisma.game.aggregate({
        where: { status: GameStatus.COMPLETED },
        _sum: { prizePool: true },
      });

      const totalMoves = await prisma.move.count();

      res.status(200).json({
        success: true,
        data: {
          totalBots,
          totalGamesCompleted: totalGames,
          activeGames,
          totalPrizeDistributed: totalPrizePool._sum.prizePool || 0,
          totalMoves,
        },
      });
    } catch (error: any) {
      logger.error(`Get global stats error: ${error.message}`);
      next(error);
    }
  },
};

export default StatsController;
