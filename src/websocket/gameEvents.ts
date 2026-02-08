import { Server } from 'socket.io';
import { GameGrid, BotPosition } from './socketHandler';
import logger from '../utils/logger';

export function emitGameStart(
  io: Server,
  gameId: string,
  level: number,
  grid: GameGrid
): void {
  logger.info(`Game ${gameId} Level ${level} starting`);
  io.to(`game:${gameId}`).emit('game:start', {
    gameId,
    level,
    startTime: Date.now(),
    grid,
  });
}

export function emitGameUpdate(
  io: Server,
  gameId: string,
  botPositions: BotPosition[]
): void {
  io.to(`game:${gameId}`).emit('game:update', { gameId, botPositions });
}

export function emitMoveResult(
  io: Server,
  gameId: string,
  botId: string,
  result: { success: boolean; isCollision: boolean; newPosition: { x: number; y: number } }
): void {
  io.to(`game:${gameId}`).emit('game:move_result', { botId, ...result });
}

export function emitCollision(
  io: Server,
  gameId: string,
  botId: string,
  position: { x: number; y: number }
): void {
  logger.info(`Bot ${botId} collision in game ${gameId}`);
  io.to(`game:${gameId}`).emit('game:collision', { botId, position });
}

export function emitLevelComplete(
  io: Server,
  gameId: string,
  level: number,
  qualified: string[],
  eliminated: string[]
): void {
  logger.info(`Game ${gameId} Level ${level} complete. Qualified: ${qualified.length}, Eliminated: ${eliminated.length}`);
  io.to(`game:${gameId}`).emit('game:level_complete', {
    level,
    qualified,
    eliminated,
  });
}

export function emitWinner(
  io: Server,
  gameId: string,
  winnerId: string,
  prize: string
): void {
  logger.info(`Game ${gameId} winner: ${winnerId}, prize: ${prize}`);
  io.to(`game:${gameId}`).emit('game:winner', { gameId, winnerId, prize });
}

export function emitPoolUpdate(
  io: Server,
  gameId: string,
  newTotal: string
): void {
  io.to(`game:${gameId}`).emit('pool:update', { gameId, newTotal });
}

export function emitError(
  io: Server,
  socketId: string,
  message: string
): void {
  io.to(socketId).emit('error', { message });
}
