#!/bin/bash
export ANDROID_HOME="/mnt/c/Users/mvmayconsantos/AppData/Local/Android/Sdk"
export ANDROID_SDK_ROOT="$ANDROID_HOME"
export PATH="$HOME/.bun/bin:$HOME/.nvm/versions/node/v24.18.0/bin:$PATH"
export PATH="$PATH:$ANDROID_HOME/platform-tools:$ANDROID_HOME/cmdline-tools/latest/bin"

exec bun expo run:android "$@"
