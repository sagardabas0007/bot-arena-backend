import { Request, Response, NextFunction } from 'express';
import { AgentModel } from '../models/Agent';
import logger from '../utils/logger';

export interface AgentRequest extends Request {
  agent?: {
    id: string;
    name: string;
    botId: string;
    skillRating: number;
  };
}

export function agentAuthMiddleware(req: AgentRequest, res: Response, next: NextFunction): void {
  const apiKey = req.headers['x-agent-key'] as string;

  if (!apiKey) {
    res.status(401).json({
      success: false,
      error: 'Missing x-agent-key header',
    });
    return;
  }

  if (!apiKey.startsWith('ba_')) {
    res.status(401).json({
      success: false,
      error: 'Invalid API key format. Keys must start with "ba_"',
    });
    return;
  }

  AgentModel.findByApiKey(apiKey)
    .then((agent) => {
      if (!agent) {
        res.status(401).json({
          success: false,
          error: 'Invalid API key',
        });
        return;
      }

      if (!agent.isActive) {
        res.status(403).json({
          success: false,
          error: 'Agent account is deactivated',
        });
        return;
      }

      req.agent = {
        id: agent.id,
        name: agent.name,
        botId: agent.botId,
        skillRating: agent.skillRating,
      };

      logger.debug(`Agent authenticated: ${agent.name} (${agent.id})`);
      next();
    })
    .catch((err) => {
      logger.error(`Agent auth error: ${err.message}`);
      res.status(500).json({
        success: false,
        error: 'Authentication error',
      });
    });
}

export default agentAuthMiddleware;
