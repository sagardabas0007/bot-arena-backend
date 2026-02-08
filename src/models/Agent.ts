import { prisma } from '../config/database';
import { Agent as PrismaAgent } from '@prisma/client';
import crypto from 'crypto';

export interface AgentWithBot extends PrismaAgent {
  bot: {
    id: string;
    walletAddress: string;
    username: string;
    characterId: number;
    totalWins: number;
    totalGames: number;
    totalEarnings: any;
  };
}

export const AgentModel = {
  /**
   * Create a new agent with a linked bot
   */
  async create(name: string, description?: string): Promise<AgentWithBot> {
    const agentUuid = crypto.randomUUID();
    const apiKey = `ba_${crypto.randomUUID().replace(/-/g, '')}`;
    const syntheticWallet = `agent-${agentUuid}`;

    // Create bot first, then agent in a transaction
    const result = await prisma.$transaction(async (tx) => {
      const bot = await tx.bot.create({
        data: {
          walletAddress: syntheticWallet,
          username: name,
          characterId: Math.floor(Math.random() * 10),
        },
      });

      const agent = await tx.agent.create({
        data: {
          name,
          apiKey,
          botId: bot.id,
          description: description || null,
        },
        include: {
          bot: true,
        },
      });

      return agent;
    });

    return result as AgentWithBot;
  },

  /**
   * Find agent by API key
   */
  async findByApiKey(apiKey: string): Promise<AgentWithBot | null> {
    return prisma.agent.findUnique({
      where: { apiKey },
      include: { bot: true },
    }) as Promise<AgentWithBot | null>;
  },

  /**
   * Find agent by ID
   */
  async findById(id: string): Promise<AgentWithBot | null> {
    return prisma.agent.findUnique({
      where: { id },
      include: { bot: true },
    }) as Promise<AgentWithBot | null>;
  },

  /**
   * Update agent skill rating
   */
  async updateSkillRating(id: string, rating: number): Promise<PrismaAgent> {
    return prisma.agent.update({
      where: { id },
      data: { skillRating: rating },
    });
  },
};

export default AgentModel;
