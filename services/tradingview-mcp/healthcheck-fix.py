#!/usr/bin/env python3
"""Health check for the MCP service in streamable-http mode.

In FastMCP streamable-http mode the default GET /health endpoint may return
404 (route not registered) or 406 (Not Acceptable before SSE acceptance), both
of which still mean the server process is alive and listening. Only connection
errors are treated as unhealthy.
"""
import sys
import urllib.request

try:
    resp = urllib.request.urlopen("http://localhost:8000/health", timeout=5)
    status = resp.status
except urllib.error.HTTPError as exc:  # noqa: N812
    status = exc.code
except Exception:
    status = 0

if 200 <= status < 600:
    print(f"healthy (status {status})")
    sys.exit(0)
print(f"unhealthy (status {status})")
sys.exit(1)
