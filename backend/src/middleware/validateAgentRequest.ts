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

export const validateAgentRegister = [
  body('name')
    .isString()
    .isLength({ min: 2, max: 30 })
    .matches(/^[a-zA-Z0-9_-]+$/)
    .withMessage('Name must be 2-30 characters, alphanumeric with _ and - only'),
  body('description')
    .optional()
    .isString()
    .isLength({ max: 200 })
    .withMessage('Description must be 200 characters or less'),
  handleValidationErrors,
];

export const validateAgentJoinGame = [
  body('gameId')
    .isString()
    .notEmpty()
    .withMessage('gameId is required'),
  handleValidationErrors,
];

export const validateAgentCreateGame = [
  body('arenaId')
    .isString()
    .notEmpty()
    .withMessage('arenaId is required'),
  handleValidationErrors,
];

export const validateAgentMove = [
  param('gameId')
    .isString()
    .notEmpty()
    .withMessage('Game ID is required'),
  body('direction')
    .isString()
    .isIn(['up', 'down', 'left', 'right'])
    .withMessage('direction must be one of: up, down, left, right'),
  handleValidationErrors,
];

export const validateGameIdParam = [
  param('gameId')
    .isString()
    .notEmpty()
    .withMessage('Game ID is required'),
  handleValidationErrors,
];
