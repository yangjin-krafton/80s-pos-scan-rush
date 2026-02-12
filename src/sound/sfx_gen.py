
#!/usr/bin/env python3
"""
Generate 16-bit PCM WAV sound effects with no external dependencies.
Outputs to src/assets/sfx_wav by default.
"""
from __future__ import annotations

import math
import os
import random
import struct
import wave
from dataclasses import dataclass
from typing import Callable, Iterable, List

SAMPLE_RATE = 44100

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
    # phase in radians
    return 2.0 * (phase / (2.0 * math.pi) - math.floor(phase / (2.0 * math.pi) + 0.5))


def wave_triangle(phase: float) -> float:
    return 2.0 * abs(wave_saw(phase)) - 1.0


def clamp(v: float, lo: float = -1.0, hi: float = 1.0) -> float:
    return max(lo, min(hi, v))


def generate_tone(
    duration: float,
    f0: float,
    f1: float,
    wave_fn: Callable[[float], float],
    volume: float = 0.6,
    env: Envelope | None = None,
    vibrato_rate: float = 0.0,
    vibrato_depth: float = 0.0,
    tremolo_rate: float = 0.0,
    tremolo_depth: float = 0.0,
    noise_mix: float = 0.0,
    seed: int | None = None,
) -> List[float]:
    if env is None:
        env = Envelope(0.01, 0.08, 0.6, 0.08)
    rng = random.Random(seed)
    total = int(SAMPLE_RATE * duration)
    phase = 0.0
    samples: List[float] = []
    for i in range(total):
        t = i / SAMPLE_RATE
        frac = t / duration
        freq = f0 + (f1 - f0) * frac
        if vibrato_rate > 0.0 and vibrato_depth > 0.0:
            freq += math.sin(2 * math.pi * vibrato_rate * t) * vibrato_depth
        phase += 2 * math.pi * freq / SAMPLE_RATE
        base = wave_fn(phase)
        if noise_mix > 0.0:
            base = (1.0 - noise_mix) * base + noise_mix * rng.uniform(-1.0, 1.0)
        amp = volume * env.value(t, duration)
        if tremolo_rate > 0.0 and tremolo_depth > 0.0:
            amp *= 1.0 - tremolo_depth * (0.5 * (1.0 + math.sin(2 * math.pi * tremolo_rate * t)))
        samples.append(clamp(base * amp))
    return samples


def mix(samples_a: List[float], samples_b: List[float]) -> List[float]:
    n = max(len(samples_a), len(samples_b))
    out = []
    for i in range(n):
        a = samples_a[i] if i < len(samples_a) else 0.0
        b = samples_b[i] if i < len(samples_b) else 0.0
        out.append(clamp(a + b))
    return out


def write_wav(path: str, samples: Iterable[float]) -> None:
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with wave.open(path, 'wb') as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)  # 16-bit
        wf.setframerate(SAMPLE_RATE)
        frames = b''.join(struct.pack('<h', int(clamp(s) * 32767)) for s in samples)
        wf.writeframes(frames)


def sfx_ui_click() -> List[float]:
    a = generate_tone(0.04, 900, 1150, wave_fn=wave_square, volume=0.25, env=Envelope(0.002, 0.02, 0.2, 0.02))
    b = generate_tone(0.03, 520, 660, wave_fn=wave_triangle, volume=0.15, env=Envelope(0.002, 0.02, 0.2, 0.02))
    return mix(a, b)


def sfx_item_pickup() -> List[float]:
    a = generate_tone(0.08, 420, 760, wave_fn=wave_triangle, volume=0.4, env=Envelope(0.003, 0.03, 0.35, 0.04))
    b = generate_tone(0.06, 840, 1240, wave_fn=wave_sine, volume=0.22, env=Envelope(0.002, 0.03, 0.3, 0.03))
    return mix(a, b)


def sfx_item_bag() -> List[float]:
    thump = generate_tone(0.1, 240, 160, wave_fn=wave_sine, volume=0.45, env=Envelope(0.002, 0.05, 0.3, 0.05))
    rustle = generate_tone(0.12, 520, 260, wave_fn=wave_saw, volume=0.25, env=Envelope(0.002, 0.05, 0.2, 0.06), noise_mix=0.35, seed=2)
    return mix(thump, rustle)


def sfx_scan_beep() -> List[float]:
    blip1 = generate_tone(0.06, 880, 1280, wave_fn=wave_triangle, volume=0.6, env=Envelope(0.002, 0.02, 0.2, 0.02))
    blip2 = generate_tone(0.05, 1320, 1760, wave_fn=wave_triangle, volume=0.55, env=Envelope(0.002, 0.02, 0.2, 0.02))
    sparkle = generate_tone(0.04, 2200, 2600, wave_fn=wave_sine, volume=0.2, env=Envelope(0.001, 0.02, 0.2, 0.02))
    gap = [0.0] * int(SAMPLE_RATE * 0.008)
    return blip1 + gap + mix(blip2, sparkle)


def sfx_scan_fail() -> List[float]:
    buzz = generate_tone(0.18, 360, 140, wave_fn=wave_saw, volume=0.5, env=Envelope(0.002, 0.05, 0.2, 0.07), noise_mix=0.25, seed=5)
    drop = generate_tone(0.2, 220, 90, wave_fn=wave_triangle, volume=0.25, env=Envelope(0.002, 0.06, 0.2, 0.08))
    return mix(buzz, drop)


def sfx_checkout_success() -> List[float]:
    a = generate_tone(0.11, 520, 820, wave_fn=wave_sine, volume=0.55, env=Envelope(0.003, 0.03, 0.4, 0.04))
    b = generate_tone(0.12, 820, 1240, wave_fn=wave_sine, volume=0.55, env=Envelope(0.003, 0.03, 0.5, 0.05))
    c = generate_tone(0.1, 1240, 1560, wave_fn=wave_triangle, volume=0.35, env=Envelope(0.003, 0.03, 0.5, 0.05))
    gap = [0.0] * int(SAMPLE_RATE * 0.008)
    return a + gap + b + gap + c


def sfx_checkout_fail() -> List[float]:
    low = generate_tone(0.26, 280, 90, wave_fn=wave_saw, volume=0.55, env=Envelope(0.002, 0.06, 0.2, 0.09), noise_mix=0.25, seed=8)
    mid = generate_tone(0.2, 420, 180, wave_fn=wave_triangle, volume=0.3, env=Envelope(0.002, 0.05, 0.2, 0.08))
    return mix(low, mid)


def sfx_combo_up() -> List[float]:
    a = generate_tone(0.07, 740, 1040, wave_fn=wave_square, volume=0.4, env=Envelope(0.002, 0.03, 0.3, 0.03))
    b = generate_tone(0.05, 1040, 1560, wave_fn=wave_triangle, volume=0.28, env=Envelope(0.002, 0.03, 0.3, 0.03))
    gap = [0.0] * int(SAMPLE_RATE * 0.006)
    return a + gap + b


def sfx_warning() -> List[float]:
    pulse = generate_tone(0.09, 620, 520, wave_fn=wave_square, volume=0.35, env=Envelope(0.001, 0.02, 0.2, 0.02))
    low = generate_tone(0.09, 220, 200, wave_fn=wave_sine, volume=0.18, env=Envelope(0.001, 0.02, 0.2, 0.02))
    gap = [0.0] * int(SAMPLE_RATE * 0.05)
    return mix(pulse, low) + gap + mix(pulse, low)


def main() -> None:
    out_dir = os.path.join(os.path.dirname(__file__), 'assets', 'sfx_wav')
    sfx = {
        'ui_click.wav': sfx_ui_click(),
        'item_pickup.wav': sfx_item_pickup(),
        'item_bag.wav': sfx_item_bag(),
        'scan_beep.wav': sfx_scan_beep(),
        'scan_fail.wav': sfx_scan_fail(),
        'checkout_success.wav': sfx_checkout_success(),
        'checkout_fail.wav': sfx_checkout_fail(),
        'combo_up.wav': sfx_combo_up(),
        'warning.wav': sfx_warning(),
    }
    for name, samples in sfx.items():
        path = os.path.join(out_dir, name)
        write_wav(path, samples)
    print(f'Wrote {len(sfx)} files to {out_dir}')


if __name__ == '__main__':
    main()
