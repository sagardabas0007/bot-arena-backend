import { Request, Response, NextFunction } from 'express';
import { validationResult } from 'express-validator';
import { BotModel } from '../models/Bot';
import { logger } from '../utils/logger';

export const BotController = {
  /**
   * POST /api/bot/register
   * Register a new bot with wallet address, username, and character ID.
   */
  async registerBot(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ success: false, errors: errors.array() });
        return;
      }

      const { walletAddress, username, characterId } = req.body;

      // Check if wallet is already registered
      const existingBot = await BotModel.findByWallet(walletAddress);
      if (existingBot) {
        res.status(200).json({
          success: true,
          message: 'Bot already registered',
          data: {
            id: existingBot.id,
            walletAddress: existingBot.walletAddress,
            username: existingBot.username,
            characterId: existingBot.characterId,
            totalWins: existingBot.totalWins,
            totalGames: existingBot.totalGames,
            totalEarnings: existingBot.totalEarnings,
          },
        });
        return;
      }

      const bot = await BotModel.create(walletAddress, username, characterId);

      logger.info(`New bot registered: ${username} (${walletAddress})`);

      res.status(201).json({
        success: true,
        message: 'Bot registered successfully',
        data: {
          id: bot.id,
          walletAddress: bot.walletAddress,
          username: bot.username,
          characterId: bot.characterId,
          totalWins: bot.totalWins,
          totalGames: bot.totalGames,
          totalEarnings: bot.totalEarnings,
        },
      });
    } catch (error: any) {
      logger.error(`Register bot error: ${error.message}`);
      if (error.code === 'P2002') {
        res.status(409).json({
          success: false,
          error: 'Wallet address already registered',
        });
        return;
      }
      next(error);
    }
  },

  /**
   * GET /api/bot/:walletAddress
   * Get bot info by wallet address.
   */
  async getBot(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { walletAddress } = req.params;
      const bot = await BotModel.findByWallet(walletAddress);

      if (!bot) {
        res.status(404).json({ success: false, error: 'Bot not found' });
        return;
      }

      res.status(200).json({
        success: true,
        data: {
          id: bot.id,
          walletAddress: bot.walletAddress,
          username: bot.username,
          characterId: bot.characterId,
          totalWins: bot.totalWins,
          totalGames: bot.totalGames,
          totalEarnings: bot.totalEarnings,
          createdAt: bot.createdAt,
        },
      });
    } catch (error: any) {
      logger.error(`Get bot error: ${error.message}`);
      next(error);
    }
  },

  /**
   * GET /api/bot/leaderboard
   * Get the global bot leaderboard.
   */
  async getLeaderboard(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const limit = parseInt(req.query.limit as string) || 20;
      const sortBy = (req.query.sortBy as 'wins' | 'earnings') || 'wins';

      const bots = await BotModel.getLeaderboard(limit, sortBy);

      res.status(200).json({
        success: true,
        data: bots.map((bot, index) => ({
          rank: index + 1,
          id: bot.id,
          walletAddress: bot.walletAddress,
          username: bot.username,
          characterId: bot.characterId,
          totalWins: bot.totalWins,
          totalGames: bot.totalGames,
          totalEarnings: bot.totalEarnings,
          winRate:
            bot.totalGames > 0
              ? Math.round((bot.totalWins / bot.totalGames) * 100)
              : 0,
        })),
      });
    } catch (error: any) {
      logger.error(`Get leaderboard error: ${error.message}`);
      next(error);
    }
  },
};

export default BotController;
