#!/usr/bin/env python3
"""
Generate 16-bit WAV BGM stems and encode to m4a (AAC) for mobile web.
Creates 3 variations per instrument and register (low/mid/high).
Requires ffmpeg in PATH.
"""
from __future__ import annotations

import math
import os
import random
import shutil
import struct
import subprocess
import wave
from dataclasses import dataclass
from pathlib import Path
from typing import Callable, Iterable, List, Tuple

SAMPLE_RATE = 44100
TEMPO_BPM = 110
BEAT_SEC = 60.0 / TEMPO_BPM
BARS = 4
BAR_BEATS = 4
DURATION = BARS * BAR_BEATS * BEAT_SEC

ROOT_DIR = Path(__file__).parent
WAV_DIR = ROOT_DIR / "assets" / "bgm_wav"
OUT_DIR = ROOT_DIR / "assets" / "bgm"


@dataclass
class Envelope:
    attack: float
    decay: float
    sustain: float
    release: float

    def value(self, t: float, dur: float) -> float:
        a = max(self.attack, 1e-6)
        d = max(self.decay, 1e-6)
        r = max(self.release, 1e-6)
        s = max(0.0, min(1.0, self.sustain))
        if t < a:
            return t / a
        if t < a + d:
            return 1.0 - (1.0 - s) * ((t - a) / d)
        if t < dur - r:
            return s
        if t < dur:
            return s * max(0.0, 1.0 - ((t - (dur - r)) / r))
        return 0.0


def wave_sine(phase: float) -> float:
    return math.sin(phase)


def wave_square(phase: float) -> float:
    return 1.0 if math.sin(phase) >= 0.0 else -1.0


def wave_saw(phase: float) -> float:
    return 2.0 * (phase / (2.0 * math.pi) - math.floor(phase / (2.0 * math.pi) + 0.5))


def wave_triangle(phase: float) -> float:
    return 2.0 * abs(wave_saw(phase)) - 1.0


def clamp(v: float, lo: float = -1.0, hi: float = 1.0) -> float:
    return max(lo, min(hi, v))


def note_freq(root_hz: float, semitone: int) -> float:
    return root_hz * (2.0 ** (semitone / 12.0))


def render_notes(
    notes: List[Tuple[float, float, float, float]],
    wave_fn: Callable[[float], float],
    env: Envelope,
    volume: float,
    vibrato_rate: float = 0.0,
    vibrato_depth: float = 0.0,
    noise_mix: float = 0.0,
    seed: int | None = None,
) -> List[float]:
    rng = random.Random(seed)
    total = int(SAMPLE_RATE * DURATION)
    out = [0.0] * total
    for start, dur, freq, vel in notes:
        start_i = int(start * SAMPLE_RATE)
        end_i = min(total, int((start + dur) * SAMPLE_RATE))
        phase = 0.0
        for i in range(start_i, end_i):
            t = (i - start_i) / SAMPLE_RATE
            f = freq
            if vibrato_rate > 0.0 and vibrato_depth > 0.0:
                f += math.sin(2 * math.pi * vibrato_rate * t) * vibrato_depth
            phase += 2 * math.pi * f / SAMPLE_RATE
            base = wave_fn(phase)
            if noise_mix > 0.0:
                base = (1.0 - noise_mix) * base + noise_mix * rng.uniform(-1.0, 1.0)
            amp = volume * vel * env.value(t, dur)
            out[i] += base * amp
    return [clamp(s) for s in out]


def write_wav(path: Path, samples: Iterable[float]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with wave.open(str(path), "wb") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(SAMPLE_RATE)
        frames = b"".join(struct.pack("<h", int(clamp(s) * 32767)) for s in samples)
        wf.writeframes(frames)


def encode_m4a(src: Path, dst: Path) -> None:
    dst.parent.mkdir(parents=True, exist_ok=True)
    cmd = [
        "ffmpeg",
        "-y",
        "-i",
        str(src),
        "-c:a",
        "aac",
        "-b:a",
        "96k",
        "-ac",
        "1",
        "-ar",
        "44100",
        str(dst),
    ]
    subprocess.run(cmd, check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)


def ensure_ffmpeg() -> None:
    if shutil.which("ffmpeg") is None:
        raise SystemExit("ffmpeg not found in PATH. Please install ffmpeg.")


def build_pattern(rng: random.Random, steps: int, density: float) -> List[int]:
    pattern = []
    for _ in range(steps):
        pattern.append(1 if rng.random() < density else 0)
    if sum(pattern) == 0:
        pattern[rng.randrange(steps)] = 1
    return pattern


def make_notes(
    rng: random.Random,
    root_hz: float,
    scale: List[int],
    step_div: int,
    density: float,
    length_bars: int,
    vel_range: Tuple[float, float],
) -> List[Tuple[float, float, float, float]]:
    steps_per_bar = step_div
    total_steps = length_bars * steps_per_bar
    step_dur = BAR_BEATS * BEAT_SEC / steps_per_bar
    pattern = build_pattern(rng, steps_per_bar, density)
    notes: List[Tuple[float, float, float, float]] = []
    for s in range(total_steps):
        if pattern[s % steps_per_bar] == 0:
            continue
        start = s * step_dur
        dur = step_dur * (1.0 if rng.random() < 0.7 else 0.5)
        degree = rng.choice(scale)
        octave_shift = rng.choice([0, 12]) if rng.random() < 0.2 else 0
        freq = note_freq(root_hz, degree + octave_shift)
        vel = rng.uniform(*vel_range)
        notes.append((start, dur, freq, vel))
    return notes


def make_track(
    name: str,
    seed: int,
    root_hz: float,
    scale: List[int],
    wave_fn: Callable[[float], float],
    env: Envelope,
    volume: float,
    step_div: int,
    density: float,
    vel_range: Tuple[float, float],
    vibrato_rate: float = 0.0,
    vibrato_depth: float = 0.0,
    noise_mix: float = 0.0,
) -> None:
    rng = random.Random(seed)
    notes = make_notes(rng, root_hz, scale, step_div, density, BARS, vel_range)
    samples = render_notes(
        notes,
        wave_fn=wave_fn,
        env=env,
        volume=volume,
        vibrato_rate=vibrato_rate,
        vibrato_depth=vibrato_depth,
        noise_mix=noise_mix,
        seed=seed,
    )
    wav_path = WAV_DIR / f"{name}.wav"
    m4a_path = OUT_DIR / f"{name}.m4a"
    write_wav(wav_path, samples)
    encode_m4a(wav_path, m4a_path)
    wav_path.unlink(missing_ok=True)


def main() -> None:
    ensure_ffmpeg()
    scale = [0, 3, 5, 7, 10]  # minor pentatonic
    registers = {
        "low": 110.0,   # A2
        "mid": 220.0,   # A3
        "high": 440.0,  # A4
    }
    instruments = {
        "bass": {
            "wave": wave_saw,
            "env": Envelope(0.005, 0.06, 0.6, 0.08),
            "volume": 0.5,
            "step_div": 8,
            "density": 0.6,
            "vel": (0.6, 0.9),
            "vibrato_rate": 0.0,
            "vibrato_depth": 0.0,
            "noise_mix": 0.05,
        },
        "pad": {
            "wave": wave_triangle,
            "env": Envelope(0.08, 0.2, 0.7, 0.2),
            "volume": 0.35,
            "step_div": 4,
            "density": 0.5,
            "vel": (0.5, 0.8),
            "vibrato_rate": 0.0,
            "vibrato_depth": 0.0,
            "noise_mix": 0.02,
        },
        "lead": {
            "wave": wave_square,
            "env": Envelope(0.01, 0.08, 0.5, 0.08),
            "volume": 0.4,
            "step_div": 8,
            "density": 0.7,
            "vel": (0.6, 1.0),
            "vibrato_rate": 5.0,
            "vibrato_depth": 6.0,
            "noise_mix": 0.0,
        },
    }

    seed_base = 1200
    for inst_name, inst in instruments.items():
        for reg_name, root in registers.items():
            for i in range(1, 4):
                name = f"bgm_{inst_name}_{reg_name}_{i:02d}"
                make_track(
                    name=name,
                    seed=seed_base,
                    root_hz=root,
                    scale=scale,
                    wave_fn=inst["wave"],
                    env=inst["env"],
                    volume=inst["volume"],
                    step_div=inst["step_div"],
                    density=inst["density"],
                    vel_range=inst["vel"],
                    vibrato_rate=inst["vibrato_rate"],
                    vibrato_depth=inst["vibrato_depth"],
                    noise_mix=inst["noise_mix"],
                )
                seed_base += 17

    print(f"Wrote m4a tracks to {OUT_DIR}")


if __name__ == "__main__":
    main()
