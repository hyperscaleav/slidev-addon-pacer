# Pacer demo deck

A short Slidev deck that exercises every pacer feature: per-segment chips, segment-scoped settings, and wall-clock-anchored breaks.

To run from the addon root:

```sh
pnpm install
pnpm dev
```

That launches Slidev on the deck at `http://localhost:3030`. Press <kbd>p</kbd> for presenter view.

To verify the break overlay shows on both presenter and audience views, open `http://localhost:3030/` in one browser window and `http://localhost:3030/presenter` in another. Raise a break from the presenter window; the overlay should appear in both.

Edit [slides.md](./slides.md) to tweak the demo.
