#!/usr/bin/env sh
set -e

# Upstreams to wait for
UPSTREAMS="client:3000 server:4000 kibana:5601 grafana:3000 prometheus:9090"

echo ">> Waiting for upstream services..."

for service in $UPSTREAMS; do
  host=$(echo $service | cut -d':' -f1)
  port=$(echo $service | cut -d':' -f2)
  echo "   Waiting for $host:$port..."
  
  # Wait until TCP port is open
  while ! nc -z "$host" "$port"; do
    echo "     $host:$port not reachable yet. Sleeping 2s..."
    sleep 2
  done
  echo "   $host:$port is up!"
done

echo ">> All upstreams are reachable. Starting Nginx..."
exec nginx -g "daemon off;"
