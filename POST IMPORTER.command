#!/bin/bash

cd "$(dirname "$0")" || exit 1

URL="http://127.0.0.1:5057/"

open "$URL"
TS_BRANCH=production npm run story:importer
