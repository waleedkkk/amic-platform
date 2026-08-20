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

# ---------------------------------------------------------------------------
# AMIC additional fix: TradingView scanner rate-limits (HTTP 429 with an
# EMPTY body) any request whose User-Agent is the "tradingview_ta/x.x.x"
# library signature — especially from datacenter IPs. The library builds
# its own headers dict on every call, so a default-headers change is NOT
# enough; we monkeypatch requests.Session.request so explicitly-passed
# User-Agent values are rewritten to a plain browser UA.
# ---------------------------------------------------------------------------
_BROWSER_UA = (
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36"
)

def _rewrite_ua(headers):
    if not headers:
        return headers
    new = dict(headers)
    for key in list(new):
        if key.lower() == "user-agent":
            new[key] = _BROWSER_UA
    return new

try:
    import requests as _requests  # noqa: WPS433

    _orig_session_request = _requests.Session.request

    def _session_request_with_ua(self, method, url, headers=None, **kwargs):
        return _orig_session_request(self, method, url, headers=_rewrite_ua(headers), **kwargs)

    _requests.Session.request = _session_request_with_ua

    # urllib.request callers (tradingview_ta fallback paths, etc.)
    import urllib.request as _urllib  # noqa: WPS433

    _urllib.URLopener.version = _BROWSER_UA
    _urllib.FancyURLopener.version = _BROWSER_UA
except Exception:  # pragma: no cover — never block MCP startup
    pass
