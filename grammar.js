/// <reference types="tree-sitter-cli/dsl" />
// @ts-check

const { PREC } = require("./grammar/precedence");
const { commaSep1, sep1 } = require("./grammar/helpers");
const {
  BYTE_STRING_DOUBLE,
  BYTE_STRING_SINGLE,
  HEX_STRING_DOUBLE,
  HEX_STRING_SINGLE,
  RAW_STRING_DOUBLE,
  RAW_STRING_SINGLE,
  RAW_BYTE_STRING_DOUBLE,
  RAW_BYTE_STRING_SINGLE,
  STRING_DOUBLE,
  STRING_SINGLE,
  DOCSTRING_CHUNK_DOUBLE_PATTERNS,
  DOCSTRING_CHUNK_SINGLE_PATTERNS,
} = require("./grammar/tokens");

const softBreakTail = $ => seq(
  repeat($._soft_line_break),
  optional($._soft_line_break_end),
);

const declarationBody = ($, memberRule) => seq(
  $._newline,
  repeat($._newline),
  $._indent,
  repeat1(choice(memberRule, $._newline)),
  $._dedent,
);

const bareIdentifierLine = $ => seq(
  $.identifier,
  optional($.comment),
  $._newline,
);

const commaSeparatedWithSoftBreaks = ($, itemRule) => seq(
  itemRule,
  repeat(seq(",", repeat($._soft_line_break), itemRule)),
  optional(seq(",", repeat($._soft_line_break))),
);

const multilineCommaSeparatedWithSoftBreaks = ($, itemRule) => seq(
  repeat1($._soft_line_break),
  itemRule,
  repeat(seq(",", repeat($._soft_line_break), itemRule)),
  optional(seq(",", repeat($._soft_line_break))),
  repeat($._soft_line_break),
);

const multilineExpressionSequence = $ => seq(
  repeat1($._soft_line_break),
  $.expression,
  repeat(seq(repeat($._soft_line_break), ",", repeat($._soft_line_break), $.expression)),
  optional(seq(repeat($._soft_line_break), ",")),
  softBreakTail($),
);

const packedExpressionSequence = $ => choice(
  seq(
    $.expression,
    ",",
  ),
  seq(
    $.expression,
    ",",
    repeat($._soft_line_break),
    $.expression,
    repeat(seq(",", repeat($._soft_line_break), $.expression)),
  ),
  seq(
    $.expression,
    ",",
    repeat($._soft_line_break),
    $.expression,
    repeat(seq(",", repeat($._soft_line_break), $.expression)),
    ",",
  ),
);

module.exports = grammar({
  name: "vyper",

  externals: $ => [
    $._newline,
    $._indent,
    $._dedent,
    $._soft_line_break,
    $._soft_line_break_end,
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
    [$.assignment_target_list, $._expression_without_conditional],
    [$.log_statement, $.atom_expression],
    [$.parenthesized_expression, $.tuple],
    [$.parenthesized_expression, $.multiline_tuple],
    [$.parenthesized_expression, $.tuple_type],
    [$.parenthesized_expression, $.multiline_tuple, $.tuple_type],
    [$.tuple, $.multiline_tuple],
    [$.docstring, $.triple_quoted_string],
    [$.parameter_list],
    [$.module_binding_list],
    [$.argument_list],
    [$.argument, $.argument_list],
    [$.argument_list, $.call],
    [$.import_list],
    [$.wrapped_binary_expression],
    [$.binary_expression, $.wrapped_binary_expression],
    [$.list],
    [$.expression, $.conditional_expression],
    [$.conditional_expression, $.walrus_expression],
    [$.call],
    [$.call, $.parenthesized_expression, $.multiline_tuple],
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
      token(prec(2, choice(
        /#\s*pragma[^\n]*/,
        /#\s*@version[^\n]*/,
      ))),
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
      declarationBody($, $.struct_member),
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
      declarationBody($, $.interface_member),
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
        declarationBody($, choice($.event_member, $.pass_statement)),
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
      declarationBody($, bareIdentifierLine($)),
    ),

    enum_declaration: $ => seq(
      "enum",
      field("name", $.identifier),
      ":",
      declarationBody($, bareIdentifierLine($)),
    ),

    implements_statement: $ => seq(
      "implements",
      ":",
      field("value", choice($.identifier, $.imported_type)),
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

    module_binding_list: $ => choice(
      seq(
        $.module_binding,
        repeat(seq(",", $.module_binding)),
        optional(","),
        softBreakTail($),
      ),
      seq(
        repeat1($._soft_line_break),
        $.module_binding,
        repeat(seq(",", repeat($._soft_line_break), $.module_binding)),
        optional(seq(",", repeat($._soft_line_break))),
        repeat($._soft_line_break),
      ),
    ),

    module_binding: $ => seq(
      field("name", $.identifier),
      repeat($._soft_line_break),
      ":=",
      repeat($._soft_line_break),
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
      field("value", $._value_expression),
      $._newline,
    ),

    constant_type: $ => seq(
      "constant",
      "(",
      optional($._soft_line_break),
      $.type,
      softBreakTail($),
      ")",
    ),

    variable_annotation: $ => seq(
      choice("public", "reentrant", "immutable", "transient"),
      "(",
      optional($._soft_line_break),
      field("value", choice($.variable_annotation, $.type)),
      softBreakTail($),
      ")",
    ),

    state_variable_declaration: $ => seq(
      field("name", $.identifier),
      ":",
      field("type", choice($.variable_annotation, $.type)),
      optional(seq("=", field("value", $._value_expression))),
      $._newline,
    ),

    function_definition: $ => seq(
      repeat(seq($.decorator, repeat($._newline))),
      $.function_signature,
      ":",
      $.block,
    ),

    function_signature: $ => seq(
      "def",
      field("name", $.identifier),
      "(",
      optional($.parameter_list),
      optional($._soft_line_break_end),
      ")",
      optional(seq("->", field("return_type", $.type))),
    ),

    parameter_list: $ => prec.right(choice(
      commaSeparatedWithSoftBreaks($, $.parameter),
      multilineCommaSeparatedWithSoftBreaks($, $.parameter),
    )),

    decorator: $ => seq(
      "@",
      field("name", $.identifier),
      optional(seq("(", optional($.argument_list), optional($._soft_line_break_end), ")")),
      $._newline,
    ),

    parameter: $ => prec.right(choice(
      seq(
        field("name", $.identifier),
        repeat($._soft_line_break),
        ":",
        repeat($._soft_line_break),
        field("type", $.type),
        repeat($._soft_line_break),
        "=",
        repeat($._soft_line_break),
        field("default", $.expression),
      ),
      seq(
        field("name", $.identifier),
        repeat($._soft_line_break),
        ":",
        repeat($._soft_line_break),
        field("type", $.type),
      ),
    )),

    mutability: _ => choice("view", "pure", "nonpayable", "payable"),

    block: $ => seq(
      $._newline,
      repeat($._newline),
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

    return_statement: $ => choice(
      seq("return", $._newline),
      seq(
        "return",
        field("value", $.expression),
        ",",
        $._newline,
      ),
      seq(
        "return",
        field("value", $.expression),
        repeat1(seq(",", $.expression)),
        optional(","),
        $._newline,
      ),
      seq(
        "return",
        field("value", $.expression),
        $._newline,
      ),
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
      optional($._soft_line_break_end),
      ")",
      $._newline,
    ),

    assignment: $ => seq(
      field("left", choice($.assignment_target_list, $.expression)),
      "=",
      field("right", $._value_expression),
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
      field("operator", choice(
        "+=",
        "-=",
        "*=",
        "/=",
        "//=",
        "%=",
        "&=",
        "|=",
        "^=",
        "<<=",
        ">>=",
        "**=",
      )),
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
      $.keyword_argument,
      $.wrapped_binary_expression,
      $.expression,
    ),

    keyword_argument: $ => seq(
      field("name", $.identifier),
      "=",
      field("value", $.expression),
    ),

    argument_list: $ => prec.right(choice(
      commaSeparatedWithSoftBreaks($, $.argument),
      multilineCommaSeparatedWithSoftBreaks($, $.argument),
    )),

    _value_expression: $ => choice(
      $.packed_tuple,
      $.expression,
    ),

    packed_tuple: $ => prec.right(1, packedExpressionSequence($)),

    expression: $ => choice(
      $.conditional_expression,
      $._expression_without_conditional,
    ),

    conditional_expression: $ => prec.right(PREC.conditional, seq(
      field("consequence", $._expression_without_conditional),
      "if",
      field("condition", $.expression),
      "else",
      field("alternative", $.expression),
    )),

    _expression_without_conditional: $ => choice(
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
        repeat1($._soft_line_break),
        choice($.wrapped_binary_expression, $.expression),
        softBreakTail($),
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
          repeat($._soft_line_break),
          field("operator", operator),
          repeat($._soft_line_break),
          field("right", choice($.wrapped_binary_expression, $.expression)),
        )),
      ),
      prec.right(PREC.power, seq(
        field("left", choice($.wrapped_binary_expression, $.expression)),
        repeat($._soft_line_break),
        field("operator", "**"),
        repeat($._soft_line_break),
        field("right", choice($.wrapped_binary_expression, $.expression)),
      )),
      prec.left(PREC.compare, seq(
        field("left", choice($.wrapped_binary_expression, $.expression)),
        repeat($._soft_line_break),
        field("operator", seq("not", "in")),
        repeat($._soft_line_break),
        field("right", choice($.wrapped_binary_expression, $.expression)),
      )),
    ),

    call: $ => prec(PREC.call, seq(
      field("function", $.atom_expression),
      "(",
      optional($.argument_list),
      optional($._soft_line_break_end),
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
      choice(
        field("index", $.expression),
        seq(
          repeat1($._soft_line_break),
          field("index", $.expression),
          softBreakTail($),
        ),
      ),
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
      multilineExpressionSequence($),
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
        optional($._soft_line_break),
        $.expression,
        repeat(seq(optional($._soft_line_break), ",", optional($._soft_line_break), $.expression)),
        optional(seq(optional($._soft_line_break), ",")),
        softBreakTail($),
        "]",
      ),
    ),

    dict: $ => choice(
      seq(
        "{",
        optional(commaSep1($.dict_pair)),
        optional(","),
        "}",
      ),
      seq(
        "{",
        repeat1($._soft_line_break),
        $.dict_pair,
        repeat(seq(optional($._soft_line_break), ",", repeat($._soft_line_break), $.dict_pair)),
        optional(seq(optional($._soft_line_break), ",")),
        softBreakTail($),
        "}",
      ),
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
      $.decimal,
      $.integer,
      $.hex_string,
      $.triple_quoted_string,
      $.prefixed_string,
      $.prefixed_byte_string,
      $.adjacent_string,
      $.string,
      $.boolean,
      $.ellipsis,
      $.list,
      $.tuple,
      alias($.multiline_tuple, $.tuple),
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

    hex_string: _ => token(choice(HEX_STRING_DOUBLE, HEX_STRING_SINGLE)),

    triple_quoted_string: $ => choice(
      seq('"""', repeat(choice($.docstring_chunk_double, $.docstring_quoted_double, $.docstring_newline)), '"""'),
      seq("'''", repeat(choice($.docstring_chunk_single, $.docstring_quoted_single, $.docstring_newline)), "'''"),
      seq('b"""', repeat(choice($.docstring_chunk_double, $.docstring_quoted_double, $.docstring_newline)), '"""'),
      seq("b'''", repeat(choice($.docstring_chunk_single, $.docstring_quoted_single, $.docstring_newline)), "'''"),
      seq('B"""', repeat(choice($.docstring_chunk_double, $.docstring_quoted_double, $.docstring_newline)), '"""'),
      seq("B'''", repeat(choice($.docstring_chunk_single, $.docstring_quoted_single, $.docstring_newline)), "'''"),
    ),

    prefixed_string: _ => token(choice(
      RAW_STRING_DOUBLE,
      RAW_STRING_SINGLE,
    )),

    prefixed_byte_string: _ => token(choice(
      RAW_BYTE_STRING_DOUBLE,
      RAW_BYTE_STRING_SINGLE,
    )),

    adjacent_string: $ => prec.right(seq(
      field("left", choice(
        $.string,
        $.prefixed_string,
        $.prefixed_byte_string,
        $.triple_quoted_string,
      )),
      repeat1(field("right", choice(
        $.string,
        $.prefixed_string,
        $.prefixed_byte_string,
        $.triple_quoted_string,
      ))),
    )),

    special_builtin: $ => choice(
      $.empty_builtin,
      $.abi_decode_builtin,
    ),

    empty_builtin: $ => seq(
      "empty",
      "(",
      optional($._soft_line_break),
      $.type,
      softBreakTail($),
      ")",
    ),

    abi_decode_builtin: $ => seq(
      choice("abi_decode", "_abi_decode"),
      "(",
      optional($._soft_line_break),
      $.argument,
      repeat($._soft_line_break),
      ",",
      repeat($._soft_line_break),
      $.type,
      repeat(seq(repeat($._soft_line_break), ",", repeat($._soft_line_break), $.keyword_argument)),
      optional(seq(repeat($._soft_line_break), ",")),
      softBreakTail($),
      ")",
    ),

    type: $ => choice(
      $.postfix_type,
      $.identifier,
      $.imported_type,
      $.type_call,
      $.tuple_type,
      $.dyn_array_type,
      $.hash_map_type,
      $.string_type,
      $.bytes_type,
      $.subscripted_type,
    ),

    postfix_type: $ => prec(3, seq(
      choice(
        $.identifier,
        $.imported_type,
        $.type_call,
        $.tuple_type,
        $.dyn_array_type,
        $.hash_map_type,
        $.string_type,
        $.bytes_type,
      ),
      repeat1(seq(
        "[",
        choice(
          seq(
            commaSep1(choice($.type, $.expression)),
            optional(","),
          ),
          seq(
            repeat1($._soft_line_break),
            choice($.type, $.expression),
            repeat(seq(optional($._soft_line_break), ",", repeat($._soft_line_break), choice($.type, $.expression))),
            optional(seq(optional($._soft_line_break), ",")),
            softBreakTail($),
          ),
        ),
        "]",
      )),
    )),

    type_call: $ => seq(
      $.identifier,
      "(",
      commaSep1($.type),
      optional(","),
      ")",
    ),

    tuple_type: $ => seq(
      "(",
      optional($._soft_line_break),
      $.type,
      repeat(seq(optional($._soft_line_break), ",", repeat($._soft_line_break), $.type)),
      optional(seq(optional($._soft_line_break), ",")),
      softBreakTail($),
      ")",
    ),

    dyn_array_type: $ => prec(2, choice(
      seq(
        "DynArray",
        "[",
        $.type,
        ",",
        $.expression,
        optional(","),
        "]",
      ),
      seq(
        "DynArray",
        "[",
        repeat1($._soft_line_break),
        $.type,
        repeat($._soft_line_break),
        ",",
        repeat($._soft_line_break),
        $.expression,
        optional(seq(repeat($._soft_line_break), ",")),
        softBreakTail($),
        "]",
      ),
    )),

    hash_map_type: $ => prec(2, choice(
      seq(
        "HashMap",
        "[",
        $.type,
        ",",
        $.type,
        optional(","),
        "]",
      ),
      seq(
        "HashMap",
        "[",
        repeat1($._soft_line_break),
        $.type,
        repeat($._soft_line_break),
        ",",
        repeat($._soft_line_break),
        $.type,
        optional(seq(repeat($._soft_line_break), ",")),
        softBreakTail($),
        "]",
      ),
    )),

    string_type: $ => prec(2, choice(
      seq("String", "[", $.expression, "]"),
      seq(
        "String",
        "[",
        repeat1($._soft_line_break),
        $.expression,
        softBreakTail($),
        "]",
      ),
    )),

    bytes_type: $ => prec(2, choice(
      seq("Bytes", "[", $.expression, "]"),
      seq(
        "Bytes",
        "[",
        repeat1($._soft_line_break),
        $.expression,
        softBreakTail($),
        "]",
      ),
    )),

    subscripted_type: $ => prec(1, seq(
      $.identifier,
      "[",
      choice(
        seq(
          commaSep1(choice($.type, $.expression)),
          optional(","),
        ),
        seq(
          repeat1($._soft_line_break),
          choice($.type, $.expression),
          repeat(seq(optional($._soft_line_break), ",", repeat($._soft_line_break), choice($.type, $.expression))),
          optional(seq(optional($._soft_line_break), ",")),
          softBreakTail($),
        ),
      ),
      "]",
    )),

    comment: _ => token(prec(-1, seq("#", /.*/))),
    line_continuation: _ => token(seq("\\", /\r?\n/)),
    identifier: _ => /[A-Za-z_][A-Za-z0-9_]*/,
    decimal: _ => token(prec(2, choice(
      /\d[\d_]*\.\d[\d_]*([eE][+-]?\d[\d_]*)?/,
      /\d[\d_]*\.([eE][+-]?\d[\d_]*)?/,
      /\.\d[\d_]*([eE][+-]?\d[\d_]*)?/,
      /\d[\d_]*[eE][+-]?\d[\d_]*/,
    ))),
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
