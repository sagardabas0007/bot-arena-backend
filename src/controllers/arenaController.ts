import { Request, Response, NextFunction } from 'express';
import { ArenaModel } from '../models/Arena';
import { prisma } from '../config/database';
import { GameStatus } from '@prisma/client';
import { logger } from '../utils/logger';

export const ArenaController = {
  /**
   * GET /api/arena/list
   * List all active arenas with active game counts.
   */
  async listArenas(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const arenas = await ArenaModel.findAll();

      // Get active game counts for each arena
      const arenasWithCounts = await Promise.all(
        arenas.map(async (arena) => {
          const activeGameCount = await prisma.game.count({
            where: {
              arenaId: arena.id,
              status: {
                notIn: [GameStatus.COMPLETED, GameStatus.CANCELLED],
              },
            },
          });

          const waitingGameCount = await prisma.game.count({
            where: {
              arenaId: arena.id,
              status: GameStatus.WAITING,
            },
          });

          const totalGamesPlayed = await prisma.game.count({
            where: {
              arenaId: arena.id,
              status: GameStatus.COMPLETED,
            },
          });

          return {
            id: arena.id,
            tier: arena.tier,
            name: arena.name,
            entryFee: arena.entryFee,
            difficulty: arena.difficulty,
            gridRows: arena.gridRows,
            gridCols: arena.gridCols,
            obstacleCount: arena.obstacleCount,
            timeLimit: arena.timeLimit,
            description: arena.description,
            activeGames: activeGameCount,
            waitingGames: waitingGameCount,
            totalGamesPlayed,
          };
        })
      );

      res.status(200).json({
        success: true,
        data: arenasWithCounts,
      });
    } catch (error: any) {
      logger.error(`List arenas error: ${error.message}`);
      next(error);
    }
  },

  /**
   * GET /api/arena/:id
   * Get a specific arena by ID with details.
   */
  async getArena(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const arena = await ArenaModel.findById(id);

      if (!arena) {
        res.status(404).json({ success: false, error: 'Arena not found' });
        return;
      }

      // Get active games for this arena
      const activeGames = await prisma.game.findMany({
        where: {
          arenaId: arena.id,
          status: {
            notIn: [GameStatus.COMPLETED, GameStatus.CANCELLED],
          },
        },
        include: {
          _count: {
            select: { participants: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: 10,
      });

      // Get recent completed games
      const recentGames = await prisma.game.findMany({
        where: {
          arenaId: arena.id,
          status: GameStatus.COMPLETED,
        },
        include: {
          winner: {
            select: {
              username: true,
              walletAddress: true,
            },
          },
        },
        orderBy: { endTime: 'desc' },
        take: 5,
      });

      res.status(200).json({
        success: true,
        data: {
          ...arena,
          activeGames: activeGames.map((g) => ({
            id: g.id,
            status: g.status,
            prizePool: g.prizePool,
            participantCount: g._count.participants,
            maxParticipants: 10,
            createdAt: g.createdAt,
          })),
          recentGames: recentGames.map((g) => ({
            id: g.id,
            prizePool: g.prizePool,
            winner: g.winner
              ? {
                  username: g.winner.username,
                  walletAddress: g.winner.walletAddress,
                }
              : null,
            endTime: g.endTime,
          })),
        },
      });
    } catch (error: any) {
      logger.error(`Get arena error: ${error.message}`);
      next(error);
    }
  },

  /**
   * POST /api/arena/seed
   * Seed the arena tiers (admin/setup endpoint).
   */
  async seedArenas(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await ArenaModel.seedArenas();
      const arenas = await ArenaModel.findAll();

      res.status(200).json({
        success: true,
        message: 'Arenas seeded successfully',
        data: arenas,
      });
    } catch (error: any) {
      logger.error(`Seed arenas error: ${error.message}`);
      next(error);
    }
  },
};

export default ArenaController;
