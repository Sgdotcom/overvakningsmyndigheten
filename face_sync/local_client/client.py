from __future__ import annotations

import mimetypes
from dataclasses import dataclass
from typing import Any

import requests


@dataclass(frozen=True)
class FaceSyncClient:
    base_url: str
    token: str
    timeout_sec: int = 20

    def _headers(self) -> dict[str, str]:
        return {"Authorization": f"Bearer {self.token}"}

    def upload_jpeg_bytes(
        self,
        jpeg_bytes: bytes,
        *,
        name: str | None = None,
        source: str | None = None,
        filename: str = "capture.jpg",
    ) -> dict[str, Any]:
        url = f"{self.base_url.rstrip('/')}/api/captures"
        files = {"image": (filename, jpeg_bytes, "image/jpeg")}
        data: dict[str, str] = {}
        if name:
            data["name"] = name
        if source:
            data["source"] = source

        r = requests.post(
            url,
            headers=self._headers(),
            files=files,
            data=data,
            timeout=self.timeout_sec,
        )
        r.raise_for_status()
        return r.json()

    def upload_file(
        self,
        path: str,
        *,
        name: str | None = None,
        source: str | None = None,
    ) -> dict[str, Any]:
        url = f"{self.base_url.rstrip('/')}/api/captures"
        content_type, _ = mimetypes.guess_type(path)
        content_type = content_type or "application/octet-stream"
        data: dict[str, str] = {}
        if name:
            data["name"] = name
        if source:
            data["source"] = source

        with open(path, "rb") as f:
            files = {"image": (path.split("/")[-1], f, content_type)}
            r = requests.post(
                url,
                headers=self._headers(),
                files=files,
                data=data,
                timeout=self.timeout_sec,
            )
        r.raise_for_status()
        return r.json()

    def list_captures(self, *, since: int = 0, limit: int = 100) -> dict[str, Any]:
        url = f"{self.base_url.rstrip('/')}/api/captures"
        r = requests.get(
            url,
            headers=self._headers(),
            params={"since": since, "limit": limit},
            timeout=self.timeout_sec,
        )
        r.raise_for_status()
        return r.json()

    def download_capture(self, capture_id: int) -> requests.Response:
        url = f"{self.base_url.rstrip('/')}/api/captures/{capture_id}/file"
        r = requests.get(url, headers=self._headers(), stream=True, timeout=self.timeout_sec)
        r.raise_for_status()
        return r

