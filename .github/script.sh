#!/bin/bash
for d in ./src/functions/* ; do (cd "$d" && yarn install && echo "insalled packages for $d"); done
echo "All function packages have been intsalled"