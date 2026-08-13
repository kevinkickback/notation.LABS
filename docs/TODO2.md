# Mortal Kombat and Tekken Notation Support Plan

## Objective

Expand Notation Labs so its parser, text display, icon display, and in-app
guide accurately support the notation conventions used by modern Mortal Kombat
and Tekken communities.

The current combined **NRS / Tekken** input type should be replaced by distinct
profiles. Although both communities use numbered attack buttons, they assign
different meanings to direction sequences, capitalization, holds, and several
common modifiers.

## Audit findings

### Existing strengths

- Button-number mode already treats `1` through `4` as attack buttons.
- Letter directions and common Tekken diagonals are recognized.
- Several Tekken states are supported, including `WS`, `FC`, `WR`, `BT`,
  `SS`, `SSL`, `SSR`, `SWL`, and `SWR`.
- Tekken ground positions such as `FD/FT` and `FU/FA` are supported.
- Arrow assets already distinguish tap and held Tekken directions.
- Users can select arrow icons under **Settings > Notation > Motion Style >
  Arrows**.
- Stored combos can already be reparsed when parser behavior or game settings
  change.

### Confirmed compatibility gaps

#### Combined profile has conflicting direction rules

The current behavior is closer to Tekken:

- Lowercase directions represent taps.
- Uppercase directions represent holds.
- `df` and `d/f` represent a diagonal.

Modern Mortal Kombat notation is effectively case-insensitive. It uses
direction strings such as `DF1` to mean Down, Forward, then button 1—not a held
down-forward diagonal. A single combined profile cannot interpret both
conventions reliably.

#### Mortal Kombat direction sequences are incomplete

Common inputs such as `BF4`, `DF1`, and `DBF1` are sequential motions in Mortal
Kombat. The current parser can treat `DF` as a diagonal and can leave `BF` as
unknown text.

#### Mortal Kombat dial strings conflict with repeat collapsing

Strings such as `114` represent three sequential attack inputs. They must not
be transformed into a button 1 repeat group followed by button 4.

#### Mortal Kombat modifiers are incomplete

Community abbreviations such as `EX`, `EN`, `AMP`, `FB`, `KB`, `PB`, `NJP`,
`JIP`, `JIK`, `NJK`, `RUN`, `RC`, and `K` are not consistently classified.
They may remain unknown text or require users to add them manually as game
buttons.

#### Tekken neutral is hidden in icon mode

The parser recognizes `N`, but icon rendering currently treats it like numpad
neutral and removes it. Neutral timing is meaningful in commands such as
`f,N,d,d/f+2` and requires a visible icon.

#### The guide does not explain the available arrow setting

Arrow rendering already exists, but the notation guide does not tell users how
to enable it or demonstrate the difference between joystick, arrow, tap, hold,
and neutral inputs.

#### The guide does not distinguish community dialects

The guide currently describes Standard notation and only briefly mentions the
combined NRS/Tekken input type. It does not explain:

- Mortal Kombat and Tekken button meanings.
- Mortal Kombat sequential directions versus Tekken diagonals.
- Tekken tap-versus-hold capitalization.
- Mortal Kombat mechanics and Kameo notation.
- Tekken states, ground positions, and timing separators.

## Recommended architecture

Replace the combined profile with three explicit options:

1. **Standard / Numpad**
2. **Mortal Kombat**
3. **Tekken**

Use a small profile configuration layer around the existing tokenizer rather
than creating separate full parsers. Each profile should define:

- The role of digits.
- Direction grammar.
- Capitalization and hold behavior.
- Button-repeat behavior.
- Known aliases, modifiers, and states.
- Neutral-input behavior.
- Display and accessibility labels.

The configuration should remain focused on genuine grammar differences. Avoid
a generalized plugin framework unless additional notation dialects prove that
one is necessary.

### Suggested profile behavior

| Input | Standard / Numpad | Mortal Kombat | Tekken |
|---|---|---|---|
| `1` | Down-back direction | Front Punch | Left Punch |
| `2` | Down direction | Back Punch | Right Punch |
| `3` | Down-forward direction | Front Kick | Left Kick |
| `4` | Back direction | Back Kick | Right Kick |
| `DF` | Depends on configured buttons | Down, then Forward | Held down-forward diagonal |
| `df` | Depends on configured buttons | Down, then Forward | Tap down-forward diagonal |
| `F` | Configured button or text | Forward | Hold Forward |
| `f` | Configured button or text | Forward | Tap Forward |
| `N` | Neutral direction | Descriptive text if used | Visible neutral input |

## Action plan

### Phase 1: Define profiles and migration behavior

- [ ] Add explicit Standard, Mortal Kombat, and Tekken notation profiles to the
      shared schema and types.
- [ ] Replace the combined **NRS / Tekken** choice in the Add/Edit Game dialog.
- [ ] Keep the profile selection accessible with `aria-pressed` or native radio
      semantics.
- [ ] Give each profile a concise explanation and representative preview.
- [ ] Migrate existing `numpad` games to Standard.
- [ ] Migrate existing `button-numbers` games to Tekken because current
      case-sensitive direction behavior is closest to Tekken.
- [ ] Tell existing Mortal Kombat users to select the new Mortal Kombat profile
      rather than silently inferring a game from its name.
- [ ] Reparse all combos belonging to a game whenever its profile changes.
- [ ] Preserve imported legacy values until migration is complete.

#### Acceptance criteria

- Existing Standard games parse exactly as before.
- Existing button-number games remain readable after migration.
- Changing a profile reparses stored combo tokens without changing the original
  notation text.

### Phase 2: Implement Mortal Kombat grammar

- [ ] Parse `F`, `B`, `U`, and `D` case-insensitively.
- [ ] Parse direction strings sequentially:
  - `BF4` = Back, Forward, button 4.
  - `DF1` = Down, Forward, button 1.
  - `DBF1` = Down, Back, Forward, button 1.
- [ ] Keep dial strings such as `114` as separate button tokens.
- [ ] Disable automatic adjacent-button repeat collapsing for Mortal Kombat.
- [ ] Support simultaneous inputs such as `1+3` and `B+K`.
- [ ] Support both `xx` and `~` as cancel notation.
- [ ] Recognize common MKX modifiers:
  - `EX`, `EN`, `NJP`, `NJK`, `JIP`, `JIK`, `RUN`, and `RC`.
- [ ] Recognize common MK11 modifiers:
  - `AMP`, `KB`, `FB`, `PB`, `SH`, and `MD`.
- [ ] Recognize common MK1 inputs and modifiers:
  - `EX`, `K`, `FB`, `S`, `Block`, `Grab`, and `Throw`.
- [ ] Preserve character-specific moves and uncommon acronyms as descriptive
      text instead of splitting or discarding them.
- [ ] Provide useful defaults for buttons `1`, `2`, `3`, and `4`.
- [ ] Allow the MK1 Kameo button `K` to be added through a profile preset or
      game buttons without conflicting with directions.

#### Mortal Kombat acceptance examples

The following must parse without unknown structural tokens:

```text
114 xx DF3, B21F2, B21 xx BF4 AMP
F32 xx DB1, NJP, B12
F12~B+K, 4~B+K, B2, J21, DB1, J12, 3~BF3 EX
```

Specific requirements:

- `114` produces buttons 1, 1, and 4—not a repeat group.
- `DF` produces Down followed by Forward—not one diagonal token.
- Uppercase and lowercase direction letters render equivalently.
- `AMP`, `EX`, and Kameo inputs remain recognizable in text and icon modes.

### Phase 3: Complete Tekken grammar

- [ ] Formalize lowercase directions as taps.
- [ ] Formalize uppercase directions as holds.
- [ ] Support slash and compact diagonals:
  - `d/f`, `d/b`, `u/f`, `u/b`.
  - `df`, `db`, `uf`, `ub`.
  - Uppercase hold variants.
- [ ] Render `N` as a visible neutral input.
- [ ] Preserve `1` through `4` as Left Punch, Right Punch, Left Kick, and Right
      Kick.
- [ ] Retain `qcf`, `qcb`, `hcf`, `hcb`, `dp`, and `rdp`.
- [ ] Validate `ff`, `fff`, `bb`, and common dash inputs.
- [ ] Retain common states:
  - `WS`, `FC`, `WR`, `BT`, `SS`, `SSL`, `SSR`, `SWL`, and `SWR`.
- [ ] Retain Heat and Rage prefixes `H.` and `R.`.
- [ ] Retain ground positions:
  - `FD/FT`, `FD/FA`, `FU/FT`, and `FU/FA`.
- [ ] Apply Tekken-specific separator meanings:
  - `+` = simultaneous.
  - `,` = followed by.
  - `~` = immediate or slide input.
  - `_` = alternative.
  - `<` = delayed input.
  - `:` = just-frame input.
  - `=` = next in sequence.
- [ ] Preserve character-specific stance abbreviations as descriptive text when
      no universal meaning is defined.

#### Tekken acceptance examples

```text
f,N,d,d/f+2
D/F+1,2,1,2
WS1,2, uf1, f2,3, ff3+4
CH 1+2, n2,b df1, f2,3
FD/FT 3+4
```

Specific requirements:

- Tap and held arrows are visually distinct.
- `N` remains visible in icon mode.
- `D/F` remains a single held diagonal rather than two directions.
- Universal states and ground positions receive meaningful labels.

### Phase 4: Improve text and icon rendering

#### Mortal Kombat

- [ ] Render `DF` as separate Down and Forward arrows.
- [ ] Use the same normal arrow for uppercase and lowercase directions.
- [ ] Render `114` as three numeric button icons.
- [ ] Display `K`, `EX`, and `AMP` with readable labeled button or badge icons.
- [ ] Add profile-aware accessible names:
  - `Button 1, Front Punch`.
  - `Button 2, Back Punch`.
  - `Button 3, Front Kick`.
  - `Button 4, Back Kick`.

#### Tekken

- [ ] Render lowercase directions with tap icons.
- [ ] Render uppercase directions with hold icons.
- [ ] Keep diagonals as single directional icons.
- [ ] Add a neutral/star icon for `N`.
- [ ] Add profile-aware accessible names:
  - `Button 1, Left Punch`.
  - `Button 2, Right Punch`.
  - `Button 3, Left Kick`.
  - `Button 4, Right Kick`.

#### Shared display behavior

- [ ] Preserve the user's raw notation in colored-text mode.
- [ ] Use canonical token meaning for visual-icon mode.
- [ ] Never discard unknown text.
- [ ] Do not communicate tap, hold, or state differences by color alone.
- [ ] Keep existing global Joystick/Arrows settings for the initial release.
- [ ] Consider a per-game icon-style override only after user feedback shows a
      need for it.

### Phase 5: Expand the notation guide

Avoid adding several narrow tabs that become cramped in smaller windows. Use a
responsive profile selector with these sections:

1. Shared Basics
2. Standard / Numpad
3. Mortal Kombat
4. Tekken

- [ ] Default to the active game's profile when the guide is opened from within
      a game.
- [ ] Include button mappings for each profile.
- [ ] Explain direction parsing and capitalization.
- [ ] Explain profile-specific separator meanings.
- [ ] List common mechanics and modifiers.
- [ ] Include at least three realistic examples per profile.
- [ ] Add a live text/icon preview.
- [ ] Explain **Settings > Notation > Motion Style > Arrows** prominently.
- [ ] Demonstrate joystick, arrow, tap, hold, diagonal, and neutral icons.
- [ ] Use responsive cards or accordions so the guide remains usable at the
      minimum supported window size.
- [ ] Ensure every tab, selector, and accordion is keyboard accessible.
- [ ] Provide accessible text labels for every visual example.

### Phase 6: Tests, migration, and release verification

#### Parser tests

- [ ] Add table-driven fixtures for Mortal Kombat and Tekken.
- [ ] Use real community combo examples as a golden corpus.
- [ ] Assert token types, canonical values, and preserved raw values.
- [ ] Assert that valid community notation has no unknown structural tokens.
- [ ] Retain boundary tests preventing acronyms from being parsed inside normal
      words.
- [ ] Add regression coverage proving Standard notation remains unchanged.

#### Display tests

- [ ] Test Mortal Kombat sequential direction arrows.
- [ ] Test Mortal Kombat dial strings without repeat collapsing.
- [ ] Test Tekken tap and held direction icons.
- [ ] Test Tekken diagonal and neutral icons.
- [ ] Test profile-aware accessible button names.
- [ ] Test text-mode raw notation preservation.

#### Storage and E2E tests

- [ ] Test legacy profile migration.
- [ ] Test stored-combo reparsing after a profile change.
- [ ] Create a Mortal Kombat game, enter a representative combo, save, reload,
      and verify its text and icons.
- [ ] Repeat the flow with a representative Tekken combo.
- [ ] Verify imported backups containing legacy `button-numbers` games.

#### Release work

- [ ] Increment `COMBO_NOTATION_PARSER_VERSION` when parser behavior lands.
- [ ] Update the changelog with user-facing language.
- [ ] Document migration behavior in release notes.
- [ ] Run full unit, component, storage, E2E, TypeScript, lint, and production
      build validation.

## Community validation

- [ ] Ask the original issue author to validate the Mortal Kombat fixtures and
      guide wording.
- [ ] Recruit at least one experienced Tekken player to review Tekken fixtures,
      tap/hold semantics, and stance terminology.
- [ ] Record reviewed examples in versioned test fixtures so later parser
      changes cannot silently regress them.
- [ ] Invite corrections through a documented notation contribution process.

Community review is important because these dialects look similar but encode
different meanings.

## Initial scope

### Include

- Mortal Kombat 9, X, 11, and 1.
- Tekken 7 and 8.
- Universal directions, numbered attack buttons, states, separators, and
  commonly used mechanics.
- Text and icon display.
- Accessible descriptions and keyboard-operable guide navigation.

### Defer

- Every character-specific Tekken stance abbreviation.
- Pre-MK9 legacy HP/LP/HK/LK notation.
- Platform-specific PlayStation, Xbox, or Nintendo glyphs.
- Injustice-specific mechanics.
- A generalized third-party notation plugin system.
- Per-game motion icon overrides unless requested after the initial release.

Deferred or unknown notation must remain readable text rather than being
discarded or incorrectly classified.

## Research references

- [MK11 Notation Guide — Test Your Might](https://testyourmight.com/threads/mk11-notation-guide.67676/)
- [MKX Notation Guide — Test Your Might](https://testyourmight.com/threads/notation-for-mkx.50232/)
- [Mortal Kombat 1 Basic Moves — Mortal Kombat Secrets](https://www.mksecrets.net/games/mortal-kombat-1/moves/basic/)
- [Tekken community notation — Tekken Wiki](https://tekken.fandom.com/wiki/Move_Terminology)
- [Tekken Zaibatsu notation glossary](https://www.tekkenzaibatsu.com/wiki/glossary.html)
- [Mortal Kombat 1 Kameo overview — Xbox Wire](https://news.xbox.com/en-us/2023/06/08/mortal-kombat-1-kameo-fighters/amp/)
