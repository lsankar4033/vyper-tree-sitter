const BYTE_STRING_DOUBLE = /[bB]"([^"\\\n]|\\.)*"/;
const BYTE_STRING_SINGLE = /[bB]'([^'\\\n]|\\.)*'/;
const HEX_STRING_DOUBLE = /x"([^"\\\n]|\\.)*"/;
const HEX_STRING_SINGLE = /x'([^'\\\n]|\\.)*'/;
const STRING_DOUBLE = /"([^"\\\n]|\\.)*"/;
const STRING_SINGLE = /'([^'\\\n]|\\.)*'/;

const DOCSTRING_CHUNK_DOUBLE_PATTERNS = [
  /[^"\n]+/,
  /\\./,
  /"[^"\n]/,
  /""[^"\n]/,
];

const DOCSTRING_CHUNK_SINGLE_PATTERNS = [
  /[^'\n]+/,
  /\\./,
  /'[^'\n]/,
  /''[^'\n]/,
];

module.exports = {
  BYTE_STRING_DOUBLE,
  BYTE_STRING_SINGLE,
  HEX_STRING_DOUBLE,
  HEX_STRING_SINGLE,
  STRING_DOUBLE,
  STRING_SINGLE,
  DOCSTRING_CHUNK_DOUBLE_PATTERNS,
  DOCSTRING_CHUNK_SINGLE_PATTERNS,
};
