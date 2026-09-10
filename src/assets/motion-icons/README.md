# Motion icon assets

- `arrows/tap` and `arrows/hold` contain directional arrow-style inputs.
- `joystick/tap` and `joystick/hold` contain directional joystick-style inputs.
- `joystick/*.svg` contains compound joystick motions such as QCF, DP, and SPD.
Keep arrow and joystick artwork as external SVG files. Compound motions should be composed from
these atomic assets when possible; circular joystick motions repeat `joystick/spd.svg`, while their
arrow-style equivalents repeat a complete eight-direction revolution.
