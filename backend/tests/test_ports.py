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


def free_port() -> int:
    sock, port = occupy()
    sock.close()
    return port


def test_is_port_free_sees_a_listener():
    sock, port = occupy()
    try:
        assert ports.is_port_free(port) is False
    finally:
        sock.close()
    assert ports.is_port_free(port) is True


def test_find_free_port_keeps_the_preference_when_it_is_free():
    port = free_port()
    assert ports.find_free_port(port) == port


def test_busy_preferred_port_moves_to_the_next_one():
    first, busy = occupy()
    spare, _ = occupy()
    spare.close()  # only `busy` stays taken, so the scan must land on busy + 1
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
    notice = ports.moved_notice("api", host, busy, port)
    assert f"127.0.0.1:{busy} is already in use" in notice
    assert f"using 127.0.0.1:{port} instead" in notice


def test_resolve_honours_environment_preference(monkeypatch):
    free = free_port()
    monkeypatch.setenv(ports.API_PORT_ENV, str(free))
    assert ports.resolve("api")[:2] == (free, False)
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


def test_port_taken_on_all_interfaces_is_detected():
    """A dev server bound to 0.0.0.0:8000 still blocks 127.0.0.1:8000."""
    sock, busy = occupy("0.0.0.0")
    try:
        assert ports.is_port_free(busy) is False
        assert ports.find_free_port(busy) == busy + 1
    finally:
        sock.close()


@pytest.mark.parametrize("value", ["", None, 1, 8080, "8080", 8000.0])
def test_parse_port_accepts_real_ports(value):
    assert ports.parse_port(value, name="X", default=8000) in (8000, 1, 8080)


@pytest.mark.parametrize("value", ["eighty", "70000", -1, 0, "0", 8000.5, True])
def test_parse_port_rejects_nonsense(value):
    """Port 0 is rejected: the OS would pick a number we cannot print or proxy to."""
    with pytest.raises(ValueError):
        ports.parse_port(value, name="TUTORA_API_PORT", default=8000)


def test_is_port_free_rejects_out_of_range_ports():
    for bad in (70000, 0, -1):
        with pytest.raises(ValueError):
            ports.is_port_free(bad)


def test_env_file_supplies_ports_without_overriding_the_environment(tmp_path, monkeypatch):
    env_file = tmp_path / ".env"
    env_file.write_text("# a comment\nTUTORA_API_PORT=8123\nTUTORA_WEB_PORT='5180'\n")
    monkeypatch.delenv("TUTORA_API_PORT", raising=False)
    monkeypatch.delenv("TUTORA_WEB_PORT", raising=False)
    loaded = ports.load_env_file(env_file)
    assert loaded["TUTORA_API_PORT"] == "8123"
    assert ports.env_port("TUTORA_WEB_PORT", ports.DEFAULT_WEB_PORT) == 5180
    monkeypatch.setenv("TUTORA_API_PORT", "9000")  # the real environment wins over the file
    assert ports.env_port("TUTORA_API_PORT", ports.DEFAULT_API_PORT) == 9000


def test_cli_prints_the_port_for_dev_sh(monkeypatch, capsys):
    sock, busy = occupy()
    try:
        monkeypatch.setenv(ports.API_PORT_ENV, str(busy))
        assert ports.main(["--kind", "api"]) == 0
    finally:
        sock.close()
    captured = capsys.readouterr()
    # only the port on stdout, so `$(python -m backend.ports)` is safe
    assert captured.out.strip() == str(busy + 1)
    # the reason is on stderr, and it names the port that was actually taken
    assert f"127.0.0.1:{busy} is already in use" in captured.err
    assert f"using 127.0.0.1:{busy + 1} instead" in captured.err


def test_cli_check_reports_occupancy_and_rejects_bad_ports(capsys):
    sock, busy = occupy()
    try:
        assert ports.main(["--check", str(busy)]) == 1
    finally:
        sock.close()
    assert ports.main(["--check", str(busy)]) == 0
    assert ports.main(["--check", "70000"]) == 2
    assert "65535" in capsys.readouterr().err


def test_cli_rejects_a_bad_port_value(monkeypatch, capsys):
    monkeypatch.setenv(ports.API_PORT_ENV, "not-a-port")
    assert ports.main(["--kind", "api"]) == 2
    assert "TUTORA_API_PORT" in capsys.readouterr().err


def test_cli_strict_refuses_a_busy_port(capsys):
    sock, busy = occupy()
    try:
        assert ports.main(["--kind", "api", "--port", str(busy), "--strict"]) == 2
    finally:
        sock.close()
    assert "already in use" in capsys.readouterr().err
