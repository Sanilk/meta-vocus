#!/usr/bin/env bash

# Start the STM32 dashboard server from the frontend folder.
# Make executable: chmod +x start-dashboard.sh
cd "$(dirname "$0")"
exec node server.js
