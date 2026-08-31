#!/bin/bash
# Wait for MinIO to be ready
until mc alias set local http://localhost:9000 minioadmin minioadmin; do
  echo "Waiting for MinIO..."
  sleep 2
done

# Create bucket if it doesn't exist
mc mb local/decotrack-photos --ignore-existing
mc anonymous set download local/decotrack-photos/thumbnails

echo "MinIO bucket 'decotrack-photos' ready!"
