import { ethers } from 'ethers';
import { logger } from '../utils/logger';

// BotArena contract ABI (key functions for game management)
const BOT_ARENA_ABI = [
  'function createGame(uint256 arenaId) external payable returns (uint256 gameId)',
  'function joinGame(uint256 gameId) external payable',
  'function completeGame(uint256 gameId, address winner) external',
  'function getGameParticipants(uint256 gameId) external view returns (address[])',
  'function getGameInfo(uint256 gameId) external view returns (uint256 arenaId, address[] participants, address winner, uint256 prizePool, uint8 status)',
  'function withdrawPrize(uint256 gameId) external',
  'function getArenaEntryFee(uint256 arenaId) external view returns (uint256)',
  'event GameCreated(uint256 indexed gameId, uint256 indexed arenaId, address creator)',
  'event GameJoined(uint256 indexed gameId, address indexed player)',
  'event GameCompleted(uint256 indexed gameId, address indexed winner, uint256 prize)',
  'event PrizeWithdrawn(uint256 indexed gameId, address indexed winner, uint256 amount)',
];

// ERC20 ABI for USDC interactions
const ERC20_ABI = [
  'function balanceOf(address owner) external view returns (uint256)',
  'function transfer(address to, uint256 amount) external returns (bool)',
  'function transferFrom(address from, address to, uint256 amount) external returns (bool)',
  'function approve(address spender, uint256 amount) external returns (bool)',
  'function allowance(address owner, address spender) external view returns (uint256)',
  'event Transfer(address indexed from, address indexed to, uint256 value)',
];

// Provider setup for Base chain
const getProvider = (): ethers.JsonRpcProvider => {
  const rpcUrl =
    process.env.NODE_ENV === 'production'
      ? process.env.BASE_RPC_URL || 'https://mainnet.base.org'
      : process.env.BASE_SEPOLIA_RPC_URL || 'https://sepolia.base.org';

  return new ethers.JsonRpcProvider(rpcUrl);
};

// Wallet setup from private key
const getWallet = (): ethers.Wallet | null => {
  const privateKey = process.env.PRIVATE_KEY;
  if (!privateKey) {
    logger.warn('PRIVATE_KEY not set. Blockchain write operations will fail.');
    return null;
  }

  const provider = getProvider();
  return new ethers.Wallet(privateKey, provider);
};

// Contract instance for BotArena
const getArenaContract = (): ethers.Contract | null => {
  const contractAddress = process.env.ARENA_CONTRACT_ADDRESS;
  if (!contractAddress) {
    logger.warn('ARENA_CONTRACT_ADDRESS not set. Contract interactions will fail.');
    return null;
  }

  const wallet = getWallet();
  if (!wallet) {
    // Return read-only contract with provider
    const provider = getProvider();
    return new ethers.Contract(contractAddress, BOT_ARENA_ABI, provider);
  }

  return new ethers.Contract(contractAddress, BOT_ARENA_ABI, wallet);
};

// USDC contract instance
const getUsdcContract = (): ethers.Contract | null => {
  const usdcAddress = process.env.USDC_ADDRESS;
  if (!usdcAddress) {
    logger.warn('USDC_ADDRESS not set.');
    return null;
  }

  const wallet = getWallet();
  if (!wallet) {
    const provider = getProvider();
    return new ethers.Contract(usdcAddress, ERC20_ABI, provider);
  }

  return new ethers.Contract(usdcAddress, ERC20_ABI, wallet);
};

export const provider = getProvider();
export const wallet = getWallet();
export const arenaContract = getArenaContract();
export const usdcContract = getUsdcContract();
export { BOT_ARENA_ABI, ERC20_ABI, getProvider, getWallet, getArenaContract, getUsdcContract };
