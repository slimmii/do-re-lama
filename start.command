#!/bin/bash
# Dubbelklik om Do Re Lama te starten.
cd "$(dirname "$0")"
[ -d node_modules ] || npm install
npm run dev
