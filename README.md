# tree-sitter-vyper

Tree-sitter grammar for Vyper.

## Goals

- Parse modern Vyper source in a way that is useful for editors
- Keep the grammar small, readable, and easy to maintain
- Support Python-style indentation through an external scanner
- Serve as the syntax foundation for `heswithme/zed-vyper`

## Scope Order

1. Core declarations and function bodies
2. Expressions and type syntax
3. Stable indentation handling
4. Queries for highlighting and editor tooling
5. Broader packaging and bindings

## Design Notes

- The grammar is authored in `grammar.js`, which is the standard Tree-sitter DSL.
- The generated parser is emitted in C.
- Indentation-sensitive tokens are handled by `src/scanner.c`.
- This repository is editor-agnostic. Zed-specific queries live in the separate
  `zed-vyper` repository.
- Vyper itself is the source of truth. The parser design is driven by
  `vyper/ast/grammar.lark`, `vyper/ast/pre_parser.py`, and `vyper.ast.parse_to_ast`.

## Current Status

This repository currently contains a compiler-referenced parser skeleton and
corpus fixtures for iterative expansion.

See `docs/reference-notes.md` for the current syntax inventory extracted from
the official Vyper parser pipeline.

Current corpus coverage includes:

- declarations, structs, events, flags, and basic functions
- declaration bodies with leading blank/comment-only lines and `event ...: pass`
- imports and aliased imports
- parenthesized imports and wildcard imports
- interfaces, `implements`, and `exports`
- advanced type syntax including `DynArray[...]` and nested `HashMap[...]`
- postfix array suffixes on explicit types and inline conditional expressions
- `extcall` / `staticcall`
- multiline closer-line calls and multiline `log Foo(...)`
- nested control flow with typed `for` targets, `raise`, `continue`, and `break`
- list and tuple literals, `empty(...)`, `abi_decode(...)`, and `in` / `not in`
- deprecated `enum`, empty event bodies, and imported type references like `foo.Bar`
- module and function docstrings

Reference smoke set:

- `../blockhash-oracle`
- `../LZV2Vyper`
- `../twocrypto-ng`
- `../curve-std`
- `../yb-core`
- `../fee-splitter`
- `../yearn-vaults-v3/contracts`

Run it with:

```bash
bash scripts/smoke_reference.sh
```
