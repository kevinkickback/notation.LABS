export function hasModalOverlay() {
  return Boolean(
    document.querySelector(
      '[data-slot="dialog-overlay"], [data-slot="alert-dialog-overlay"]',
    ),
  );
}
