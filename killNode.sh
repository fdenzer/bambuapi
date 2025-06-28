 kill $(lsof -t -i:3000 -i:8888) 2>/dev/null || true
 pkill -f "node server.js" || true