"""
Convenience launcher for the Doctor Application.

    python run.py            # start on http://127.0.0.1:8000
    python run.py --reload   # auto reload during development
    python run.py --seed     # re-seed the database and exit
"""

from __future__ import annotations

import argparse
import os
import sys

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
BACKEND_DIR = os.path.join(BASE_DIR, "backend")

sys.path.insert(0, BACKEND_DIR)


def main() -> None:
    parser = argparse.ArgumentParser(description="Doctor Application server")
    # hosting platforms (Render, Railway, …) speak PORT/HOST via env vars
    parser.add_argument("--host", default=os.environ.get("HOST", "127.0.0.1"))
    parser.add_argument("--port", type=int, default=int(os.environ.get("PORT", "8010")))
    parser.add_argument("--reload", action="store_true")
    parser.add_argument("--seed", action="store_true", help="(re)seed the database then exit")
    parser.add_argument("--reset", action="store_true", help="wipe and re-seed the database")
    args = parser.parse_args()

    if args.seed or args.reset:
        import seed

        seed.seed(force=args.reset)
        return

    import uvicorn

    import uvicorn

    import config

    print(f"  {config.APP_NAME} v{config.APP_VERSION}")
    print(f"  Dashboard  ->  http://{args.host}:{args.port}/")
    print(f"  API docs   ->  http://{args.host}:{args.port}/docs")
    print(f"  Database   ->  {config.DB_PATH}")
    print("-" * 52)

    uvicorn.run(
        "main:app",
        host=args.host,
        port=args.port,
        reload=args.reload,
        app_dir=BACKEND_DIR,
    )


if __name__ == "__main__":
    main()
