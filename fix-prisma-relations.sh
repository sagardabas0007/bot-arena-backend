#!/bin/bash

# Fix Prisma relation names from lowercase to capitalized

echo "Fixing Prisma relation names..."

# Fix 'game:' to 'Game:' in include/select/where clauses
find src -name "*.ts" -type f -exec sed -i '' 's/game: {/Game: {/g' {} \;
find src -name "*.ts" -type f -exec sed -i '' 's/game:/Game:/g' {} \;

# Fix 'arena:' to 'Arena:' in include/select/where clauses  
find src -name "*.ts" -type f -exec sed -i '' 's/arena: {/Arena: {/g' {} \;
find src -name "*.ts" -type f -exec sed -i '' 's/arena:/Arena:/g' {} \;

# Fix 'bot:' to 'Bot:' in include/select/where clauses
find src -name "*.ts" -type f -exec sed -i '' 's/bot: {/Bot: {/g' {} \;
find src -name "*.ts" -type f -exec sed -i '' 's/bot:/Bot:/g' {} \;

# Fix '.game.' to '.Game.' property access
find src -name "*.ts" -type f -exec sed -i '' 's/\.game\./\.Game\./g' {} \;

# Fix '.arena.' to '.Arena.' property access
find src -name "*.ts" -type f -exec sed -i '' 's/\.arena\./\.Arena\./g' {} \;

# Fix '.bot.' to '.Bot.' property access
find src -name "*.ts" -type f -exec sed -i '' 's/\.bot\./\.Bot\./g' {} \;

# Fix 'participants:' to 'BotGame:' (relation name in schema)
find src -name "*.ts" -type f -exec sed -i '' 's/participants:/BotGame:/g' {} \;

# Fix 'gamesPlayed:' to 'BotGame:' (relation name in schema)
find src -name "*.ts" -type f -exec sed -i '' 's/gamesPlayed:/BotGame:/g' {} \;

# Fix 'winner:' to use winnerId instead (it's not a relation, just an ID field)
# This one needs manual review

echo "Done! Please review the changes."
