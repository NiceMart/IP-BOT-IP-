#!/usr/bin/env sh
# Modified for IP Bot: private configuration is loaded in server.js; no embedded JWT secret.
set -eu
cd "$(dirname "$0")"
exec node server.js
