#!/bin/sh
set -eu

: "${VITE_FLASH_SALE_DEFAULT_SALE_ID:=default}"
: "${VITE_FLASH_SALE_API_BASE_URL:=http://localhost:3000}"

export VITE_FLASH_SALE_DEFAULT_SALE_ID VITE_FLASH_SALE_API_BASE_URL

envsubst '${VITE_FLASH_SALE_DEFAULT_SALE_ID} ${VITE_FLASH_SALE_API_BASE_URL}' \
  < /usr/share/nginx/html/env-config.template.js \
  > /usr/share/nginx/html/env-config.js
