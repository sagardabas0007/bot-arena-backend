import { Server, Socket } from 'socket.io';
import logger from '../utils/logger';
import { emitGameStart, emitGameUpdate, emitMoveResult, emitCollision, emitError } from './gameEvents';

export interface BotPosition {
  botId: string;
  x: number;
  y: number;
  characterId: number;
}

export interface GameGrid {
  rows: number;
  cols: number;
  obstacles: { x: number; y: number }[];
}

interface GameRoom {
  gameId: string;
  players: Map<string, { socketId: string; botId: string; ready: boolean }>;
  botPositions: Map<string, BotPosition>;
}

const activeGames = new Map<string, GameRoom>();

export function setupSocketHandler(io: Server): void {
  io.on('connection', (socket: Socket) => {
    logger.info(`Socket connected: ${socket.id}`);

    socket.on('game:join', ({ gameId, botId }: { gameId: string; botId: string }) => {
      if (!gameId || !botId) {
        emitError(io, socket.id, 'gameId and botId are required');
        return;
      }

      socket.join(`game:${gameId}`);

      if (!activeGames.has(gameId)) {
        activeGames.set(gameId, {
          gameId,
          players: new Map(),
          botPositions: new Map(),
        });
      }

      const room = activeGames.get(gameId)!;
      room.players.set(botId, { socketId: socket.id, botId, ready: false });
      room.botPositions.set(botId, { botId, x: 0, y: 0, characterId: 0 });

      logger.info(`Bot ${botId} joined game ${gameId}. Players: ${room.players.size}`);

      io.to(`game:${gameId}`).emit('game:player_joined', {
        gameId,
        botId,
        playerCount: room.players.size,
      });
    });

    socket.on('game:ready', ({ gameId, botId }: { gameId: string; botId: string }) => {
      const room = activeGames.get(gameId);
      if (!room) return;

      const player = room.players.get(botId);
      if (player) {
        player.ready = true;
      }

      const allReady = Array.from(room.players.values()).every((p) => p.ready);
      if (allReady && room.players.size >= 2) {
        logger.info(`All players ready in game ${gameId}. Starting...`);
        const grid: GameGrid = { rows: 10, cols: 10, obstacles: [] };
        emitGameStart(io, gameId, 1, grid);
      }
    });

    socket.on('game:move', ({ gameId, botId, move }: {
      gameId: string;
      botId: string;
      move: { fromX: number; fromY: number; toX: number; toY: number };
    }) => {
      const room = activeGames.get(gameId);
      if (!room) {
        emitError(io, socket.id, 'Game not found');
        return;
      }

      const currentPos = room.botPositions.get(botId);
      if (!currentPos) {
        emitError(io, socket.id, 'Bot not in game');
        return;
      }

      // Validate move (one cell in any cardinal direction)
      const dx = Math.abs(move.toX - move.fromX);
      const dy = Math.abs(move.toY - move.fromY);
      if ((dx + dy) !== 1) {
        emitError(io, socket.id, 'Invalid move: must move exactly one cell');
        return;
      }

      // Update position
      room.botPositions.set(botId, {
        ...currentPos,
        x: move.toX,
        y: move.toY,
      });

      emitMoveResult(io, gameId, botId, {
        success: true,
        isCollision: false,
        newPosition: { x: move.toX, y: move.toY },
      });

      // Broadcast updated positions
      emitGameUpdate(io, gameId, Array.from(room.botPositions.values()));
    });

    socket.on('disconnect', () => {
      logger.info(`Socket disconnected: ${socket.id}`);

      // Clean up player from active games
      for (const [gameId, room] of activeGames.entries()) {
        for (const [botId, player] of room.players.entries()) {
          if (player.socketId === socket.id) {
            room.players.delete(botId);
            room.botPositions.delete(botId);
            logger.info(`Bot ${botId} disconnected from game ${gameId}`);

            io.to(`game:${gameId}`).emit('game:player_left', {
              gameId,
              botId,
              playerCount: room.players.size,
            });

            if (room.players.size === 0) {
              activeGames.delete(gameId);
            }
            break;
          }
        }
      }
    });
  });
}
