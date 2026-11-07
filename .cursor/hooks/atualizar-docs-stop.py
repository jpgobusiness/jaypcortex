#!/usr/bin/env python3
"""Se o agente mudou código e não atualizou a doc canônica, pede um follow-up."""
from __future__ import annotations

import json
import subprocess
import sys

DOC = "docs/contexto-plataforma.md"
CODE_PREFIXES = (
    "app/",
    "components/",
    "lib/",
    "prisma/",
    "public/",
    "middleware",
    "next.config",
    "package.json",
    "package-lock.json",
)
SKIP_PREFIXES = ("docs/", ".cursor/")
CODE_SUFFIXES = (".ts", ".tsx", ".js", ".jsx", ".css", ".prisma", ".sql")


def read_payload() -> dict:
    raw = sys.stdin.read()
    if not raw.strip():
        return {}
    try:
        data = json.loads(raw)
    except json.JSONDecodeError:
        return {}
    return data if isinstance(data, dict) else {}


def git_changed_paths() -> list[str] | None:
    try:
        result = subprocess.run(
            ["git", "status", "--porcelain", "-uall"],
            capture_output=True,
            text=True,
            check=False,
        )
    except OSError:
        return None
    if result.returncode != 0:
        return None
    paths: list[str] = []
    for line in result.stdout.splitlines():
        if len(line) < 4:
            continue
        path = line[3:].strip().strip('"')
        if " -> " in path:
            path = path.split(" -> ")[-1]
        paths.append(path)
    return paths


def is_code(path: str) -> bool:
    if path.startswith(SKIP_PREFIXES):
        return False
    if path.startswith(CODE_PREFIXES) or path in CODE_PREFIXES:
        return True
    return path.endswith(CODE_SUFFIXES)


def main() -> None:
    payload = read_payload()
    if payload.get("status") != "completed":
        print("{}")
        return
    if int(payload.get("loop_count") or 0) > 0:
        print("{}")
        return

    changed = git_changed_paths()
    if not changed:
        print("{}")
        return

    code_changed = any(is_code(path) for path in changed)
    doc_updated = DOC in changed
    if code_changed and not doc_updated:
        print(
            json.dumps(
                {
                    "followup_message": (
                        "A melhoria de código terminou sem atualizar "
                        "docs/contexto-plataforma.md. Atualize a fonte da verdade "
                        "(estado atual, módulos, tabelas, auth, rotas) para refletir "
                        "o que mudou. Não peça confirmação. Depois encerre."
                    )
                },
                ensure_ascii=False,
            )
        )
        return
    print("{}")


if __name__ == "__main__":
    main()
