#!/bin/sh
set -e
cd /app/node_modules/xactions
npx prisma migrate deploy
exec node api/server.js
