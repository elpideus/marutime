#!/bin/sh
set -e
case "$1" in
  server)
    exec node apps/web/server.js
    ;;
  *)
    exec "$@"
    ;;
esac
