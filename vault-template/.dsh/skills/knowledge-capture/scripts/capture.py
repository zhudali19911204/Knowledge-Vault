#!/usr/bin/env python3
"""Launch knowledge capture with dependencies isolated from the system Python."""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import subprocess
import sys
import venv
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlparse


if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")
    sys.stderr.reconfigure(encoding="utf-8")


SCRIPT_ROOT = Path(__file__).resolve().parent
CONVERTER = SCRIPT_ROOT / "document_to_markdown.py"
REQUIREMENTS = SCRIPT_ROOT / "requirements.txt"
MARKER_NAME = "runtime.json"
MINIMUM_PYTHON = (3, 10)
REQUIRED_MODULES = {
    "openpyxl": "openpyxl",
    "PIL": "Pillow",
    "pptx": "python-pptx",
    "fitz": "PyMuPDF",
    "pytesseract": "pytesseract",
}


class LauncherError(RuntimeError):
    pass


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def default_runtime_root() -> Path:
    explicit = os.environ.get("KNOWLEDGE_CAPTURE_RUNTIME_ROOT")
    if explicit:
        return Path(explicit).expanduser().resolve()

    dsh_home = os.environ.get("DSH_HOME")
    if dsh_home:
        return (Path(dsh_home).expanduser() / "runtimes" / "knowledge-capture").resolve()

    if os.name == "nt":
        local_app_data = os.environ.get("LOCALAPPDATA")
        if not local_app_data:
            raise LauncherError("无法确定 LOCALAPPDATA；请通过 --runtime-root 指定依赖运行目录。")
        return (Path(local_app_data) / "KnowledgeVaultHarness" / "dsh" / "runtimes" / "knowledge-capture").resolve()

    data_home = os.environ.get("XDG_DATA_HOME")
    base = Path(data_home).expanduser() if data_home else Path.home() / ".local" / "share"
    return (base / "KnowledgeVaultHarness" / "dsh" / "runtimes" / "knowledge-capture").resolve()


def discover_vault_root() -> Path | None:
    configured = os.environ.get("KNOWLEDGE_VAULT_ROOT")
    if configured:
        return Path(configured).expanduser().resolve()
    current = Path.cwd().resolve()
    for candidate in (current, *current.parents):
        if (candidate / "AGENTS.md").is_file() and (candidate / "01_Inbox").is_dir():
            return candidate
    return None


def is_within(path: Path, parent: Path) -> bool:
    try:
        path.relative_to(parent)
        return True
    except ValueError:
        return False


def resolve_runtime_root(value: str | None) -> Path:
    runtime_root = Path(value).expanduser().resolve() if value else default_runtime_root()
    vault_root = discover_vault_root()
    if vault_root and is_within(runtime_root, vault_root):
        raise LauncherError(f"依赖运行目录必须位于 Vault 之外：{runtime_root}")
    return runtime_root


def environment_root(runtime_root: Path) -> Path:
    version = f"py{sys.version_info.major}{sys.version_info.minor}"
    return runtime_root / version


def environment_python(environment: Path) -> Path:
    if os.name == "nt":
        return environment / "Scripts" / "python.exe"
    return environment / "bin" / "python"


def marker_path(runtime_root: Path) -> Path:
    return runtime_root / MARKER_NAME


def read_marker(runtime_root: Path) -> dict | None:
    path = marker_path(runtime_root)
    try:
        value = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return None
    return value if isinstance(value, dict) else None


def runtime_info(runtime_root: Path) -> dict:
    requirements_hash = sha256_file(REQUIREMENTS)
    marker = read_marker(runtime_root)
    environment = environment_root(runtime_root)
    python_path = environment_python(environment)
    ready = bool(
        marker
        and marker.get("requirements_sha256") == requirements_hash
        and marker.get("python_version") == f"{sys.version_info.major}.{sys.version_info.minor}"
        and python_path.is_file()
    )
    return {
        "status": "ready" if ready else "missing",
        "runtime_root": str(runtime_root),
        "environment": str(environment),
        "python": str(python_path),
        "requirements": str(REQUIREMENTS),
        "requirements_sha256": requirements_hash,
        "ready": ready,
    }


def validate_index_url(value: str | None) -> str | None:
    if not value:
        return None
    parsed = urlparse(value)
    if parsed.scheme not in {"http", "https"} or not parsed.netloc:
        raise LauncherError("--index-url 必须是有效的 HTTP(S) Python 包索引地址。")
    return value


def install_dependencies(runtime_root: Path, index_url: str | None) -> dict:
    if sys.version_info < MINIMUM_PYTHON:
        raise LauncherError("知识收依赖需要 Python 3.10 或更高版本。")

    runtime_root.mkdir(parents=True, exist_ok=True)
    environment = environment_root(runtime_root)
    python_path = environment_python(environment)
    if not python_path.is_file():
        venv.EnvBuilder(with_pip=True, clear=False, symlinks=False).create(environment)
    if not python_path.is_file():
        raise LauncherError(f"虚拟环境创建失败，未找到解释器：{python_path}")

    command = [
        str(python_path),
        "-m",
        "pip",
        "install",
        "--disable-pip-version-check",
        "--requirement",
        str(REQUIREMENTS),
    ]
    if index_url:
        command.extend(["--index-url", index_url])

    install_environment = os.environ.copy()
    for name in ("PIP_USER", "PIP_TARGET", "PIP_PREFIX", "PYTHONUSERBASE"):
        install_environment.pop(name, None)
    if index_url:
        # An explicit mirror selection must override a machine-level no-index setting.
        install_environment.pop("PIP_NO_INDEX", None)
    install_environment["PYTHONDONTWRITEBYTECODE"] = "1"

    completed = subprocess.run(command, env=install_environment, check=False)
    if completed.returncode != 0:
        raise LauncherError(f"依赖安装失败，pip 退出码：{completed.returncode}")

    verification = (
        "import importlib.util,json,sys;"
        f"required={json.dumps(REQUIRED_MODULES, ensure_ascii=True)};"
        "missing=[package for module,package in required.items() if importlib.util.find_spec(module) is None];"
        "print(json.dumps({'missing':missing},ensure_ascii=False));"
        "sys.exit(1 if missing else 0)"
    )
    verified = subprocess.run([str(python_path), "-c", verification], env=install_environment, check=False)
    if verified.returncode != 0:
        raise LauncherError("pip 已结束，但隔离环境仍缺少一个或多个 requirements.txt 依赖。")

    marker = {
        "environment": str(environment),
        "python_version": f"{sys.version_info.major}.{sys.version_info.minor}",
        "requirements_sha256": sha256_file(REQUIREMENTS),
        "installed_at": datetime.now(timezone.utc).isoformat(),
        "index_url": index_url,
    }
    temporary_marker = marker_path(runtime_root).with_suffix(".json.tmp")
    temporary_marker.write_text(json.dumps(marker, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    os.replace(temporary_marker, marker_path(runtime_root))
    return runtime_info(runtime_root)


def launcher_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(add_help=False)
    parser.add_argument("--runtime-root")
    parser.add_argument("--runtime-info", action="store_true")
    parser.add_argument("--install-dependencies", action="store_true")
    parser.add_argument("--index-url")
    return parser


def main() -> int:
    parser = launcher_parser()
    options, converter_arguments = parser.parse_known_args()
    try:
        if not CONVERTER.is_file() or not REQUIREMENTS.is_file():
            raise LauncherError("知识收启动器不完整：缺少转换脚本或 requirements.txt。")
        runtime_root = resolve_runtime_root(options.runtime_root)
        index_url = validate_index_url(options.index_url)

        if options.runtime_info:
            if options.install_dependencies or index_url or converter_arguments:
                raise LauncherError("--runtime-info 不能与安装参数或转换参数同时使用。")
            print(json.dumps(runtime_info(runtime_root), ensure_ascii=False, indent=2))
            return 0

        if options.install_dependencies:
            if converter_arguments:
                raise LauncherError("安装依赖时不能同时传入源文件或转换参数。")
            print(json.dumps(install_dependencies(runtime_root, index_url), ensure_ascii=False, indent=2))
            return 0

        if index_url:
            raise LauncherError("--index-url 只能与 --install-dependencies 一起使用。")

        info = runtime_info(runtime_root)
        python_path = Path(info["python"]) if info["ready"] else Path(sys.executable)
        child_environment = os.environ.copy()
        child_environment["PYTHONDONTWRITEBYTECODE"] = "1"
        return subprocess.run(
            [str(python_path), str(CONVERTER), *converter_arguments],
            env=child_environment,
            check=False,
        ).returncode
    except LauncherError as error:
        print(json.dumps({"status": "error", "error": str(error)}, ensure_ascii=False, indent=2), file=sys.stderr)
        return 2
    except OSError as error:
        print(
            json.dumps({"status": "error", "error": f"知识收启动失败：{error}"}, ensure_ascii=False, indent=2),
            file=sys.stderr,
        )
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
