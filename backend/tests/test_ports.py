"""Port discovery: another project owning 8000/5173 must not stop Tutora."""

import socket

import pytest

from backend import ports


def occupy(host: str = "127.0.0.1"):
    """A real listening socket, like the 'other project' on the same machine."""
    sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    sock.bind((host, 0))
    sock.listen(1)
    return sock, sock.getsockname()[1]


def test_is_port_free_sees_a_listener():
    sock, port = occupy()
    try:
        assert ports.is_port_free(port) is False
    finally:
        sock.close()
    assert ports.is_port_free(port) is True


def test_find_free_port_keeps_the_preference_when_it_is_free():
    sock, port = occupy()
    sock.close()
    chosen = ports.find_free_port(port)
    assert chosen == port


def test_busy_preferred_port_moves_to_the_next_one():
    first, busy = occupy()
    second, _next = occupy()
    second.close()  # only `busy` stays taken, so the scan must land on busy + 1
    try:
        assert ports.find_free_port(busy) == busy + 1
    finally:
        first.close()


def test_resolve_reports_the_move_and_the_host():
    sock, busy = occupy()
    try:
        port, moved, host = ports.resolve("api", preferred=busy)
    finally:
        sock.close()
    assert (moved, host) == (True, ports.DEFAULT_HOST)
    assert port == busy + 1
    assert f"{busy} is already in use" in ports.moved_notice("api", host, busy, port)


def test_resolve_honours_environment_preference(monkeypatch):
    sock, free = occupy()
    sock.close()
    monkeypatch.setenv(ports.API_PORT_ENV, str(free))
    port, moved, _host = ports.resolve("api")
    assert (port, moved) == (free, False)
    monkeypatch.setenv(ports.WEB_PORT_ENV, str(free))
    assert ports.resolve("web")[0] == free


def test_strict_mode_refuses_to_move():
    sock, busy = occupy()
    try:
        with pytest.raises(ports.PortUnavailable) as error:
            ports.resolve("api", preferred=busy, strict=True)
    finally:
        sock.close()
    assert str(busy) in str(error.value)


def test_no_free_port_in_range_is_reported():
    sock, busy = occupy()
    try:
        with pytest.raises(ports.PortUnavailable):
            ports.find_free_port(busy, limit=0)
    finally:
        sock.close()


@pytest.mark.parametrize("value", ["", None, 0, 8080, "8080"])
def test_parse_port_accepts_real_ports(value):
    assert ports.parse_port(value, name="X", default=8000) in (8000, 0, 8080)


@pytest.mark.parametrize("value", ["eighty", "70000", -1, 8000.5])
def test_parse_port_rejects_nonsense(value):
    with pytest.raises(ValueError):
        ports.parse_port(value, name="TUTORA_API_PORT", default=8000)


def test_cli_prints_the_port_for_dev_sh(monkeypatch, capsys):
    sock, busy = occupy()
    try:
        monkeypatch.setenv(ports.API_PORT_ENV, str(busy))
        assert ports.main(["--kind", "api"]) == 0
    finally:
        sock.close()
    captured = capsys.readouterr()
    assert captured.out.strip() == str(busy + 1)
    assert "already in use" in captured.err  # the reason is on stderr, never stdout


def test_cli_check_reports_occupancy():
    sock, busy = occupy()
    try:
        assert ports.main(["--check", str(busy)]) == 1
    finally:
        sock.close()
    assert ports.main(["--check", str(busy)]) == 0


def test_cli_rejects_a_bad_port_value(monkeypatch):
    monkeypatch.setenv(ports.API_PORT_ENV, "not-a-port")
    assert ports.main(["--kind", "api"]) == 2


def test_port_taken_on_all_interfaces_is_detected():
    """A dev server bound to 0.0.0.0:8000 still blocks 127.0.0.1:8000."""
    sock, busy = occupy("0.0.0.0")
    try:
        assert ports.is_port_free(busy) is False
        assert ports.find_free_port(busy) == busy + 1
    finally:
        sock.close()
