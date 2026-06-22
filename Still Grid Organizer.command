#!/bin/bash

cd "$(dirname "$0")" || exit 1

URL="http://127.0.0.1:5055/"

open "$URL"
npm run still:grid
