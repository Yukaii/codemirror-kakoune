# Kakoune Fixture PoC

This repo now has a small proof of concept for running real Kakoune regression fixtures against the CodeMirror Kakoune implementation.

## What It Does

- loads fixture directories from `test/kakoune/test`
- reads `cmd`, `in`, `rc`, and `error`
- resolves the Kakoune checkout path as `test/kakoune`
- allows `KAKOUNE_ROOT` to override that path for local experiments
- tokenizes simple Kakoune command strings
- runs them through the existing `kakoune()` extension and `KakouneKeyProcessor`
- compares final document text and primary selection state

## What It Does Not Do Yet

- full Kakoune JSON UI emulation
- full `rc` evaluation
- complete support for every Kakoune command token
- exhaustive fixture coverage

## Current PoC Tests

- fixture discovery and parsing
- command tokenization and execution
- a small mixed parity sample from real Kakoune fixtures

## Why The Submodule Exists

The Kakoune source is added as a sparse submodule at `test/kakoune` so the fixture corpus is available locally without hardcoding an external absolute path.

## Next Steps

- expand fixture coverage gradually
- add richer mismatch reporting
- decide whether to emulate JSON UI traces or keep comparing final state only
