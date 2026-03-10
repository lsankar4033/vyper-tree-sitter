const BYTE_STRING_DOUBLE = /[bB]"([^"\\\n]|\\.)*"/;
const BYTE_STRING_SINGLE = /[bB]'([^'\\\n]|\\.)*'/;
const HEX_STRING_DOUBLE = /x"([^"\\\n]|\\.)*"/;
const HEX_STRING_SINGLE = /x'([^'\\\n]|\\.)*'/;
const RAW_STRING_DOUBLE = /[rRuU]"([^"\\\n]|\\.)*"/;
const RAW_STRING_SINGLE = /[rRuU]'([^'\\\n]|\\.)*'/;
const RAW_BYTE_STRING_DOUBLE = /([rR][bB]|[bB][rR])"([^"\\\n]|\\.)*"/;
const RAW_BYTE_STRING_SINGLE = /([rR][bB]|[bB][rR])'([^'\\\n]|\\.)*'/;
const STRING_DOUBLE = /"([^"\\\n]|\\.)*"/;
const STRING_SINGLE = /'([^'\\\n]|\\.)*'/;

const DOCSTRING_CHUNK_DOUBLE_PATTERNS = [
  /[^"\n]+/,
  /\\./,
  /"[^"\n]/,
  /""[^"\n]/,
  /"\n/,
  /""\n/,
];

const DOCSTRING_CHUNK_SINGLE_PATTERNS = [
  /[^'\n]+/,
  /\\./,
  /'[^'\n]/,
  /''[^'\n]/,
  /'\n/,
  /''\n/,
];

module.exports = {
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
};
