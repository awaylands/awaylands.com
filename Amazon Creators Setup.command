#!/bin/bash

set -e

PROJECT_DIR="/Users/amyseder/Documents/awaylands.com"
ENV_FILE="$PROJECT_DIR/.amazon-creators.env"

printf '\nAway Lands Amazon Creators API setup\n\n'
printf 'Before continuing, delete the credential that was shared in chat and create a replacement.\n'
printf 'The values entered here remain only on this Mac and are excluded from Git.\n\n'

read -r -p 'Replacement Credential ID: ' AMAZON_CREDENTIAL_ID
read -r -s -p 'Replacement Secret (hidden while typing): ' AMAZON_CREDENTIAL_SECRET
printf '\n'
read -r -p 'Amazon Associates tracking ID [awaylandsllc-20]: ' AMAZON_PARTNER_TAG
AMAZON_PARTNER_TAG="${AMAZON_PARTNER_TAG:-awaylandsllc-20}"

umask 077
{
  printf 'AMAZON_CREATORS_CREDENTIAL_ID=%s\n' "$AMAZON_CREDENTIAL_ID"
  printf 'AMAZON_CREATORS_CREDENTIAL_SECRET=%s\n' "$AMAZON_CREDENTIAL_SECRET"
  printf 'AMAZON_ASSOCIATES_TAG=%s\n' "$AMAZON_PARTNER_TAG"
  printf 'AMAZON_MARKETPLACE=www.amazon.com\n'
} > "$ENV_FILE"

chmod 600 "$ENV_FILE"

printf '\nSaved securely to %s\n' "$ENV_FILE"
printf 'This file is ignored by Git. You may now close this window.\n\n'
read -r -p 'Press Return to close.' _
