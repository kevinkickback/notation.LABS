# TODO

## Accessibility Improvements

Use WCAG 2.2 Level AA as the baseline. Accessible behavior should be the
default; settings should be reserved for genuine user preferences rather than
used to compensate for inaccessible controls.

### Priority 1: Core Interaction Fixes

- [ ] Make Game and Character cards keyboard-operable using semantic buttons
      or links with visible focus indicators. Keep Edit and Delete as separate
      controls rather than nesting buttons.
- [ ] Add contextual accessible names to every icon-only action, such as
      `Edit Ryu`, `Duplicate Corner Combo`, and `Delete Street Fighter 6`.
- [ ] Make enabled Combo drag handles keyboard-focusable. Add an accessible
      name and verify Space, arrow-key, and Escape behavior with screen-reader
      announcements.
- [ ] Convert create/edit dialogs to real forms using `<form onSubmit>` and
      submit buttons so Enter submission and native validation work.
- [ ] Provide persistent inline validation messages, set `aria-invalid` and
      `aria-describedby`, and focus the first invalid field. Toasts may
      supplement field errors but should not be the only error feedback.
- [ ] Associate all Settings labels with their Select, Slider, Switch, and
      color controls using IDs, `htmlFor`, `aria-label`, or `aria-labelledby`.
- [ ] Validate custom accent colors for text, control-state, and focus-ring
      contrast. Automatically choose a readable foreground color and warn or
      reject combinations that do not meet the selected contrast target.

### Priority 2: Focus, Visibility, and Input Size

- [ ] Reveal hover-only card actions when the card contains keyboard focus by
      supporting `focus-within` in addition to pointer hover.
- [ ] Increase small interactive targets, including 16 px checkboxes, 20 px
      image-removal buttons, slider thumbs, switches, and tightly grouped
      28 px icon buttons. Meet the WCAG 2.2 minimum of 24 by 24 CSS pixels and
      prefer 32–40 px controls where space permits.
- [ ] Add a Skip to Content link and a stable ID to the main content region.
- [ ] Move focus to the new view heading when opening a Game or Character so
      navigation changes are clear to keyboard and screen-reader users.
- [ ] Add useful descriptions to dialogs that currently expose only a title,
      including the Character and Button Color dialogs.
- [ ] Verify loading, saving, import/export, search, and update messages use
      appropriate live-region semantics and do not over-announce routine
      changes.

### Priority 3: Accessibility Preferences

Add a compact Accessibility card under General Settings with:

- [ ] **UI scale:** System, 100%, 125%, 150%, 175%, and 200%. Scale the entire
      interface rather than only combo notation, and preserve standard
      browser/Electron zoom behavior.
- [ ] **Motion:** System Default, Reduced, and Full. System Default should
      honor `prefers-reduced-motion`; Reduced should disable nonessential card
      scaling, dialog zooming, sliding, rotation, pulsing, and transitions.
- [ ] **Contrast:** Standard and High. High Contrast should strengthen borders,
      muted text, focus indicators, separators, and selected-control states.
- [ ] **Control size:** Compact and Comfortable. Comfortable should enlarge
      interactive targets and spacing without changing application behavior.
- [ ] **Restore accessible defaults:** Reset scale, motion, contrast, control
      size, and accent color together.

Do not add a generic color-blind mode. Instead, ensure color is never the only
way information is communicated and provide tested notation palettes with text,
shape, or icon cues where necessary.

### Priority 4: Automated and Manual Verification

- [ ] Add `@axe-core/playwright` accessibility scans to representative E2E
      flows and run them in CI.
- [ ] Add keyboard-only E2E coverage for cards, dialogs, menus, tabs, filters,
      form submission, drag reordering, and destructive confirmations.
- [ ] Add tests at 200% zoom for reflow, dialog scrolling, persistent actions,
      focus visibility, and absence of unintended horizontal scrolling.
- [ ] Test default and user-selected accent colors in light and dark themes for
      WCAG text and non-text contrast.
- [ ] Test reduced-motion behavior with the emulated system preference.
- [ ] Perform manual keyboard and Windows Narrator passes before release.
      Verify accessible names, focus order, focus restoration, announcements,
      and that no functionality depends on a pointer or hover.

### Existing Strengths to Preserve

- Radix primitives provide a strong base for dialogs, menus, tabs, Selects,
  focus trapping, and keyboard interaction.
- The document declares English and has a primary heading and main landmark.
- Shared controls generally provide visible focus rings.
- Cover positioning provides keyboard-operable sliders as an alternative to
  pointer dragging.
- Required fields have visible Required badges and native `required` semantics.
- Notation supports colored text and visual icons, plus adjustable notation
  size.

### References

- [WCAG 2.2](https://www.w3.org/TR/WCAG22/)
- [Keyboard accessibility](https://www.w3.org/WAI/WCAG22/Understanding/keyboard-accessible.html)
- [Focus visible](https://www.w3.org/WAI/WCAG22/Understanding/focus-visible)
- [Target size minimum](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum)
- [Non-text contrast](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast)
- [Reduced motion](https://www.w3.org/WAI/WCAG22/Techniques/css/C39)
- [Error identification](https://www.w3.org/WAI/WCAG22/Understanding/error-identification)
- [Status messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html)
