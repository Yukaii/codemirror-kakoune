# Insert-Mode Overhaul Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make insert-mode entry and replay behave closer to real Kakoune, starting with `change` and `append-at-eol` and keeping the behavior reusable for other insert-mode commands.

**Architecture:** Keep the current command table and key processor, but add a small insert-session layer in editor state so commands can tell the processor where insert mode started and how the cursor should behave after text is typed. That lets `c`, `A`, and similar commands share one typing path instead of special-casing edits in multiple places.

**Tech Stack:** TypeScript, CodeMirror state/view APIs, Jest, existing parity corpus under `test/kakoune/test/normal`

---

## Chunk 1: Insert session state and entry helpers

**Files:**
- Modify: `src/state.ts`
- Modify: `src/keys.ts`
- Test: `test/poc/kakoune-parity.test.ts`

- [ ] **Step 1: Add a failing parity case if needed**

Confirm the current parity sample still contains `change` and `append-at-eol`, and keep them enabled so the plan is validated by the existing corpus rather than a synthetic unit test.

- [ ] **Step 2: Add insert-session state to the editor state**

Add the minimal state needed to describe an active insert session, such as the original selection/cursor anchor and any cursor placement mode needed after text insertion.

- [ ] **Step 3: Thread the new state through insert typing**

Update the insert-mode path in `KakouneKeyProcessor.handle(...)` so typed characters and register insertion consult the insert-session state instead of always inserting at `range.head`.

- [ ] **Step 4: Run the focused parity test**

Run: `pnpm exec jest --runInBand test/poc/kakoune-parity.test.ts`

Expected: `change` and `append-at-eol` should still fail until the command bindings are wired, but the insert-session plumbing should compile cleanly.

- [ ] **Step 5: Commit**

```bash
git add src/state.ts src/keys.ts test/poc/kakoune-parity.test.ts
git commit -m "refactor(kakoune): add insert session state"
```

## Chunk 2: Kakoune-shaped change and append commands

**Files:**
- Modify: `src/commands.ts`
- Modify: `src/state.ts` if additional state is needed for insert entry/reset
- Test: `test/kakoune/test/normal/change/*`
- Test: `test/kakoune/test/normal/append-at-eol/*`

- [ ] **Step 1: Make `change` enter insert mode from the deleted range**

Update the `c` binding to preserve the edit location Kakoune expects after deletion, then enter insert mode through the shared insert-session path.

- [ ] **Step 2: Make `A` behave like append-at-EOL**

Update the `A` binding so it moves to the line end, enters insert mode, and places subsequent typing after the end of the line in the same shared path.

- [ ] **Step 3: Keep cursor movement and register replay aligned**

Verify that `<C-r>` insert-register replay, plain typing, and cursor placement still behave correctly after the new insert-session state is active.

- [ ] **Step 4: Run the focused parity test**

Run: `pnpm exec jest --runInBand test/poc/kakoune-parity.test.ts`

Expected: `change` and `append-at-eol` should pass, and the previously passing paste cases should stay green.

- [ ] **Step 5: Commit**

```bash
git add src/commands.ts src/state.ts
git commit -m "feat(kakoune): improve insert-mode entry semantics"
```

## Chunk 3: Regression pass and full verification

**Files:**
- Modify: `test/poc/kakoune-parity.test.ts` if more supported cases should be promoted
- Test: full Jest suite

- [ ] **Step 1: Review the remaining unsupported cases**

Re-scan the parity table and decide whether any additional insert-mode cases can be safely promoted after the overhaul.

- [ ] **Step 2: Run the full test suite**

Run: `pnpm exec jest --runInBand`

Expected: all existing tests pass with no regression in command handling or parity coverage.

- [ ] **Step 3: Record the checkpoint**

If the suite is green, commit any remaining parity-table updates or test-only refinements separately so the insert-mode overhaul stays reviewable.
