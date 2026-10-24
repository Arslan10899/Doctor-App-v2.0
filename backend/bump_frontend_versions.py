"""
Rewrite every internal page link in the frontend with a cache-busting version
query, e.g.  href="doctors.html"  ->  href="doctors.html?v=2"  and
href="doctor-profile.html?id=5"  ->  href="doctor-profile.html?v=2&id=5".

Run this after changing frontend files heavily while the browser keeps serving
an old cached copy, and remember to bump the asset versions in the <head> too
(css/...?v=, js/...?v=).  Only links INSIDE the frontend are rewritten.

Usage (from the Website directory):
    python backend/bump_frontend_versions.py            # version 2
Or bump first:
    python backend/bump_frontend_versions.py 3
"""

import glob
import os
import re
import sys

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FRONTEND = os.path.join(BASE_DIR, "frontend")

VERSION = sys.argv[1] if len(sys.argv) > 1 else "2"

# Rule 2 must not re-match inside URLs that rule 1 already versioned
# ( ".html?v=2&id=..." ) – hence the (?![?]) lookahead on the pattern.
PAGE_LINK = re.compile(r"(?<![\w/.])([a-z][a-z0-9_-]*\.html)(?![?\w])")
ASSET_LINK = re.compile(r"(\.css|\.js)")


def rewrite(text: str) -> str:
    # 0. Normalise previous link versions (v2, v3, ...) to a neutral marker so
    #    rules 1-2 re-apply the new version consistently. This is what allows
    #    bumping v2 -> v3 -> v4 ... without touching query parts (?id= etc).
    text = text.replace("&%MARK%", "")                 # leftover markers from older runs
    text = re.sub(r"([a-z][a-z0-9_-]*\.html)\?v=\d+&", r"\1?v=%MARK%&", text)
    text = re.sub(r"([a-z][a-z0-9_-]*\.html)\?v=\d+", r"\1?v=%MARK%", text)
    text = text.replace(".html?v=%MARK%&", ".html?%MARK%&").replace(".html?v=%MARK%", ".html")

    # 1. URLs that already carry a query (?id=...)  ->  .html?v=N&id=...
    text = re.sub(
        r"([a-z][a-z0-9_-]*\.html)\?((?!v=)[^\s\"'<>]*)",
        rf"\1?v={VERSION}&\2",
        text,
    )
    # 2. Plain page references that are not already versioned or query-carrying.
    text = PAGE_LINK.sub(rf"\1?v={VERSION}", text)

    # 3. Leftover markers from rule 1 (".html?v=N&%MARK%&query" -> ".html?v=N&query").
    text = text.replace("&%MARK%", "")

    # 4. Code comparisons must stay versionless (the region pathname never
    #    contains a query) – undo the sweep inside these two known lines.
    text = re.sub(
        r"page\.split\('\?'\)\[0\] !== 'login\.html\?v=\d+'",
        "page.split('?')[0] !== 'login.html'",
        text,
    )
    text = re.sub(
        r"return file \|\| 'index\.html\?v=\d+'",
        "return file || 'index.html'",
        text,
    )

    # 5. Asset <link>/<script> tags follow the same version so a fresh copy is
    #    guaranteed after every bump (?v=old -> ?v=VERSION, unversioned too).
    text = re.sub(
        r'((?:href|src)="(?:css|js)/[A-Za-z0-9_.-]+\.(?:css|js))\?v=\d+"',
        rf'\1?v={VERSION}"',
        text,
    )
    text = re.sub(
        r'((?:href|src)="(?:css|js)/[A-Za-z0-9_.-]+\.(?:css|js))"',
        rf'\1?v={VERSION}"',
        text,
    )
    return text


def process(path: str) -> bool:
    with open(path, "r", encoding="utf-8") as fh:
        original = fh.read()
    updated = rewrite(original)
    if updated == original:
        return False
    with open(path, "w", encoding="utf-8", newline="") as fh:
        fh.write(updated)
    return True


def main() -> None:
    changed = []
    for pattern in ("*.html", os.path.join("js", "*.js")):
        for path in glob.glob(os.path.join(FRONTEND, pattern)):
            if process(path):
                changed.append(os.path.relpath(path, FRONTEND))
    for name in sorted(changed):
        print(f"versioned v{VERSION}: {name}")
    print(f"[DONE] {len(changed)} files updated (links only)")


if __name__ == "__main__":
    main()
