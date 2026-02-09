-- =====================================================
-- Bot Arena Backend - Supabase Database Schema
-- =====================================================
-- This file contains the complete database schema for the Bot Arena backend
-- Run this in your Supabase SQL Editor to set up the database
-- =====================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- ENUMS
-- =====================================================

CREATE TYPE "GameStatus" AS ENUM (
  'WAITING',
  'LEVEL_1',
  'LEVEL_2',
  'LEVEL_3',
  'COMPLETED',
  'CANCELLED'
);

-- =====================================================
-- TABLES
-- =====================================================

-- Arena Table
CREATE TABLE "Arena" (
    "id" TEXT NOT NULL DEFAULT uuid_generate_v4()::TEXT,
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
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Arena_pkey" PRIMARY KEY ("id")
);

-- Bot Table
CREATE TABLE "Bot" (
    "id" TEXT NOT NULL DEFAULT uuid_generate_v4()::TEXT,
    "walletAddress" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "characterId" INTEGER NOT NULL,
    "totalWins" INTEGER NOT NULL DEFAULT 0,
    "totalGames" INTEGER NOT NULL DEFAULT 0,
    "totalEarnings" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Bot_pkey" PRIMARY KEY ("id")
);

-- Game Table
CREATE TABLE "Game" (
    "id" TEXT NOT NULL DEFAULT uuid_generate_v4()::TEXT,
    "arenaId" TEXT NOT NULL,
    "status" "GameStatus" NOT NULL DEFAULT 'WAITING',
    "currentLevel" INTEGER NOT NULL DEFAULT 1,
    "prizePool" DECIMAL(10,2) NOT NULL,
    "winnerId" TEXT,
    "startTime" TIMESTAMP(3),
    "endTime" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Game_pkey" PRIMARY KEY ("id")
);

-- Agent Table
CREATE TABLE "Agent" (
    "id" TEXT NOT NULL DEFAULT uuid_generate_v4()::TEXT,
    "name" TEXT NOT NULL,
    "apiKey" TEXT NOT NULL,
    "botId" TEXT NOT NULL,
    "description" TEXT,
    "skillRating" INTEGER NOT NULL DEFAULT 1000,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Agent_pkey" PRIMARY KEY ("id")
);

-- BotGame Table (Junction table for Bot-Game many-to-many relationship)
CREATE TABLE "BotGame" (
    "id" TEXT NOT NULL DEFAULT uuid_generate_v4()::TEXT,
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

-- Move Table
CREATE TABLE "Move" (
    "id" TEXT NOT NULL DEFAULT uuid_generate_v4()::TEXT,
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

-- =====================================================
-- UNIQUE CONSTRAINTS
-- =====================================================

ALTER TABLE "Arena" ADD CONSTRAINT "Arena_tier_key" UNIQUE ("tier");
ALTER TABLE "Bot" ADD CONSTRAINT "Bot_walletAddress_key" UNIQUE ("walletAddress");
ALTER TABLE "Agent" ADD CONSTRAINT "Agent_apiKey_key" UNIQUE ("apiKey");
ALTER TABLE "Agent" ADD CONSTRAINT "Agent_botId_key" UNIQUE ("botId");
ALTER TABLE "BotGame" ADD CONSTRAINT "BotGame_botId_gameId_key" UNIQUE ("botId", "gameId");

-- =====================================================
-- FOREIGN KEY CONSTRAINTS
-- =====================================================

ALTER TABLE "Game" ADD CONSTRAINT "Game_arenaId_fkey" 
    FOREIGN KEY ("arenaId") REFERENCES "Arena"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Game" ADD CONSTRAINT "Game_winnerId_fkey" 
    FOREIGN KEY ("winnerId") REFERENCES "Bot"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Agent" ADD CONSTRAINT "Agent_botId_fkey" 
    FOREIGN KEY ("botId") REFERENCES "Bot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "BotGame" ADD CONSTRAINT "BotGame_botId_fkey" 
    FOREIGN KEY ("botId") REFERENCES "Bot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "BotGame" ADD CONSTRAINT "BotGame_gameId_fkey" 
    FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Move" ADD CONSTRAINT "Move_gameId_fkey" 
    FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Move" ADD CONSTRAINT "Move_botId_fkey" 
    FOREIGN KEY ("botId") REFERENCES "Bot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- =====================================================
-- INDEXES FOR PERFORMANCE
-- =====================================================

CREATE INDEX "Arena_tier_idx" ON "Arena"("tier");
CREATE INDEX "Game_arenaId_status_idx" ON "Game"("arenaId", "status");
CREATE INDEX "Game_status_idx" ON "Game"("status");
CREATE INDEX "Bot_walletAddress_idx" ON "Bot"("walletAddress");
CREATE INDEX "Agent_apiKey_idx" ON "Agent"("apiKey");
CREATE INDEX "BotGame_gameId_idx" ON "BotGame"("gameId");
CREATE INDEX "BotGame_botId_idx" ON "BotGame"("botId");
CREATE INDEX "Move_gameId_botId_idx" ON "Move"("gameId", "botId");

-- =====================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- =====================================================

-- Disable RLS for all tables since we're using custom authentication middleware
-- The application handles authorization through wallet addresses and API keys

ALTER TABLE "Arena" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "Bot" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "Game" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "Agent" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "BotGame" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "Move" DISABLE ROW LEVEL SECURITY;

-- =====================================================
-- TRIGGERS FOR UPDATED_AT
-- =====================================================

-- Create a function to update the updatedAt timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW."updatedAt" = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply the trigger to tables with updatedAt column
CREATE TRIGGER update_arena_updated_at BEFORE UPDATE ON "Arena"
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_bot_updated_at BEFORE UPDATE ON "Bot"
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_game_updated_at BEFORE UPDATE ON "Game"
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_agent_updated_at BEFORE UPDATE ON "Agent"
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- INITIAL DATA (Optional - Sample Arenas)
-- =====================================================

-- Uncomment the following to insert sample arena data
/*
INSERT INTO "Arena" ("tier", "name", "entryFee", "difficulty", "gridRows", "gridCols", "obstacleCount", "timeLimit", "description") VALUES
(1, 'Beginner Arena', 1.00, 'Easy', 10, 10, 5, 300, 'Perfect for newcomers to learn the basics'),
(2, 'Intermediate Arena', 5.00, 'Medium', 15, 15, 15, 240, 'Test your skills against tougher challenges'),
(3, 'Advanced Arena', 10.00, 'Hard', 20, 20, 30, 180, 'Only for experienced players'),
(4, 'Expert Arena', 25.00, 'Very Hard', 25, 25, 50, 150, 'The ultimate challenge for masters'),
(5, 'Champion Arena', 50.00, 'Extreme', 30, 30, 75, 120, 'Legends are born here');
*/

-- =====================================================
-- VERIFICATION QUERIES
-- =====================================================

-- Run these queries to verify the schema was created correctly

-- Check all tables exist
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_type = 'BASE TABLE'
ORDER BY table_name;

-- Check all indexes
SELECT tablename, indexname 
FROM pg_indexes 
WHERE schemaname = 'public'
ORDER BY tablename, indexname;

-- Check foreign keys
SELECT
    tc.table_name, 
    kcu.column_name, 
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name 
FROM information_schema.table_constraints AS tc 
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
  AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
  AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY'
AND tc.table_schema = 'public'
ORDER BY tc.table_name;
