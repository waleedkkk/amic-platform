"""
Disable MCP SDK Host-header validation inside Docker containers.

Inside containers the MCP server is reached through Docker DNS / the app
backend, so the streamable-HTTP transport security (DNS rebinding protection)
rejects every internal request with HTTP 421. FastMCP auto-enables this
protection when bound to 127.0.0.1 with allowed_hosts restricted to
"127.0.0.1:*" / "localhost:*" / "[::1]:*", which rejects all internal IPs and
service names like 172.21.0.2 or "tradingview-mcp".

This module, loaded automatically by Python at startup, forces the transport
security settings to permissive mode no matter how the server constructs them.
"""
import mcp.server.transport_security as _ts

# 1. Force permissive settings on every TransportSecuritySettings construction.
#    FastMCP explicitly builds settings with protection ENABLED, so we must
#    override the kwarg (not just setdefault).
_orig_init = _ts.TransportSecuritySettings.__init__

def _permissive(self, *args, **kwargs):
    kwargs["enable_dns_rebinding_protection"] = False
    _orig_init(self, *args, **kwargs)

_ts.TransportSecuritySettings.__init__ = _permissive

# 2. Belt-and-braces: make the middleware's header validation a no-op so that
#    even pre-built settings instances with protection enabled will pass.
def _always_valid(self, value):  # noqa: ARG001
    return True

_ts.TransportSecurityMiddleware._validate_host = _always_valid
_ts.TransportSecurityMiddleware._validate_origin = _always_valid
