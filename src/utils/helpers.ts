import { v4 as uuidv4 } from 'crypto';

export function generateId(): string {
  return crypto.randomUUID();
}

export function formatDecimal(value: number, decimals: number = 2): string {
  return value.toFixed(decimals);
}

export function calculatePrize(pool: string | number): { winnerPrize: string; creatorFee: string } {
  const poolNum = typeof pool === 'string' ? parseFloat(pool) : pool;
  const winnerPrize = (poolNum * 0.9).toFixed(2);
  const creatorFee = (poolNum * 0.1).toFixed(2);
  return { winnerPrize, creatorFee };
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}
