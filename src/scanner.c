#include "tree_sitter/parser.h"

#include <stdbool.h>
#include <string.h>
#include <stdint.h>
#include <stdlib.h>

enum TokenType {
  NEWLINE,
  INDENT,
  DEDENT,
  SOFT_LINE_BREAK,
  SOFT_LINE_BREAK_END,
};

typedef struct {
  uint32_t *indents;
  uint32_t count;
  uint32_t capacity;
  uint32_t pending_dedents;
} Scanner;

static void push_indent(Scanner *scanner, uint32_t indent) {
  if (scanner->count == scanner->capacity) {
    uint32_t new_capacity = scanner->capacity == 0 ? 8 : scanner->capacity * 2;
    uint32_t *next = realloc(scanner->indents, new_capacity * sizeof(uint32_t));
    if (next == NULL) {
      return;
    }
    scanner->indents = next;
    scanner->capacity = new_capacity;
  }
  scanner->indents[scanner->count++] = indent;
}

static uint32_t top_indent(const Scanner *scanner) {
  return scanner->count == 0 ? 0 : scanner->indents[scanner->count - 1];
}

static void pop_indent(Scanner *scanner) {
  if (scanner->count > 0) {
    scanner->count--;
  }
}

static uint32_t count_indent(TSLexer *lexer) {
  uint32_t indent = 0;
  while (lexer->lookahead == ' ' || lexer->lookahead == '\t') {
    indent += lexer->lookahead == '\t' ? 8 : 1;
    lexer->advance(lexer, true);
  }
  return indent;
}

static void skip_comment_line(TSLexer *lexer) {
  while (lexer->lookahead != '\n' && lexer->lookahead != 0) {
    lexer->advance(lexer, true);
  }
}

static bool is_horizontal_whitespace(int32_t lookahead) {
  return lookahead == ' ' || lookahead == '\t' || lookahead == '\f' || lookahead == '\r';
}

static bool is_closing_delimiter(int32_t lookahead) {
  return lookahead == ')' || lookahead == ']' || lookahead == '}';
}

static bool emit_newline(TSLexer *lexer) {
  lexer->advance(lexer, true);
  lexer->mark_end(lexer);
  lexer->result_symbol = NEWLINE;
  return true;
}

static bool emit_line_break_token(TSLexer *lexer, const bool *valid_symbols) {
  bool wants_soft = valid_symbols[SOFT_LINE_BREAK] || valid_symbols[SOFT_LINE_BREAK_END];
  bool wants_newline = valid_symbols[NEWLINE];

  if (!wants_soft && !wants_newline) {
    return false;
  }

  lexer->advance(lexer, true);

  if (wants_soft) {
    while (is_horizontal_whitespace(lexer->lookahead)) {
      lexer->advance(lexer, true);
    }

    lexer->mark_end(lexer);

    if (is_closing_delimiter(lexer->lookahead) && valid_symbols[SOFT_LINE_BREAK_END]) {
      lexer->result_symbol = SOFT_LINE_BREAK_END;
      return true;
    }

    if (valid_symbols[SOFT_LINE_BREAK]) {
      lexer->result_symbol = SOFT_LINE_BREAK;
      return true;
    }
  }

  if (!wants_newline) {
    return false;
  }

  lexer->mark_end(lexer);
  lexer->result_symbol = NEWLINE;
  return true;
}

static bool emit_pending_dedent(Scanner *scanner, const bool *valid_symbols, TSLexer *lexer) {
  if (scanner->pending_dedents == 0 || !valid_symbols[DEDENT]) {
    return false;
  }

  scanner->pending_dedents--;
  pop_indent(scanner);
  lexer->result_symbol = DEDENT;
  return true;
}

static uint32_t count_dedents(const Scanner *scanner, uint32_t indent) {
  uint32_t dedents = 0;
  while (scanner->count - dedents > 1 && scanner->indents[scanner->count - dedents - 1] > indent) {
    dedents++;
  }
  return dedents;
}

static bool scan_beginning_of_line(Scanner *scanner, TSLexer *lexer, const bool *valid_symbols) {
  while (true) {
    uint32_t indent = count_indent(lexer);

    if (lexer->lookahead == '\r') {
      lexer->advance(lexer, true);
      continue;
    }

    if (lexer->lookahead == '#') {
      skip_comment_line(lexer);
      if (lexer->lookahead == '\n') {
        if (valid_symbols[NEWLINE]) {
          return emit_newline(lexer);
        }
        return false;
      }
      if (lexer->lookahead == 0) {
        break;
      }
    }

    if (lexer->lookahead == '\n') {
      if (valid_symbols[NEWLINE]) {
        return emit_newline(lexer);
      }
      return false;
    }

    if (lexer->lookahead == 0) {
      break;
    }

    // Continuation lines that only close a surrounding delimiter should not
    // participate in indentation handling.
    if (is_closing_delimiter(lexer->lookahead)) {
      return false;
    }

    uint32_t current_indent = top_indent(scanner);
    if (indent > current_indent) {
      if (valid_symbols[INDENT]) {
        push_indent(scanner, indent);
        lexer->result_symbol = INDENT;
        return true;
      }
      return false;
    }

    if (indent < current_indent) {
      if (!valid_symbols[DEDENT]) {
        return false;
      }

      uint32_t dedents = count_dedents(scanner, indent);
      if (dedents > 0) {
        scanner->pending_dedents = dedents - 1;
        pop_indent(scanner);
        lexer->result_symbol = DEDENT;
        return true;
      }
    }

    return false;
  }

  return false;
}

static bool emit_eof_dedent(Scanner *scanner, const bool *valid_symbols, TSLexer *lexer) {
  if (lexer->lookahead == 0 && scanner->count > 1 && valid_symbols[DEDENT]) {
    pop_indent(scanner);
    lexer->result_symbol = DEDENT;
    return true;
  }

  return false;
}

void *tree_sitter_vyper_external_scanner_create(void) {
  Scanner *scanner = calloc(1, sizeof(Scanner));
  push_indent(scanner, 0);
  return scanner;
}

void tree_sitter_vyper_external_scanner_destroy(void *payload) {
  Scanner *scanner = (Scanner *)payload;
  free(scanner->indents);
  free(scanner);
}

unsigned tree_sitter_vyper_external_scanner_serialize(void *payload, char *buffer) {
  Scanner *scanner = (Scanner *)payload;
  unsigned size = 0;

  if (TREE_SITTER_SERIALIZATION_BUFFER_SIZE < sizeof(uint32_t)) {
    return 0;
  }

  memcpy(buffer + size, &scanner->count, sizeof(uint32_t));
  size += sizeof(uint32_t);

  for (uint32_t i = 0; i < scanner->count; i++) {
    if (size + sizeof(uint32_t) > TREE_SITTER_SERIALIZATION_BUFFER_SIZE) {
      return size;
    }
    memcpy(buffer + size, &scanner->indents[i], sizeof(uint32_t));
    size += sizeof(uint32_t);
  }

  if (size + sizeof(uint32_t) <= TREE_SITTER_SERIALIZATION_BUFFER_SIZE) {
    memcpy(buffer + size, &scanner->pending_dedents, sizeof(uint32_t));
    size += sizeof(uint32_t);
  }

  return size;
}

void tree_sitter_vyper_external_scanner_deserialize(void *payload, const char *buffer, unsigned length) {
  Scanner *scanner = (Scanner *)payload;
  scanner->count = 0;
  scanner->pending_dedents = 0;

  if (length < sizeof(uint32_t)) {
    push_indent(scanner, 0);
    return;
  }

  unsigned size = 0;
  uint32_t count = 0;
  memcpy(&count, buffer + size, sizeof(uint32_t));
  size += sizeof(uint32_t);

  for (uint32_t i = 0; i < count && size + sizeof(uint32_t) <= length; i++) {
    uint32_t indent = 0;
    memcpy(&indent, buffer + size, sizeof(uint32_t));
    size += sizeof(uint32_t);
    push_indent(scanner, indent);
  }

  if (size + sizeof(uint32_t) <= length) {
    memcpy(&scanner->pending_dedents, buffer + size, sizeof(uint32_t));
    size += sizeof(uint32_t);
  }

  if (scanner->count == 0) {
    push_indent(scanner, 0);
  }
}

bool tree_sitter_vyper_external_scanner_scan(void *payload, TSLexer *lexer, const bool *valid_symbols) {
  Scanner *scanner = (Scanner *)payload;

  if (emit_pending_dedent(scanner, valid_symbols, lexer)) {
    return true;
  }

  if (lexer->get_column(lexer) == 0) {
    if (scan_beginning_of_line(scanner, lexer, valid_symbols)) {
      return true;
    }
  }

  if (lexer->lookahead == '\n') {
    return emit_line_break_token(lexer, valid_symbols);
  }

  while (is_horizontal_whitespace(lexer->lookahead)) {
    lexer->advance(lexer, true);
  }

  if (lexer->lookahead == '\n') {
    return emit_line_break_token(lexer, valid_symbols);
  }

  return emit_eof_dedent(scanner, valid_symbols, lexer);
}
