# Pacer demo deck

A short Slidev deck that exercises every pacer feature: per-segment chips, segment-scoped settings, and wall-clock-anchored breaks.

## First-time setup

```sh
pnpm install
pnpm approve-builds   # accept both esbuild and vue-demi
```

pnpm v11 requires interactive approval for any package that ships post-install build scripts, and won't run `pnpm <script>` until you've approved (or rejected) them. Pick the prompt's "all" option (`a`), then `y`. This is a one-time per-user setup; the approval persists in pnpm's user state, not in the repo.

If you skip this step, `pnpm dev` fails with:

```
[ERR_PNPM_IGNORED_BUILDS] Ignored build scripts: esbuild@..., vue-demi@...
[ERROR] Command failed with exit code 1: '.../pnpm' install
```

## Run the demo

```sh
pnpm dev
```

That launches Slidev on the deck at `http://localhost:3030`. Press <kbd>p</kbd> for presenter view.

To verify the break overlay shows on both presenter and audience views, open `http://localhost:3030/` in one browser window and `http://localhost:3030/presenter` in another. Raise a break from the presenter window; the overlay should appear in both.

Edit [slides.md](./slides.md) to tweak the demo.
