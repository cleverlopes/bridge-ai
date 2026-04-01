#!/usr/bin/env bash
# gemini-wrapper.sh — Normalize Gemini CLI output to match the bridge-ai sentinel pattern.
#
# Wraps the `gemini` CLI so that half-loop.sh can use it interchangeably with
# the Claude CLI. Passes all arguments through to `gemini`, then ensures the
# completion sentinel is present in stdout if Gemini reports successful completion.
#
# Usage (set BRIDGE_AI_CMD):
#   export BRIDGE_AI_CMD="/path/to/ai-cli-wrappers/gemini-wrapper.sh"
set -euo pipefail

GEMINI_CMD="${GEMINI_COMMAND:-gemini}"
COMPLETION_PROMISE="${BRIDGE_COMPLETION_PROMISE:-<promise>COMPLETE</promise>}"

# Pass all args through to the Gemini CLI
OUTPUT="$("${GEMINI_CMD}" "$@" 2>&1)"
EXIT_CODE=$?

echo "${OUTPUT}"

# If Gemini exited successfully and output contains done/complete indicators,
# emit the sentinel so half-loop.sh can detect completion.
if [[ ${EXIT_CODE} -eq 0 ]]; then
  if echo "${OUTPUT}" | grep -qiE \
    "task.*complete|all.*done|work.*complete|successfully completed|${COMPLETION_PROMISE}"; then
    echo "${COMPLETION_PROMISE}"
  fi
fi

exit ${EXIT_CODE}
