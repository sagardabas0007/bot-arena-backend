import { body, param, query, validationResult } from 'express-validator';
import { Request, Response, NextFunction } from 'express';

function handleValidationErrors(req: Request, res: Response, next: NextFunction): void {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({
      success: false,
      errors: errors.array().map((e) => ({ field: (e as any).path, message: e.msg })),
    });
    return;
  }
  next();
}

export const validateGameCreate = [
  body('arenaId').isInt({ min: 1, max: 5 }).withMessage('arenaId must be between 1 and 5'),
  body('walletAddress').isString().matches(/^0x[a-fA-F0-9]{40}$/).withMessage('Invalid wallet address'),
  handleValidationErrors,
];

export const validateGameJoin = [
  body('gameId').isString().notEmpty().withMessage('gameId is required'),
  body('walletAddress').isString().matches(/^0x[a-fA-F0-9]{40}$/).withMessage('Invalid wallet address'),
  body('characterId').isInt({ min: 0, max: 9 }).withMessage('characterId must be between 0 and 9'),
  handleValidationErrors,
];

export const validateMove = [
  param('id').isString().notEmpty().withMessage('Game ID is required'),
  body('botId').isString().notEmpty().withMessage('botId is required'),
  body('fromX').isInt({ min: 0 }).withMessage('fromX must be non-negative integer'),
  body('fromY').isInt({ min: 0 }).withMessage('fromY must be non-negative integer'),
  body('toX').isInt({ min: 0 }).withMessage('toX must be non-negative integer'),
  body('toY').isInt({ min: 0 }).withMessage('toY must be non-negative integer'),
  handleValidationErrors,
];

export const validateBotRegister = [
  body('walletAddress').isString().matches(/^0x[a-fA-F0-9]{40}$/).withMessage('Invalid wallet address'),
  body('username').isString().isLength({ min: 2, max: 20 }).withMessage('Username must be 2-20 characters'),
  body('characterId').isInt({ min: 0, max: 9 }).withMessage('characterId must be between 0 and 9'),
  handleValidationErrors,
];

export const validateLeaderboardQuery = [
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('limit must be 1-100'),
  query('sortBy').optional().isIn(['wins', 'earnings']).withMessage('sortBy must be wins or earnings'),
  handleValidationErrors,
];
