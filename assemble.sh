#!/bin/sh
# Builds the deployable site folder from the artifact version in ../
set -e
cd "$(dirname "$0")"
python3 make_hosted.py ../index.html site/index.html
for d in spin frames img; do mkdir -p site/$d; cp -R ../$d/. site/$d/ 2>/dev/null || true; done
