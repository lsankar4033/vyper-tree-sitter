/// <reference types="tree-sitter-cli/dsl" />
// @ts-check

const { PREC } = require("./grammar/precedence");
const { commaSep1, sep1 } = require("./grammar/helpers");
const {
  BYTE_STRING_DOUBLE,
  BYTE_STRING_SINGLE,
  STRING_DOUBLE,
  STRING_SINGLE,
  DOCSTRING_CHUNK_DOUBLE_PATTERNS,
  DOCSTRING_CHUNK_SINGLE_PATTERNS,
} = require("./grammar/tokens");

module.exports = grammar({
  name: "vyper",

  externals: $ => [
    $._newline,
    $._indent,
    $._dedent,
  ],

  extras: $ => [
    /[ \t\f\r]/,
    $.comment,
    $.line_continuation,
  ],

  word: $ => $.identifier,

  supertypes: $ => [
    $.statement,
    $.expression,
    $.type,
  ],

  conflicts: $ => [
    [$.atom_expression, $.type],
    [$.atom_expression, $.type_call],
    [$.atom_expression, $.subscripted_type],
    [$.atom_expression, $.imported_type],
    [$.assignment_target_list, $.expression],
    [$.log_statement, $.atom_expression],
    [$.parenthesized_expression, $.tuple],
    [$.parenthesized_expression, $.multiline_tuple],
    [$.tuple, $.multiline_tuple],
    [$.parameter_list],
    [$.argument_list],
    [$.import_list],
    [$.wrapped_binary_expression],
    [$.binary_expression, $.wrapped_binary_expression],
    [$.list],
  ],

  rules: {
    source_file: $ => repeat($._top_level_item),

    _top_level_item: $ => choice(
      $.module_docstring,
      $.pragma_directive,
      $.import_statement,
      $.from_import_statement,
      $.struct_declaration,
      $.interface_declaration,
      $.event_declaration,
      $.enum_declaration,
      $.flag_declaration,
      $.uses_statement,
      $.initializes_statement,
      $.implements_statement,
      $.exports_declaration,
      $.function_definition,
      $.constant_declaration,
      $.state_variable_declaration,
      $._newline,
    ),

    module_docstring: $ => seq(
      $.docstring,
    ),

    pragma_directive: $ => seq(
      token(prec(2, /#\s*pragma[^\n]*/)),
      $._newline,
    ),

    import_statement: $ => seq(
      "import",
      $.import_item,
      repeat(seq(",", $.import_item)),
      optional(","),
      $._newline,
    ),

    from_import_statement: $ => seq(
      "from",
      $.relative_import_path,
      "import",
      choice(
        "*",
        seq("(", $.parenthesized_import_list, optional(","), ")"),
        $.import_list,
      ),
      $._newline,
    ),

    dotted_name: $ => sep1($.identifier, "."),

    relative_import_path: $ => choice(
      $.dotted_name,
      repeat1("."),
      seq(repeat1("."), $.dotted_name),
    ),

    import_item: $ => seq(
      $.dotted_name,
      optional(seq("as", $.identifier)),
    ),

    import_list: $ => prec.right(seq(
      $.import_item,
      repeat(seq(",", optional($._newline), $.import_item)),
      optional(seq(",", optional($._newline))),
    )),

    parenthesized_import_list: $ => prec.right(seq(
      optional($._newline),
      $.import_item,
      repeat(seq(optional($._newline), ",", optional($._newline), $.import_item)),
      optional(seq(optional($._newline), ",")),
      optional($._newline),
    )),

    imported_type: $ => seq($.identifier, repeat1(seq(".", $.identifier))),

    struct_declaration: $ => seq(
      "struct",
      field("name", $.identifier),
      ":",
      $._newline,
      $._indent,
      repeat1($.struct_member),
      $._dedent,
    ),

struct_member: $ => seq(
  field("name", $.identifier),
  ":",
  field("type", $.type),
  $._newline,
),


    interface_declaration: $ => seq(
      "interface",
      field("name", $.identifier),
      ":",
      $._newline,
      $._indent,
      repeat1($.interface_member),
      $._dedent,
    ),

interface_member: $ => seq(
  $.function_signature,
  ":",
  $.mutability,
  $._newline,
),


    event_declaration: $ => seq(
      "event",
      field("name", $.identifier),
      ":",
      choice(
        seq("pass", $._newline),
        seq(
          $._newline,
          $._indent,
          repeat1($.event_member),
          $._dedent,
        ),
        seq($._newline, $._indent, "pass", $._newline, $._dedent),
      ),
    ),

event_member: $ => seq(
  field("name", $.identifier),
  ":",
  field("type", choice($.indexed_type, $.type)),
  $._newline,
),


    indexed_type: $ => seq(
      "indexed",
      "(",
      $.type,
      ")",
    ),

    flag_declaration: $ => seq(
      "flag",
      field("name", $.identifier),
      ":",
      $._newline,
      $._indent,
      repeat1(seq($.identifier, $._newline)),
      $._dedent,
    ),

    enum_declaration: $ => seq(
      "enum",
      field("name", $.identifier),
      ":",
      $._newline,
      $._indent,
      repeat1(seq($.identifier, $._newline)),
      $._dedent,
    ),

    implements_statement: $ => seq(
      "implements",
      ":",
      $.identifier,
      $._newline,
    ),

    uses_statement: $ => seq(
      "uses",
      ":",
      field("value", choice($.identifier, $.imported_type)),
      $._newline,
    ),

    initializes_statement: $ => seq(
      "initializes",
      ":",
      field("value", choice($.identifier, $.imported_type, $.module_initialization)),
      $._newline,
    ),

    module_initialization: $ => seq(
      field("module", choice($.identifier, $.imported_type)),
      "[",
      $.module_binding_list,
      "]",
    ),

    module_binding_list: $ => seq(
      optional($.soft_line_break),
      $.module_binding,
      repeat(seq(optional($.soft_line_break), ",", optional($.soft_line_break), $.module_binding)),
      optional(seq(optional($.soft_line_break), ",")),
      optional($.soft_line_break_end),
    ),

    module_binding: $ => seq(
      field("name", $.identifier),
      ":=",
      field("value", $.atom_expression),
    ),

    exports_declaration: $ => seq(
      "exports",
      ":",
      choice(
        $.attribute,
        alias(choice($.tuple, $.multiline_tuple), $.tuple),
      ),
      $._newline,
    ),

    constant_declaration: $ => seq(
      field("name", $.identifier),
      ":",
      choice(
        $.constant_type,
        seq("public", "(", $.constant_type, ")"),
      ),
      "=",
      field("value", $.expression),
      $._newline,
    ),

    constant_type: $ => seq(
      "constant",
      "(",
      optional($.soft_line_break),
      $.type,
      optional($.soft_line_break_end),
      ")",
    ),

    variable_annotation: $ => seq(
      choice("public", "reentrant", "immutable", "transient"),
      "(",
      optional($.soft_line_break),
      field("value", choice($.variable_annotation, $.type)),
      optional($.soft_line_break_end),
      ")",
    ),

    state_variable_declaration: $ => seq(
      field("name", $.identifier),
      ":",
      field("type", choice($.variable_annotation, $.type)),
      optional(seq("=", field("value", $.expression))),
      $._newline,
    ),

    function_definition: $ => seq(
      repeat($.decorator),
      $.function_signature,
      ":",
      $.block,
    ),

    function_signature: $ => seq(
      "def",
      field("name", $.identifier),
      "(",
      optional($.parameter_list),
      ")",
      optional(seq("->", field("return_type", $.type))),
    ),

    parameter_list: $ => prec.right(choice(
      seq(
        $.parameter,
        repeat(seq(",", repeat($.soft_line_break), $.parameter)),
        optional(seq(",", repeat($.soft_line_break))),
        repeat($.soft_line_break),
      ),
      seq(
        repeat1($.soft_line_break),
        $.parameter,
        repeat(seq(",", repeat($.soft_line_break), $.parameter)),
        optional(seq(",", repeat($.soft_line_break))),
        repeat($.soft_line_break),
      ),
    )),

    decorator: $ => seq(
      "@",
      field("name", $.identifier),
      optional(seq("(", optional($.argument_list), ")")),
      $._newline,
    ),

    parameter: $ => seq(
      field("name", $.identifier),
      ":",
      field("type", $.type),
      optional(seq(
        "=",
        field("default", $.expression),
      )),
    ),

    multiline_parameter: $ => seq(
      field("name", $.identifier),
      ":",
      field("type", $.type),
      optional(seq(
        "=",
        field("default", $.expression),
      )),
    ),

    mutability: _ => choice("view", "pure", "nonpayable", "payable"),

    block: $ => seq(
      $._newline,
      $._indent,
      repeat1($.statement),
      $._dedent,
    ),

    statement: $ => choice(
      $.return_statement,
      $.assert_statement,
      $.raise_statement,
      $.break_statement,
      $.continue_statement,
      $.docstring_statement,
      $.log_statement,
      $.pass_statement,
      $.assignment,
      $.augmented_assignment,
      $.expression_statement,
      $.if_statement,
      $.for_statement,
      $.state_variable_declaration,
      $._newline,
    ),

    docstring_statement: $ => seq(
      $.docstring,
      $._newline,
    ),

    pass_statement: $ => seq("pass", $._newline),

    break_statement: $ => seq("break", $._newline),

    continue_statement: $ => seq("continue", $._newline),

    return_statement: $ => seq(
      "return",
      optional(commaSep1($.expression)),
      $._newline,
    ),

    assert_statement: $ => seq(
      "assert",
      $.expression,
      optional(seq(",", $.expression)),
      $._newline,
    ),

    raise_statement: $ => seq(
      "raise",
      optional($.expression),
      $._newline,
    ),

    log_statement: $ => seq(
      "log",
      choice($.identifier, $.attribute, $.subscript),
      "(",
      optional($.argument_list),
      ")",
      $._newline,
    ),

    assignment: $ => seq(
      field("left", choice($.assignment_target_list, $.expression)),
      "=",
      field("right", $.expression),
      $._newline,
    ),

    assignment_target_list: $ => choice(
      seq(
        $.atom_expression,
        ",",
        $.atom_expression,
        repeat(seq(",", $.atom_expression)),
      ),
      seq(
        "(",
        $.atom_expression,
        ",",
        $.atom_expression,
        repeat(seq(",", $.atom_expression)),
        optional(","),
        ")",
      ),
    ),

    augmented_assignment: $ => seq(
      field("left", $.expression),
      field("operator", choice("+=", "-=", "*=", "/=", "//=", "%=")),
      field("right", $.expression),
      $._newline,
    ),

    expression_statement: $ => seq(
      $.expression,
      $._newline,
    ),

    if_statement: $ => seq(
      "if",
      field("condition", $.expression),
      ":",
      $.block,
      repeat($.elif_clause),
      optional($.else_clause),
    ),

    elif_clause: $ => seq(
      "elif",
      field("condition", $.expression),
      ":",
      $.block,
    ),

    else_clause: $ => seq(
      "else",
      ":",
      $.block,
    ),

    for_statement: $ => seq(
      "for",
      field("target", choice($.typed_loop_variable, $.identifier)),
      "in",
      field("iterator", $.expression),
      ":",
      $.block,
    ),

    typed_loop_variable: $ => seq(
      field("name", $.identifier),
      ":",
      field("type", $.type),
    ),

    argument: $ => choice(
      $.expression,
      $.keyword_argument,
    ),

    keyword_argument: $ => seq(
      field("name", $.identifier),
      "=",
      field("value", $.expression),
    ),

    argument_list: $ => prec.right(choice(
      seq(
        repeat1($.soft_line_break),
        $.argument,
        repeat1($.soft_line_break),
      ),
      seq(
        $.argument,
        repeat(seq(",", repeat($.soft_line_break), $.argument)),
        optional(seq(",", repeat($.soft_line_break))),
        repeat($.soft_line_break),
      ),
      seq(
        repeat1($.soft_line_break),
        $.argument,
        repeat(seq(",", repeat($.soft_line_break), $.argument)),
        optional(seq(",", repeat($.soft_line_break))),
        repeat($.soft_line_break),
      ),
    )),

    soft_line_break: $ => seq(
      $._newline,
    ),

    soft_line_break_end: $ => $._newline,

    expression: $ => choice(
      $.atom_expression,
      $.external_call,
      $.walrus_expression,
      $.not_expression,
      $.binary_expression,
      $.unary_expression,
    ),

    walrus_expression: $ => seq(
      field("name", $.identifier),
      ":=",
      field("value", $.expression),
    ),

    not_expression: $ => prec(PREC.unary, seq(
      "not",
      $.expression,
    )),

    parenthesized_expression: $ => choice(
      seq("(", $.expression, ")"),
      seq(
        "(",
        repeat1($.soft_line_break),
        choice($.wrapped_binary_expression, $.expression),
        repeat($.soft_line_break),
        ")",
      ),
    ),

    unary_expression: $ => prec(PREC.unary, seq(
      choice("-", "+", "~"),
      $.expression,
    )),

    binary_expression: $ => choice(
      ...[
        ["or", PREC.or],
        ["and", PREC.and],
        ["in", PREC.compare],
        ["==", PREC.compare],
        ["!=", PREC.compare],
        ["<", PREC.compare],
        ["<=", PREC.compare],
        [">", PREC.compare],
        [">=", PREC.compare],
        ["|", PREC.bitwise_or],
        ["^", PREC.bitwise_xor],
        ["&", PREC.bitwise_and],
        ["<<", PREC.shift],
        [">>", PREC.shift],
        ["+", PREC.additive],
        ["-", PREC.additive],
        ["*", PREC.multiplicative],
        ["//", PREC.multiplicative],
        ["/", PREC.multiplicative],
        ["%", PREC.multiplicative],
      ].map(([operator, precedence]) =>
        prec.left(precedence, seq(
          field("left", $.expression),
          field("operator", operator),
          field("right", $.expression),
        )),
      ),
      prec.right(PREC.power, seq(
        field("left", $.expression),
        field("operator", "**"),
        field("right", $.expression),
      )),
      prec.left(PREC.compare, seq(
        field("left", $.expression),
        field("operator", seq("not", "in")),
        field("right", $.expression),
      )),
    ),

    wrapped_binary_expression: $ => choice(
      ...[
        ["or", PREC.or],
        ["and", PREC.and],
        ["in", PREC.compare],
        ["==", PREC.compare],
        ["!=", PREC.compare],
        ["<", PREC.compare],
        ["<=", PREC.compare],
        [">", PREC.compare],
        [">=", PREC.compare],
        ["|", PREC.bitwise_or],
        ["^", PREC.bitwise_xor],
        ["&", PREC.bitwise_and],
        ["<<", PREC.shift],
        [">>", PREC.shift],
        ["+", PREC.additive],
        ["-", PREC.additive],
        ["*", PREC.multiplicative],
        ["//", PREC.multiplicative],
        ["/", PREC.multiplicative],
        ["%", PREC.multiplicative],
      ].map(([operator, precedence]) =>
        prec.left(precedence, seq(
          field("left", choice($.wrapped_binary_expression, $.expression)),
          repeat($.soft_line_break),
          field("operator", operator),
          repeat($.soft_line_break),
          field("right", choice($.wrapped_binary_expression, $.expression)),
        )),
      ),
      prec.right(PREC.power, seq(
        field("left", choice($.wrapped_binary_expression, $.expression)),
        repeat($.soft_line_break),
        field("operator", "**"),
        repeat($.soft_line_break),
        field("right", choice($.wrapped_binary_expression, $.expression)),
      )),
      prec.left(PREC.compare, seq(
        field("left", choice($.wrapped_binary_expression, $.expression)),
        repeat($.soft_line_break),
        field("operator", seq("not", "in")),
        repeat($.soft_line_break),
        field("right", choice($.wrapped_binary_expression, $.expression)),
      )),
    ),

    call: $ => prec(PREC.call, seq(
      field("function", $.atom_expression),
      "(",
      optional($.argument_list),
      repeat($.soft_line_break),
      ")",
    )),

    external_call: $ => prec(PREC.unary, seq(
      field("kind", choice("extcall", "staticcall")),
      field("value", $.atom_expression),
    )),

    attribute: $ => prec.left(PREC.attribute, seq(
      field("value", $.atom_expression),
      ".",
      field("attribute", $.identifier),
    )),

    subscript: $ => prec.left(PREC.attribute, seq(
      field("value", choice($.atom_expression, $.list)),
      "[",
      field("index", $.expression),
      "]",
    )),

    tuple: $ => seq(
      "(",
      commaSep1($.expression),
      optional(","),
      ")",
    ),

    multiline_tuple: $ => seq(
      "(",
      optional($.soft_line_break),
      $.expression,
      repeat(seq(optional($.soft_line_break), ",", optional($.soft_line_break), $.expression)),
      optional(seq(optional($.soft_line_break), ",")),
      optional($.soft_line_break_end),
      ")",
    ),

    list: $ => choice(
      seq(
        "[",
        optional(commaSep1($.expression)),
        optional(","),
        "]",
      ),
      seq(
        "[",
        optional($.soft_line_break),
        $.expression,
        repeat(seq(optional($.soft_line_break), ",", optional($.soft_line_break), $.expression)),
        optional(seq(optional($.soft_line_break), ",")),
        optional($.soft_line_break_end),
        "]",
      ),
    ),

    dict: $ => seq(
      "{",
      optional(commaSep1($.dict_pair)),
      optional(","),
      "}",
    ),

    dict_pair: $ => seq(
      field("key", $.identifier),
      ":",
      field("value", $.expression),
    ),

    atom_expression: $ => choice(
      $.identifier,
      $.subscript,
      $.attribute,
      $.call,
      $.atom,
    ),

    atom: $ => choice(
      $.integer,
      $.string,
      $.boolean,
      $.ellipsis,
      $.list,
      $.tuple,
      $.dict,
      $.special_builtin,
      $.parenthesized_expression,
    ),

    docstring: $ => choice(
      seq('"""', repeat(choice($.docstring_chunk_double, $.docstring_quoted_double, $.docstring_newline)), '"""'),
      seq("'''", repeat(choice($.docstring_chunk_single, $.docstring_quoted_single, $.docstring_newline)), "'''"),
    ),

    docstring_chunk_double: _ => token(prec(3, choice(
      ...DOCSTRING_CHUNK_DOUBLE_PATTERNS,
    ))),

    docstring_quoted_double: _ => token(prec(3, /"[^"\n]+"/)),

    docstring_chunk_single: _ => token(prec(3, choice(
      ...DOCSTRING_CHUNK_SINGLE_PATTERNS,
    ))),

    docstring_quoted_single: _ => token(prec(3, /'[^'\n]+'/)),

    docstring_newline: _ => token(prec(3, /\n/)),

    special_builtin: $ => choice(
      $.empty_builtin,
      $.abi_decode_builtin,
    ),

    empty_builtin: $ => seq(
      "empty",
      "(",
      optional($._newline),
      $.type,
      optional($._newline),
      ")",
    ),

    abi_decode_builtin: $ => seq(
      choice("abi_decode", "_abi_decode"),
      "(",
      optional($._newline),
      $.argument,
      optional($._newline),
      ",",
      optional($._newline),
      $.type,
      repeat(seq(optional($._newline), ",", optional($._newline), $.keyword_argument)),
      optional($._newline),
      ")",
    ),

    type: $ => choice(
      $.identifier,
      $.imported_type,
      $.type_call,
      $.tuple_type,
      $.subscripted_type,
    ),

    type_call: $ => seq(
      $.identifier,
      "(",
      commaSep1($.type),
      optional(","),
      ")",
    ),

    tuple_type: $ => choice(
      seq(
        "(",
        commaSep1($.type),
        optional(","),
        ")",
      ),
      seq(
        "(",
        repeat1($.soft_line_break),
        $.type,
        repeat(seq(optional($.soft_line_break), ",", repeat($.soft_line_break), $.type)),
        optional(seq(optional($.soft_line_break), ",")),
        repeat($.soft_line_break),
        ")",
      ),
    ),

    subscripted_type: $ => seq(
      $.identifier,
      "[",
      commaSep1(choice($.type, $.expression)),
      optional(","),
      "]",
      repeat(seq(
        "[",
        commaSep1(choice($.type, $.expression)),
        optional(","),
        "]",
      )),
    ),

    comment: _ => token(prec(1, seq("#", /.*/))),
    line_continuation: _ => token(seq("\\", /\r?\n/)),
    identifier: _ => /[A-Za-z_][A-Za-z0-9_]*/,
    integer: _ => token(choice(
      /0[xX][0-9A-Fa-f_]+/,
      /0[bB][01_]+/,
      /0[oO][0-7_]+/,
      /\d[\d_]*/,
    )),
    boolean: _ => choice("True", "False"),
    ellipsis: _ => "...",
    string: _ => token(choice(
      BYTE_STRING_DOUBLE,
      BYTE_STRING_SINGLE,
      STRING_DOUBLE,
      STRING_SINGLE,
    )),
  },
});
