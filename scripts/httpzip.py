"""Leitura de membros de ZIP remoto por HTTP Range (sem baixar o arquivo inteiro)."""
import io
import time
import urllib.request

UA = {"User-Agent": "panorama-brasil/1.0 (uso pessoal, dados abertos)"}


class HttpFile(io.RawIOBase):
    def __init__(self, url):
        self.url = url
        self.pos = 0
        req = urllib.request.Request(url, method="HEAD", headers=UA)
        with urllib.request.urlopen(req, timeout=60) as r:
            self.size = int(r.headers["Content-Length"])

    def seekable(self):
        return True

    def readable(self):
        return True

    def tell(self):
        return self.pos

    def seek(self, off, whence=0):
        self.pos = off if whence == 0 else self.pos + off if whence == 1 else self.size + off
        return self.pos

    def read(self, n=-1):
        if n < 0:
            n = self.size - self.pos
        if n == 0:
            return b""
        rng = f"bytes={self.pos}-{min(self.pos + n, self.size) - 1}"
        for tentativa in range(5):
            try:
                req = urllib.request.Request(self.url, headers={**UA, "Range": rng})
                with urllib.request.urlopen(req, timeout=300) as r:
                    d = r.read()
                break
            except Exception:
                if tentativa == 4:
                    raise
                time.sleep(3 * (tentativa + 1))
        self.pos += len(d)
        return d

    def readinto(self, b):
        d = self.read(len(b))
        b[: len(d)] = d
        return len(d)


class BufferedHttp(io.BufferedReader):
    """Lê em blocos grandes (8 MB) para não fazer uma requisição por linha."""

    def __init__(self, url):
        super().__init__(HttpFile(url), buffer_size=8 * 1024 * 1024)
