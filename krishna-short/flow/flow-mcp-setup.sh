#!/bin/bash
# Installs flow-mcp (https://github.com/GTAI-1/flow-mcp) in a Claude Code cloud session.
# The Google sign-in is NOT saved: sign in again in each new session.
DIR=/opt/flow-mcp
if [ ! -f "$DIR/dist/index.js" ]; then
  rm -rf "$DIR"
  git clone --depth 1 https://github.com/GTAI-1/flow-mcp.git "$DIR" || exit 1
  cd "$DIR" || exit 1
  npm install --no-audit --no-fund || exit 1
  npm run build || exit 1
fi
# Chrome for flow-mcp: starts its own virtual screen (:99) when needed, runs as root, uses the session's proxy.
cat > /usr/local/bin/flow-chrome <<'EOF'
#!/bin/sh
# Chrome for flow-mcp: starts its own virtual screen (:99) when needed, runs as root, uses the session's proxy.
# A resumed machine can keep /tmp and the profile but not the processes, so clear leftovers from the last run.
export DISPLAY=:99
if ! pgrep -x Xvfb >/dev/null 2>&1; then
  rm -f /tmp/.X11-unix/X99 /tmp/.X99-lock
  setsid Xvfb :99 -screen 0 1280x900x24 -nolisten tcp >/dev/null 2>&1 < /dev/null &
  sleep 1.5
fi
if [ -z "$(pgrep -f "user-data-dir=.*chrome-profile" | grep -vx "$$")" ]; then   # none but this script
  rm -f "${FLOW_MCP_HOME:-$HOME/.flow-mcp}"/chrome-profile/Singleton*
fi
exec /usr/bin/google-chrome --no-sandbox ${HTTPS_PROXY:+--proxy-server=$HTTPS_PROXY} --window-position=0,0 --window-size=1280,900 "$@"
EOF
chmod +x /usr/local/bin/flow-chrome
# Make the flow tools available to Claude in new sessions, if the claude command is installed at this point.
if command -v claude >/dev/null 2>&1; then
  claude mcp remove --scope user flow >/dev/null 2>&1
  claude mcp add --scope user flow -e DISPLAY=:99 -e FLOW_MCP_CHROME=/usr/local/bin/flow-chrome -- node "$DIR/dist/index.js"
fi
echo "flow-mcp installed in $DIR"
