# StavangerZ local sound library

All runtime audio is served from `/audio/` on this application's own origin.
There are no purchases, external runtime requests, speech, monster voices or
weapon-specific gunfire. Sound never reads hidden game state.

## Third-party originals: Kenney, CC0

Selected unchanged OGG originals are preserved in `source/`, each beside the
pack's unmodified `LICENSE.txt`. They were downloaded on 2026-11-13 through the
official free download flow on the pages below. `source-manifest.json` records
canonical source URLs, original names, authors, license URLs and SHA-256 hashes.

- **RPG Audio**, Kenney Vleugels: https://kenney.nl/assets/rpg-audio
- **Impact Sounds 1.0**, Kenney: https://kenney.nl/assets/impact-sounds
- Both are **CC0 1.0**: https://creativecommons.org/publicdomain/zero/1.0/

Kenney explicitly permits commercial and personal use. Attribution is optional;
we retain it here. We call these supplied Foley/material samples, not verified
field recordings; the pack documentation makes no recording-method claim.

## Project sound design

The MP3 files are original project arrangements of those CC0 samples, with
offline trimming, layering, EQ, pitch changes and short reflections. Music in
`game-audio.ts` is an original quiet accompaniment. No third-party music is used.

`ambient-camp`, `ambient-harbor` and `ambient-night` are **offline procedural
composites, not field recordings**. Their wind/water texture is generated from
filtered noise; occasional material detail comes from the licensed Kenney
samples. In particular `ambient-harbor` does not claim a recording of Stavanger
or an actual ocean. These textures carry setting, not threat intelligence.

The original arrangements and procedural elements were created for StavangerZ;
this file does not grant a new public license over the project's original work.
The preserved Kenney source material remains CC0.

## Rebuild and verification

From `region/`:

```
python scripts/build-region-audio.py --check
python scripts/build-region-audio.py
```

`--check` uses Python's standard library and verifies source/output hashes,
license/source declarations, duration/level bounds and required cue coverage.
Rebuilding is an offline developer task requiring Python NumPy/SciPy and ffmpeg
with libmp3lame. These are **not** browser or production dependencies. The build
script contains each arrangement's exact ingredients and processing.
`manifest.json` records rendered asset hashes, durations and pre-encode peak/RMS.

## Runtime contract

- `useGameAudio(preferences, 'camp' | 'harbor' | 'night')` returns the existing
  `playSound` callback. The second argument is optional and defaults to `camp`.
- Choose environment only from visible/known player context. Night is a real
  replay phase, not a threat prediction. Harbor is a known shore/port location.
- `order` / `confirm` are physical equipment/latch gestures.
- `day`, `event`, `combat`, `night`, `discovery`, `claim` require their accepted
  action or actual observed outcome. No weapon or hidden zombie count is implied.
- `victory` / `defeat` are reserved for actual campaign endings. Loading an old
  ending or opening a historical report must remain silent.
- Samples load lazily after trusted user input; pending cues are discarded on
  hide, mute, teardown or long download delay. Background changes crossfade.
- Ambient uses the music slider; one-shot Foley uses the effects slider; both
  obey master volume. Zero volume creates no new voices. Hidden tabs stop all
  sources and their scheduling, and teardown closes the AudioContext.
