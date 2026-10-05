#!/usr/bin/env python3
"""A forward proxy that only tunnels HTTPS, for cutting one Claude Code session off from Claude.

Start it, start a dev session that goes through it, and stop it to stage an
outage for that session alone. Start it again and the outage is over.

    scripts/outage-proxy.py 18080 &
    scripts/dev-session.sh --settings '{"env":{"HTTPS_PROXY":"http://127.0.0.1:18080","NO_PROXY":"127.0.0.1,localhost"}}'
    kill %1                           # the outage
    scripts/outage-proxy.py 18080 &   # and its end

NO_PROXY matters: Claude Code serves a mod's own tools on a loopback port,
and without it tries to reach them through this proxy, which refuses.
"""
import asyncio
import sys


async def pipe(reader: asyncio.StreamReader, writer: asyncio.StreamWriter) -> None:
    try:
        while data := await reader.read(65536):
            writer.write(data)
            await writer.drain()
    except (ConnectionError, asyncio.CancelledError):
        pass
    finally:
        writer.close()


async def serve(client_reader: asyncio.StreamReader, client_writer: asyncio.StreamWriter) -> None:
    try:
        head = await client_reader.readuntil(b'\r\n\r\n')
        method, target, _ = head.split(b'\r\n', 1)[0].split(b' ', 2)
        if method != b'CONNECT':
            client_writer.write(b'HTTP/1.1 405 Method Not Allowed\r\n\r\n')
            await client_writer.drain()
            client_writer.close()
            return
        host, port = target.decode().rsplit(':', 1)
        upstream_reader, upstream_writer = await asyncio.open_connection(host, int(port))
        client_writer.write(b'HTTP/1.1 200 Connection Established\r\n\r\n')
        await client_writer.drain()
        await asyncio.gather(pipe(client_reader, upstream_writer), pipe(upstream_reader, client_writer))
    except Exception:  # a client that hung up, or a host that could not be reached
        client_writer.close()


async def main() -> None:
    if len(sys.argv) != 2 or not sys.argv[1].isdigit():
        sys.exit('usage: outage-proxy.py <port>')
    server = await asyncio.start_server(serve, '127.0.0.1', int(sys.argv[1]))
    async with server:
        await server.serve_forever()


if __name__ == '__main__':
    asyncio.run(main())
