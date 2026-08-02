#!/usr/bin/env bash
set -e
cd "$(dirname "$0")"
glib-compile-schemas schemas/
zip -r custom-launcher@nexus.dev.zip \
  extension.js prefs.js metadata.json stylesheet.css \
  schemas lib -x "*.git*"
