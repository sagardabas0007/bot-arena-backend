-- CreateEnum
CREATE TYPE "GameStatus" AS ENUM ('WAITING', 'LEVEL_1', 'LEVEL_2', 'LEVEL_3', 'COMPLETED', 'CANCELLED');

-- CreateTable
CREATE TABLE "Arena" (
    "id" TEXT NOT NULL,
    "tier" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "entryFee" DECIMAL(10,2) NOT NULL,
    "difficulty" TEXT NOT NULL,
    "gridRows" INTEGER NOT NULL,
    "gridCols" INTEGER NOT NULL,
    "obstacleCount" INTEGER NOT NULL,
    "timeLimit" INTEGER NOT NULL,
    "description" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Arena_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Game" (
    "id" TEXT NOT NULL,
    "arenaId" TEXT NOT NULL,
    "status" "GameStatus" NOT NULL DEFAULT 'WAITING',
    "currentLevel" INTEGER NOT NULL DEFAULT 1,
    "prizePool" DECIMAL(10,2) NOT NULL,
    "winnerId" TEXT,
    "startTime" TIMESTAMP(3),
    "endTime" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Game_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Bot" (
    "id" TEXT NOT NULL,
    "walletAddress" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "characterId" INTEGER NOT NULL,
    "totalWins" INTEGER NOT NULL DEFAULT 0,
    "totalGames" INTEGER NOT NULL DEFAULT 0,
    "totalEarnings" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Bot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Agent" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "apiKey" TEXT NOT NULL,
    "botId" TEXT NOT NULL,
    "description" TEXT,
    "skillRating" INTEGER NOT NULL DEFAULT 1000,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Agent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BotGame" (
    "id" TEXT NOT NULL,
    "botId" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "completionTime" INTEGER,
    "collisions" INTEGER NOT NULL DEFAULT 0,
    "level1Time" INTEGER,
    "level2Time" INTEGER,
    "level3Time" INTEGER,
    "eliminated" BOOLEAN NOT NULL DEFAULT false,
    "eliminatedAt" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BotGame_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Move" (
    "id" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "botId" TEXT NOT NULL,
    "level" INTEGER NOT NULL,
    "fromX" INTEGER NOT NULL,
    "fromY" INTEGER NOT NULL,
    "toX" INTEGER NOT NULL,
    "toY" INTEGER NOT NULL,
    "moveNumber" INTEGER NOT NULL,
    "isCollision" BOOLEAN NOT NULL DEFAULT false,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Move_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Arena_tier_key" ON "Arena"("tier");

-- CreateIndex
CREATE INDEX "Arena_tier_idx" ON "Arena"("tier");

-- CreateIndex
CREATE INDEX "Game_arenaId_status_idx" ON "Game"("arenaId", "status");

-- CreateIndex
CREATE INDEX "Game_status_idx" ON "Game"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Bot_walletAddress_key" ON "Bot"("walletAddress");

-- CreateIndex
CREATE INDEX "Bot_walletAddress_idx" ON "Bot"("walletAddress");

-- CreateIndex
CREATE UNIQUE INDEX "Agent_apiKey_key" ON "Agent"("apiKey");

-- CreateIndex
CREATE UNIQUE INDEX "Agent_botId_key" ON "Agent"("botId");

-- CreateIndex
CREATE INDEX "Agent_apiKey_idx" ON "Agent"("apiKey");

-- CreateIndex
CREATE INDEX "BotGame_gameId_idx" ON "BotGame"("gameId");

-- CreateIndex
CREATE INDEX "BotGame_botId_idx" ON "BotGame"("botId");

-- CreateIndex
CREATE UNIQUE INDEX "BotGame_botId_gameId_key" ON "BotGame"("botId", "gameId");

-- CreateIndex
CREATE INDEX "Move_gameId_botId_idx" ON "Move"("gameId", "botId");

-- AddForeignKey
ALTER TABLE "Game" ADD CONSTRAINT "Game_arenaId_fkey" FOREIGN KEY ("arenaId") REFERENCES "Arena"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Game" ADD CONSTRAINT "Game_winnerId_fkey" FOREIGN KEY ("winnerId") REFERENCES "Bot"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Agent" ADD CONSTRAINT "Agent_botId_fkey" FOREIGN KEY ("botId") REFERENCES "Bot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BotGame" ADD CONSTRAINT "BotGame_botId_fkey" FOREIGN KEY ("botId") REFERENCES "Bot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BotGame" ADD CONSTRAINT "BotGame_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Move" ADD CONSTRAINT "Move_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Move" ADD CONSTRAINT "Move_botId_fkey" FOREIGN KEY ("botId") REFERENCES "Bot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
