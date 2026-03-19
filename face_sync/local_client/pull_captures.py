from __future__ import annotations

import argparse
import json
import os
from pathlib import Path

from face_sync.local_client.client import FaceSyncClient


def load_state(path: Path) -> dict:
    if not path.exists():
        return {"since": 0}
    return json.loads(path.read_text(encoding="utf-8"))


def save_state(path: Path, state: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(state, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--base-url", required=True)
    ap.add_argument("--token", required=True)
    ap.add_argument("--out-dir", required=True)
    ap.add_argument("--state-file", required=True)
    ap.add_argument("--limit", type=int, default=200)
    args = ap.parse_args()

    out_dir = Path(args.out_dir).expanduser().resolve()
    out_dir.mkdir(parents=True, exist_ok=True)

    state_file = Path(args.state_file).expanduser().resolve()
    state = load_state(state_file)
    since = int(state.get("since", 0))

    client = FaceSyncClient(base_url=args.base_url, token=args.token)
    listing = client.list_captures(since=since, limit=args.limit)
    items = listing.get("items", [])

    max_id = since
    for item in items:
        cid = int(item["id"])
        filename = item.get("filename") or f"{cid}.jpg"
        name = (item.get("name") or "").strip()

        # optional name prefix for easier sorting
        safe_name = "".join(ch for ch in name if ch.isalnum() or ch in ("-", "_"))[:40]
        local_name = f"{cid:06d}_{safe_name + '_' if safe_name else ''}{filename}"
        local_path = out_dir / local_name
        if local_path.exists():
            max_id = max(max_id, cid)
            continue

        resp = client.download_capture(cid)
        with open(local_path, "wb") as f:
            for chunk in resp.iter_content(chunk_size=1024 * 256):
                if chunk:
                    f.write(chunk)

        max_id = max(max_id, cid)

    if max_id != since:
        state["since"] = max_id
        save_state(state_file, state)

    print(f"Downloaded {len(items)} item(s). since: {since} -> {max_id}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

