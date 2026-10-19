#!/bin/sh
# Nightly pg_dump with 14-day retention.
set -e
while true; do
  STAMP=$(date -u +%Y-%m-%dT%H-%M-%SZ)
  pg_dump -h db -U marutime -d marutime -Fc -f "/backups/marutime-$STAMP.dump" && echo "backup written: marutime-$STAMP.dump"
  find /backups -name 'marutime-*.dump' -mtime +14 -delete
  sleep 86400
done
