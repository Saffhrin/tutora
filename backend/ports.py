"""Free-port discovery, so Tutora runs next to whatever else owns 8000/5173.

A second local project already listening on the default ports must never stop
Tutora from starting. Every component that needs a port goes through this module:

* ``python -m backend.main`` resolves the API port with :func:`resolve`.
* ``scripts/dev.sh`` asks ``python -m backend.ports --kind api|web``.
* ``frontend/vite.config.ts`` reads ``TUTORA_API_PORT`` / ``TUTORA_WEB_PORT``.

Only the standard library is used here, so the probe works before any
requirement is installed.
"""

from __future__ import annotations

import argparse
import os
import socket
import sys
from typing import Iterator

DEFAULT_HOST = "127.0.0.1"
DEFAULT_API_PORT = 8000
DEFAULT_WEB_PORT = 5173
SEARCH_LIMIT = 100

API_PORT_ENV = "TUTORA_API_PORT"
API_HOST_ENV = "TUTORA_API_HOST"
API_URL_ENV = "TUTORA_API_URL"
WEB_PORT_ENV = "TUTORA_WEB_PORT"
WEB_HOST_ENV = "TUTORA_WEB_HOST"

KINDS = ("api", "web")


class PortUnavailable(RuntimeError):
    """No free port could be found for the requested host/range."""


def parse_port(value: str | int | None, *, name: str, default: int) -> int:
    """Interpret a port from env/CLI, refusing anything that is not a port."""
    if value is None or value == "":
        return default
    try:
        port = int(value)
    except (TypeError, ValueError):
        raise ValueError(f"{name} must be a whole number between 0 and 65535, got {value!r}.") from None
    if not 0 <= port <= 65535:
        raise ValueError(f"{name} must be between 0 and 65535, got {port}.")
    return port


def env_port(name: str, default: int) -> int:
    return parse_port(os.environ.get(name), name=name, default=default)


def env_host(name: str, default: str = DEFAULT_HOST) -> str:
    return os.environ.get(name) or default


def kind_env_names(kind: str) -> tuple[str, str]:
    """(port env var, host env var) for ``"api"`` or ``"web"``."""
    kind = kind.lower()
    if kind == "api":
        return API_PORT_ENV, API_HOST_ENV
    if kind == "web":
        return WEB_PORT_ENV, WEB_HOST_ENV
    raise ValueError(f"unknown kind {kind!r}; expected one of {', '.join(KINDS)}.")


def default_port(kind: str) -> int:
    return DEFAULT_API_PORT if kind.lower() == "api" else DEFAULT_WEB_PORT


def label(kind: str) -> str:
    return "API" if kind.lower() == "api" else "web dev server"


def is_port_free(port: int, host: str = DEFAULT_HOST) -> bool:
    """True when nothing is listening on ``host:port`` right now.

    ``SO_REUSEADDR`` keeps sockets left in ``TIME_WAIT`` from looking busy, while
    a process still listening (on this host or on ``0.0.0.0``) is detected.
    A port taken on some unrelated interface only is not reported here.
    """
    if port == 0:  # 0 means "any free port" to the OS, so it can never be taken
        return True
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as probe:
        probe.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        try:
            probe.bind((host, port))
        except OSError:
            return False
    return True


def candidate_ports(preferred: int, limit: int = SEARCH_LIMIT) -> Iterator[int]:
    """The preferred port first, then the following ones, stopping at 65535."""
    for offset in range(max(limit, 0) + 1):
        port = preferred + offset
        if port > 65535:
            return
        yield port


def find_free_port(preferred: int, host: str = DEFAULT_HOST, limit: int = SEARCH_LIMIT) -> int:
    for port in candidate_ports(preferred, limit):
        if is_port_free(port, host):
            return port
    raise PortUnavailable(
        f"no free port on {host} in {preferred}-{min(preferred + limit, 65535)}: "
        f"stop the other process, or set {API_PORT_ENV}/{WEB_PORT_ENV} to a free port."
    )


def resolve(
    kind: str,
    *,
    preferred: int | None = None,
    host: str | None = None,
    limit: int = SEARCH_LIMIT,
    strict: bool = False,
) -> tuple[int, bool, str]:
    """Pick a usable port for ``kind``.

    Returns ``(port, moved, host)`` where ``moved`` is True when the preferred
    port was taken and the next free one is used instead. With ``strict`` the
    port is never moved and a busy port raises :class:`PortUnavailable`.
    """
    port_env, host_env = kind_env_names(kind)
    host = host or env_host(host_env)
    wanted = env_port(port_env, default_port(kind)) if preferred is None else parse_port(
        preferred, name="--port", default=default_port(kind))
    if strict:
        if not is_port_free(wanted, host):
            raise PortUnavailable(
                f"{host}:{wanted} is already in use (another project?); "
                f"free it or set {port_env} to a free port."
            )
        return wanted, False, host
    port = find_free_port(wanted, host, limit)
    return port, port != wanted, host


def moved_notice(kind: str, host: str, wanted: int, port: int) -> str:
    return (
        f"{label(kind)}: {host}:{wanted} is already in use (another project?), "
        f"using {host}:{port} instead."
    )


def main(argv: list[str] | None = None) -> int:
    """CLI used by ``scripts/dev.sh``: prints the chosen port on stdout."""
    parser = argparse.ArgumentParser(
        prog="python -m backend.ports",
        description="Find a free port for the Tutora API or Vite dev server.",
    )
    parser.add_argument("--kind", choices=KINDS, default="api")
    parser.add_argument("--port", type=int, default=None,
                        help=f"preferred port (default: ${API_PORT_ENV} or ${WEB_PORT_ENV}, else 8000/5173)")
    parser.add_argument("--host", default=None, help=f"interface to bind (default {DEFAULT_HOST})")
    parser.add_argument("--strict", action="store_true", help="fail instead of moving to the next free port")
    parser.add_argument("--check", type=int, metavar="PORT",
                        help="only report whether PORT is free ('free'/'in use', exit 0/1)")
    args = parser.parse_args(argv)

    if args.check is not None:
        free = is_port_free(args.check, args.host or DEFAULT_HOST)
        print("free" if free else "in use")
        return 0 if free else 1

    try:
        # `wanted` is the *preference* (env or --port) so the move notice names the
        # port that was actually taken, not the replacement.
        wanted = args.port if args.port is not None else env_port(
            kind_env_names(args.kind)[0], default_port(args.kind))
        port, moved, host = resolve(args.kind, preferred=wanted, host=args.host, strict=args.strict)
    except (ValueError, PortUnavailable) as error:
        print(f"Tutora: {error}", file=sys.stderr)
        return 2
    if moved:
        print(moved_notice(args.kind, host, wanted, port), file=sys.stderr)
    print(port)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
