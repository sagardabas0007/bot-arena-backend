import { Request, Response, NextFunction } from 'express';
import logger from '../utils/logger';

export interface AuthenticatedRequest extends Request {
  walletAddress?: string;
}

export function authMiddleware(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  const walletAddress = req.headers['x-wallet-address'] as string;

  if (!walletAddress) {
    res.status(401).json({
      success: false,
      error: { message: 'Missing x-wallet-address header', statusCode: 401 },
    });
    return;
  }

  if (!/^0x[a-fA-F0-9]{40}$/.test(walletAddress)) {
    res.status(401).json({
      success: false,
      error: { message: 'Invalid wallet address format', statusCode: 401 },
    });
    return;
  }

  req.walletAddress = walletAddress.toLowerCase();
  logger.debug(`Authenticated request from ${req.walletAddress}`);
  next();
}
