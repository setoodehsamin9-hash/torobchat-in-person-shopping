#!/usr/bin/env python3
"""Build a deterministic, scanned source release using only Python's standard library."""

import argparse
import hashlib
import json
import os
from pathlib import Path
import re
import stat
import sys
import tempfile
import zipfile


ROOT_FILES = {
    "AGENTS.md", "CODEX_MASTER_PROMPT.md", "IMPLEMENTATION_PLAN.md", "STATUS.md",
    "README.md", "EDITION.md", "LICENSE", "LICENSE.md", "NOTICE", "Dockerfile", "START_LOCAL.sh",
    "package.json", "package-lock.json", "pnpm-lock.yaml", "pnpm-workspace.yaml",
    "tsconfig.json", "next-env.d.ts", "next.config.ts", "postcss.config.mjs",
    "eslint.config.mjs", "vitest.config.ts", "playwright.config.ts", "liara.json",
    ".env.example", ".gitignore", ".dockerignore", ".liaraignore", ".npmrc",
}
SOURCE_DIRS = {"src", "app", "components", "lib", "scripts", "tests", "docs", "drizzle", "prisma", "migrations", "public", "static", "fonts", "licenses", "config", "configs"}
EXCLUDED_DIRS = {"node_modules", ".next", ".git", ".codex", ".agents", ".cache", "__pycache__", "data", "dist", "build", "release", "releases", "coverage", "logs", "test-results", "playwright-report", "blob-report", "reference", "references", "browser-reference", "browser-captures", "captures", "screenshots", "credentials", "secrets"}
TEXT_SUFFIXES = {".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".json", ".css", ".scss", ".html", ".md", ".txt", ".sql", ".sh", ".py", ".yaml", ".yml", ".toml", ".svg", ".prisma"}
PRIVATE_NAMES = {"secrets.json", "credentials.json", "service-account.json", "id_rsa", "id_ed25519"}
FONT_SIGNATURES = {".woff2": b"wOF2", ".woff": b"wOFF", ".ttf": b"\x00\x01\x00\x00", ".otf": b"OTTO"}
BRAND_SIGNATURES = {
    "public/brand/torob-radish.gif": (b"GIF87a", b"GIF89a"),
    "public/brand/torob-rotate.gif": (b"GIF87a", b"GIF89a"),
    "public/brand/torob-radish.png": (b"\x89PNG\r\n\x1a\n",),
}
MAX_FILE_BYTES = 10 * 1024 * 1024
SECRET_NAME = r"(?:[A-Za-z0-9_]*(?:api[_-]?key|secret|password|passwd|(?:access|auth|gateway|callback)[_-]?token|private[_-]?key)[A-Za-z0-9_]*)"
ASSIGNED_SECRET = re.compile(r"\b" + SECRET_NAME + r"[\"']?\s*[:=]\s*([\"'`])([^\r\n]*?)\1", re.IGNORECASE)
ENV_SECRET = re.compile(r"^\s*(?:export\s+)?(" + SECRET_NAME + r"|[A-Za-z0-9_]*TOKEN|DATABASE_URL)\s*=\s*(.*?)\s*$", re.IGNORECASE)
TOKEN_PATTERNS = [
    re.compile(r"\bbox-ai-[A-Za-z0-9_-]{20,}"),
    re.compile(r"\bsk-(?:proj-|ant-)?[A-Za-z0-9_-]{20,}"),
    re.compile(r"\b(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{30,})"),
    re.compile(r"\bAKIA[A-Z0-9]{16}\b"),
    re.compile(r"\bxox[baprs]-[A-Za-z0-9-]{20,}"),
    re.compile(r"-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----"),
    re.compile(r"[a-z][a-z0-9+.-]*://[^\s/:]+:[^\s/@]+@", re.IGNORECASE),
    re.compile(r"\bBearer\s+[A-Za-z0-9_.-]{24,}", re.IGNORECASE),
]


class ReleaseError(Exception):
    pass


def placeholder(value):
    """Explicit documentation placeholders only; never use an entropy-only bypass."""
    return not value or value in {"...", "example", "placeholder", "replace-me", "change-me", "offline-test-key"} or bool(re.fullmatch(r"<[^<>]+>|\$\{[^}]+\}", value))


def looks_like_credential(value):
    return len(value) >= 12 and value.isascii() and not placeholder(value)


def scan_text(name, data):
    try:
        value = data.decode("utf-8")
    except UnicodeDecodeError as error:
        raise ReleaseError(f"non-text content in {name}") from error
    if "\x00" in value:
        raise ReleaseError(f"binary content in {name}")
    if name.endswith(".json"):
        try:
            parsed = json.loads(value)
        except (json.JSONDecodeError, RecursionError) as error:
            raise ReleaseError(f"invalid JSON content in {name}") from error
        pending = [parsed]
        while pending:
            item = pending.pop()
            if isinstance(item, dict):
                if isinstance(item.get("destination"), str) and isinstance(item.get("verifiedAt"), str) and "verificationReference" in item and "permission" in item:
                    raise ReleaseError(f"private contact registry detected in {name}")
                pending.extend(item.values())
            elif isinstance(item, list):
                pending.extend(item)
    for number, line in enumerate(value.splitlines(), 1):
        reason = None
        if name == ".env.example":
            match = ENV_SECRET.match(line)
            if match and match.group(2).split(" #", 1)[0].strip().strip("\"'"):
                reason = "environment secret placeholders must be empty"
        if any(pattern.search(line) for pattern in TOKEN_PATTERNS):
            reason = "secret pattern"
        for match in ASSIGNED_SECRET.finditer(line):
            if looks_like_credential(match.group(2)):
                reason = "assigned secret"
        # Catch unquoted dotenv credentials outside the example too (e.g. copied docs).
        match = ENV_SECRET.match(line)
        if name != ".env.example" and match:
            candidate = match.group(2).split(" #", 1)[0].strip().strip("\"'")
            if looks_like_credential(candidate) and re.fullmatch(r"[A-Za-z0-9_./:+@%=-]+", candidate) and not candidate.startswith(("process.env.", "$", "os.environ")):
                reason = "environment secret"
        if reason:
            # Never print the matched line or the secret value.
            raise ReleaseError(f"{reason} detected in {name}:{number}")


def included(relative):
    parts = relative.parts
    if any(part.lower() in EXCLUDED_DIRS for part in parts):
        return False
    name = relative.name
    if (name.startswith(".env") and relative.as_posix() != ".env.example") or name.lower() in PRIVATE_NAMES:
        return False
    if len(parts) == 1:
        return name in ROOT_FILES
    if parts[0] not in SOURCE_DIRS or any(part.startswith(".") for part in parts):
        return False
    if parts[0] == "docs" and re.search(r"(?:browser[-_](?:reference|capture)|(?:^|[-_])(?:capture|snapshot|screenshot)(?:[-_.]|$))", name, re.IGNORECASE):
        return False
    if name in {"LICENSE", "NOTICE", "Dockerfile"} or relative.suffix.lower() in TEXT_SUFFIXES:
        return True
    return relative.as_posix() in BRAND_SIGNATURES or (relative.suffix.lower() in FONT_SIGNATURES and "fonts" in parts)


def collect(root):
    entries = []
    for directory, directories, filenames in os.walk(root, followlinks=False):
        parent = Path(directory)
        # Excluded directories are pruned before anything within them is opened.
        kept = []
        for name in sorted(directories):
            child = parent / name
            relative = child.relative_to(root)
            if name.lower() in EXCLUDED_DIRS or name.startswith("."):
                continue
            if len(relative.parts) == 1 and name not in SOURCE_DIRS:
                continue
            if child.is_symlink():
                raise ReleaseError(f"symlink rejected: {relative.as_posix()}")
            kept.append(name)
        directories[:] = kept
        for name in sorted(filenames):
            file = parent / name
            relative = file.relative_to(root)
            if not included(relative):
                continue
            if file.is_symlink():
                raise ReleaseError(f"symlink rejected: {relative.as_posix()}")
            # O_NOFOLLOW also prevents opening a replaced final component symlink.
            descriptor = os.open(file, os.O_RDONLY | getattr(os, "O_NOFOLLOW", 0))
            with os.fdopen(descriptor, "rb") as stream:
                metadata = os.fstat(stream.fileno())
                if not stat.S_ISREG(metadata.st_mode) or metadata.st_size > MAX_FILE_BYTES:
                    raise ReleaseError(f"unsupported file type or size: {relative.as_posix()}")
                data = stream.read(MAX_FILE_BYTES + 1)
            if len(data) > MAX_FILE_BYTES:
                raise ReleaseError(f"file too large: {relative.as_posix()}")
            suffix = relative.suffix.lower()
            brand_signatures = BRAND_SIGNATURES.get(relative.as_posix())
            if brand_signatures or suffix in FONT_SIGNATURES:
                signatures = brand_signatures or (FONT_SIGNATURES[suffix],)
                if not data.startswith(signatures):
                    raise ReleaseError(f"invalid {'brand image' if brand_signatures else 'font'} signature: {relative.as_posix()}")
                binary_text = data.decode("latin-1")
                if any(pattern.search(binary_text) for pattern in TOKEN_PATTERNS):
                    raise ReleaseError(f"secret pattern detected in {relative.as_posix()}")
            else:
                scan_text(relative.as_posix(), data)
            entries.append((relative.as_posix(), data, 0o755 if suffix == ".sh" else 0o644))
    if not entries:
        raise ReleaseError("no allowlisted source files found")
    return sorted(entries)


def output_path(root, requested):
    output = Path(requested)
    if not output.is_absolute():
        output = root / output
    # Lexically normalize before resolving so that every output component can be checked.
    output = Path(os.path.abspath(output))
    release_directory = root / "releases"
    if not output.is_relative_to(release_directory) or output.suffix != ".zip":
        raise ReleaseError("output must be a .zip file beneath ROOT/releases")
    for component in [release_directory, *output.relative_to(release_directory).parents]:
        candidate = component if component.is_absolute() else release_directory / component
        if candidate.is_symlink():
            raise ReleaseError("symlink rejected in output path")
    if output.exists() or output.is_symlink():
        raise ReleaseError("output already exists; choose a new release filename")
    return output


def add_entry(archive, name, data, mode):
    info = zipfile.ZipInfo(name, date_time=(1980, 1, 1, 0, 0, 0))
    info.create_system = 3
    info.external_attr = (stat.S_IFREG | mode) << 16
    info.compress_type = zipfile.ZIP_DEFLATED
    archive.writestr(info, data, compresslevel=9)


def build(root, output, entries):
    manifest = {"format": 1, "kind": "source", "files": [
        {"path": name, "size": len(data), "sha256": hashlib.sha256(data).hexdigest()}
        for name, data, _ in entries
    ]}
    manifest_data = (json.dumps(manifest, ensure_ascii=False, sort_keys=True, indent=2) + "\n").encode()
    output.parent.mkdir(parents=True, exist_ok=True)
    descriptor, temporary_name = tempfile.mkstemp(prefix=".source-", suffix=".zip", dir=output.parent)
    os.close(descriptor)
    temporary = Path(temporary_name)
    try:
        with zipfile.ZipFile(temporary, "w") as archive:
            for name, data, mode in entries:
                add_entry(archive, name, data, mode)
            add_entry(archive, "RELEASE-MANIFEST.json", manifest_data, 0o644)
        with zipfile.ZipFile(temporary) as archive:
            if archive.testzip() is not None:
                raise ReleaseError("archive integrity check failed")
            for item in manifest["files"]:
                if hashlib.sha256(archive.read(item["path"])).hexdigest() != item["sha256"]:
                    raise ReleaseError("manifest verification failed")
        # Atomic no-clobber publication: an existing file is never overwritten.
        os.link(temporary, output)
    finally:
        temporary.unlink(missing_ok=True)
    return hashlib.sha256(output.read_bytes()).hexdigest()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path, default=Path(__file__).resolve().parents[1])
    parser.add_argument("--output", default="releases/hamqadam-source.zip")
    parser.add_argument("--edition", choices=["optimized", "boxapi"], help="prepare one of two profiles from the same verified source")
    parser.add_argument("--check", action="store_true", help="scan allowlisted files without creating an archive")
    args = parser.parse_args()
    if args.root.is_symlink():
        raise ReleaseError("symlink rejected for root")
    root = args.root.resolve(strict=True)
    if not root.is_dir():
        raise ReleaseError("root must be a directory")
    output = output_path(root, args.output) if not args.check else None
    entries = collect(root)
    if args.edition:
        updated = []
        for name, data, mode in entries:
            if name == ".env.example":
                example = data.decode("utf-8")
                port = "3101" if args.edition == "boxapi" else "3100"
                example = re.sub(r"^PORT=.*$", f"PORT={port}", example, flags=re.MULTILINE)
                example = re.sub(r"^NEXT_PUBLIC_APP_URL=.*$", f"NEXT_PUBLIC_APP_URL=http://localhost:{port}", example, flags=re.MULTILINE)
                example = re.sub(r"^NEXT_BUILD_DIR=.*$", f"NEXT_BUILD_DIR=.next-{args.edition}", example, flags=re.MULTILINE)
                data = example.encode()
                scan_text(name, data)
            updated.append((name, data, mode))
        env_file = ".env.boxapi.local" if args.edition == "boxapi" else ".env.local"
        edition = f"# TorobChat — {args.edition}\n\nBoth editions use the same application and data contract. LLM tool results stay internal until the final model review.\n\nCopy .env.example to {env_file} for a fresh setup, fill AI_API_KEY privately, and run npm run dev:{args.edition}. See README.md and docs/versions.md. No dataset or credentials are included.\n"
        entries = sorted([(name, data, mode) for name, data, mode in updated if name != "EDITION.md"] + [("EDITION.md", edition.encode(), 0o644)])
    if args.check:
        print(f"Source scan passed: {len(entries)} files; no archive written")
        return
    digest = build(root, output, entries)
    print(f"Source release: {output}\nFiles: {len(entries)}\nSHA256: {digest}\nZIP integrity and manifest hashes verified")


if __name__ == "__main__":
    try:
        main()
    except (ReleaseError, OSError, zipfile.BadZipFile) as error:
        print(f"Release refused: {error}", file=sys.stderr)
        sys.exit(1)
