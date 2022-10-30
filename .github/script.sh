#!/bin/bash
for d in ./src/functions/ ; do (cd "$d" && yarn install); done
ls
echo "end?"