import { prisma } from '../config/database';
import { Arena as PrismaArena, Prisma } from '@prisma/client';
import { logger } from '../utils/logger';

export interface ArenaData {
  tier: number;
  name: string;
  entryFee: number;
  difficulty: string;
  gridRows: number;
  gridCols: number;
  obstacleCount: number;
  timeLimit: number;
  description: string;
}

// Default arena tier configurations
const ARENA_TIERS: ArenaData[] = [
  {
    tier: 1,
    name: 'Bronze Pit',
    entryFee: 1.0,
    difficulty: 'Easy',
    gridRows: 8,
    gridCols: 8,
    obstacleCount: 5,
    timeLimit: 60,
    description: 'Entry-level arena with a small grid and few obstacles. Perfect for beginners.',
  },
  {
    tier: 2,
    name: 'Silver Forge',
    entryFee: 5.0,
    difficulty: 'Medium',
    gridRows: 12,
    gridCols: 12,
    obstacleCount: 12,
    timeLimit: 90,
    description: 'Mid-tier arena with a larger grid and more obstacles. For experienced players.',
  },
  {
    tier: 3,
    name: 'Gold Coliseum',
    entryFee: 15.0,
    difficulty: 'Hard',
    gridRows: 16,
    gridCols: 16,
    obstacleCount: 25,
    timeLimit: 120,
    description: 'High-stakes arena with a complex grid layout. Serious competition only.',
  },
  {
    tier: 4,
    name: 'Platinum Sanctum',
    entryFee: 50.0,
    difficulty: 'Expert',
    gridRows: 20,
    gridCols: 20,
    obstacleCount: 40,
    timeLimit: 150,
    description: 'Elite arena with dense obstacles and tight time limits. Top-tier players.',
  },
  {
    tier: 5,
    name: 'Diamond Nexus',
    entryFee: 100.0,
    difficulty: 'Legendary',
    gridRows: 24,
    gridCols: 24,
    obstacleCount: 60,
    timeLimit: 180,
    description: 'The ultimate battleground. Massive grid, extreme difficulty, legendary rewards.',
  },
];

export const ArenaModel = {
  /**
   * Find all active arenas
   */
  async findAll(): Promise<PrismaArena[]> {
    return prisma.arena.findMany({
      where: { isActive: true },
      orderBy: { tier: 'asc' },
    });
  },

  /**
   * Find arena by tier
   */
  async findByTier(tier: number): Promise<PrismaArena | null> {
    return prisma.arena.findUnique({
      where: { tier },
    });
  },

  /**
   * Find arena by ID
   */
  async findById(id: string): Promise<PrismaArena | null> {
    return prisma.arena.findUnique({
      where: { id },
    });
  },

  /**
   * Create a new arena
   */
  async create(data: ArenaData): Promise<PrismaArena> {
    return prisma.arena.create({
      data: {
        tier: data.tier,
        name: data.name,
        entryFee: new Prisma.Decimal(data.entryFee),
        difficulty: data.difficulty,
        gridRows: data.gridRows,
        gridCols: data.gridCols,
        obstacleCount: data.obstacleCount,
        timeLimit: data.timeLimit,
        description: data.description,
      },
    });
  },

  /**
   * Seed all 5 arena tiers into the database
   */
  async seedArenas(): Promise<void> {
    logger.info('Seeding arena tiers...');

    for (const arenaData of ARENA_TIERS) {
      const existing = await prisma.arena.findUnique({
        where: { tier: arenaData.tier },
      });

      if (!existing) {
        await prisma.arena.create({
          data: {
            tier: arenaData.tier,
            name: arenaData.name,
            entryFee: new Prisma.Decimal(arenaData.entryFee),
            difficulty: arenaData.difficulty,
            gridRows: arenaData.gridRows,
            gridCols: arenaData.gridCols,
            obstacleCount: arenaData.obstacleCount,
            timeLimit: arenaData.timeLimit,
            description: arenaData.description,
          },
        });
        logger.info(`Seeded arena tier ${arenaData.tier}: ${arenaData.name}`);
      } else {
        logger.info(`Arena tier ${arenaData.tier} already exists, skipping.`);
      }
    }

    logger.info('Arena seeding complete.');
  },
};

export default ArenaModel;
