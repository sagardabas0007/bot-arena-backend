import { ethers } from 'ethers';
import { arenaContract, usdcContract, provider } from '../config/blockchain';
import { logger } from '../utils/logger';

export const ContractService = {
  /**
   * Create a new game on-chain.
   *
   * @param arenaId - The arena tier/ID for the game
   * @returns The transaction hash
   */
  async createGameOnChain(arenaId: string): Promise<string | null> {
    if (!arenaContract) {
      logger.warn('Arena contract not configured. Skipping on-chain game creation.');
      return null;
    }

    try {
      const tx = await arenaContract.createGame(arenaId);
      const receipt = await tx.wait();

      logger.info(`Game created on-chain. TX: ${receipt.hash}`);

      // Parse the GameCreated event to get the on-chain game ID
      const event = receipt.logs.find((log: any) => {
        try {
          const parsed = arenaContract!.interface.parseLog(log);
          return parsed?.name === 'GameCreated';
        } catch {
          return false;
        }
      });

      if (event) {
        const parsed = arenaContract.interface.parseLog(event);
        if (parsed) {
          logger.info(`On-chain game ID: ${parsed.args.gameId.toString()}`);
        }
      }

      return receipt.hash;
    } catch (error: any) {
      logger.error(`Failed to create game on-chain: ${error.message}`);
      throw new Error(`On-chain game creation failed: ${error.message}`);
    }
  },

  /**
   * Complete a game on-chain and trigger prize distribution.
   *
   * @param gameId - The game ID (or on-chain game ID)
   * @param winnerAddress - The wallet address of the winner
   * @returns The transaction hash
   */
  async completeGameOnChain(
    gameId: string,
    winnerAddress: string
  ): Promise<string | null> {
    if (!arenaContract) {
      logger.warn('Arena contract not configured. Skipping on-chain game completion.');
      return null;
    }

    try {
      // Validate the winner address
      if (!ethers.isAddress(winnerAddress)) {
        throw new Error(`Invalid winner address: ${winnerAddress}`);
      }

      const tx = await arenaContract.completeGame(gameId, winnerAddress);
      const receipt = await tx.wait();

      logger.info(
        `Game ${gameId} completed on-chain. Winner: ${winnerAddress}. TX: ${receipt.hash}`
      );

      return receipt.hash;
    } catch (error: any) {
      logger.error(`Failed to complete game on-chain: ${error.message}`);
      throw new Error(`On-chain game completion failed: ${error.message}`);
    }
  },

  /**
   * Get the list of participants for a game from the contract.
   *
   * @param gameId - The on-chain game ID
   * @returns Array of participant wallet addresses
   */
  async getGameParticipants(gameId: string): Promise<string[]> {
    if (!arenaContract) {
      logger.warn('Arena contract not configured. Cannot fetch on-chain participants.');
      return [];
    }

    try {
      const participants = await arenaContract.getGameParticipants(gameId);
      return participants.map((addr: string) => ethers.getAddress(addr));
    } catch (error: any) {
      logger.error(`Failed to get on-chain participants: ${error.message}`);
      return [];
    }
  },

  /**
   * Verify a USDC payment transaction on Base.
   *
   * @param txHash - The transaction hash to verify
   * @returns Object with verification result and payment details
   */
  async verifyPayment(
    txHash: string
  ): Promise<{
    verified: boolean;
    from: string | null;
    to: string | null;
    amount: string | null;
  }> {
    if (!provider) {
      logger.warn('Provider not configured. Cannot verify payment.');
      return { verified: false, from: null, to: null, amount: null };
    }

    try {
      const receipt = await provider.getTransactionReceipt(txHash);

      if (!receipt) {
        logger.warn(`Transaction ${txHash} not found or not yet mined.`);
        return { verified: false, from: null, to: null, amount: null };
      }

      // Check if transaction was successful
      if (receipt.status !== 1) {
        logger.warn(`Transaction ${txHash} failed on-chain.`);
        return { verified: false, from: null, to: null, amount: null };
      }

      // Parse USDC Transfer events
      const usdcAddress = process.env.USDC_ADDRESS;
      if (!usdcAddress || !usdcContract) {
        logger.warn('USDC contract not configured for payment verification.');
        return { verified: false, from: null, to: null, amount: null };
      }

      // Look for Transfer event in logs
      for (const log of receipt.logs) {
        if (log.address.toLowerCase() === usdcAddress.toLowerCase()) {
          try {
            const parsed = usdcContract.interface.parseLog(log);
            if (parsed && parsed.name === 'Transfer') {
              const from = parsed.args.from;
              const to = parsed.args.to;
              const amount = ethers.formatUnits(parsed.args.value, 6); // USDC has 6 decimals

              logger.info(
                `Payment verified: ${from} -> ${to}, Amount: ${amount} USDC, TX: ${txHash}`
              );

              return {
                verified: true,
                from,
                to,
                amount,
              };
            }
          } catch {
            // Not a Transfer event from USDC, continue
          }
        }
      }

      logger.warn(`No USDC Transfer event found in transaction ${txHash}.`);
      return { verified: false, from: null, to: null, amount: null };
    } catch (error: any) {
      logger.error(`Failed to verify payment: ${error.message}`);
      return { verified: false, from: null, to: null, amount: null };
    }
  },

  /**
   * Get the entry fee for an arena from the contract.
   */
  async getArenaEntryFee(arenaId: string): Promise<string | null> {
    if (!arenaContract) {
      return null;
    }

    try {
      const fee = await arenaContract.getArenaEntryFee(arenaId);
      return ethers.formatUnits(fee, 6); // USDC 6 decimals
    } catch (error: any) {
      logger.error(`Failed to get arena entry fee: ${error.message}`);
      return null;
    }
  },

  /**
   * Get game info from the contract.
   */
  async getGameInfo(
    gameId: string
  ): Promise<{
    arenaId: string;
    participants: string[];
    winner: string;
    prizePool: string;
    status: number;
  } | null> {
    if (!arenaContract) {
      return null;
    }

    try {
      const info = await arenaContract.getGameInfo(gameId);
      return {
        arenaId: info.arenaId.toString(),
        participants: info.participants,
        winner: info.winner,
        prizePool: ethers.formatUnits(info.prizePool, 6),
        status: Number(info.status),
      };
    } catch (error: any) {
      logger.error(`Failed to get game info: ${error.message}`);
      return null;
    }
  },
};

export default ContractService;
