#!/bin/bash
# Wrapper script to run Claude CLI as non-root user
# This allows bypassing permissions without being blocked by the root user check

exec su -c "/var/lang/bin/claude $*" claudeuser
