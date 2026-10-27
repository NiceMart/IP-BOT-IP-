import json
import sqlite3
import sys
from pathlib import Path


def main() -> int:
    repo_root = Path(__file__).resolve().parent.parent
    db_path = repo_root / "data" / "database.db"
    out_path = repo_root / "build" / "runtime-system-subtitle-templates.json"

    if not db_path.exists():
        print(f"[export-runtime-system-templates] database not found: {db_path}")
        return 0

    out_path.parent.mkdir(parents=True, exist_ok=True)

    conn = sqlite3.connect(str(db_path))
    try:
        rows = conn.execute(
            """
            SELECT id, name, description, config, created_at
            FROM subtitle_templates
            WHERE is_system = 1
            ORDER BY created_at ASC
            """
        ).fetchall()

        templates = []
        for row in rows:
            config = row[3]
            templates.append(
                {
                    "id": row[0],
                    "name": row[1],
                    "description": row[2],
                    "config": json.loads(config) if isinstance(config, str) else config,
                    "createdAt": row[4],
                    "isSystem": True,
                    "is_system": 1,
                }
            )

        if len(templates) != 16:
            print(
                f"[export-runtime-system-templates] expected 16 system templates, got {len(templates)}; skipping export"
            )
            return 0

        out_path.write_text(json.dumps(templates, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        print(
            f"[export-runtime-system-templates] exported {len(templates)} templates to {out_path}"
        )
        return 0
    finally:
        conn.close()


if __name__ == "__main__":
    sys.exit(main())
