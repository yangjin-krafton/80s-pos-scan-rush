#!/usr/bin/env python3
"""
Encode WAV SFX masters to AAC (m4a) for mobile web delivery.
Requires ffmpeg in PATH.
"""
from __future__ import annotations

import os
import shutil
import subprocess
import sys
from pathlib import Path

SRC_DIR = Path(__file__).parent / "assets" / "sfx_wav"
OUT_DIR = Path(__file__).parent / "assets" / "sfx"
BITRATE = "96k"
SAMPLE_RATE = "44100"


def die(msg: str, code: int = 1) -> None:
    print(msg, file=sys.stderr)
    raise SystemExit(code)


def check_ffmpeg() -> None:
    if shutil.which("ffmpeg") is None:
        die("ffmpeg not found in PATH. Please install ffmpeg to encode SFX.")


def encode_file(src: Path, dst: Path) -> None:
    dst.parent.mkdir(parents=True, exist_ok=True)
    cmd = [
        "ffmpeg",
        "-y",
        "-i",
        str(src),
        "-c:a",
        "aac",
        "-b:a",
        BITRATE,
        "-ac",
        "1",
        "-ar",
        SAMPLE_RATE,
        str(dst),
    ]
    try:
        subprocess.run(cmd, check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    except subprocess.CalledProcessError as exc:
        err = exc.stderr.decode("utf-8", errors="ignore").strip()
        die(f"ffmpeg failed for {src.name}: {err}")
    src.unlink(missing_ok=True)


def main() -> None:
    check_ffmpeg()
    if not SRC_DIR.exists():
        die(f"Input directory not found: {SRC_DIR}")
    wav_files = sorted(SRC_DIR.glob("*.wav"))
    if not wav_files:
        die(f"No .wav files found in {SRC_DIR}")

    for wav in wav_files:
        out = OUT_DIR / (wav.stem + ".m4a")
        encode_file(wav, out)

    print(f"Encoded {len(wav_files)} files to {OUT_DIR} and removed WAV masters")


if __name__ == "__main__":
    main()
