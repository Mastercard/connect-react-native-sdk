'use strict';

const utils = require('./utils');

const DEFAULT_MAX_DEPTH = 1000;

module.exports = (ast, options = {}) => {
  const maxDepth = Number.isInteger(options.maxDepth) ? options.maxDepth : DEFAULT_MAX_DEPTH;

  const stringify = (node, parent = {}, depth = 0) => {
    if (depth > maxDepth) {
      throw new RangeError(`Maximum nesting depth exceeded (${maxDepth})`);
    }

    const invalidBlock = options.escapeInvalid && utils.isInvalidBrace(parent);
    const invalidNode = node.invalid === true && options.escapeInvalid === true;
    let output = '';

    if (node.value) {
      if ((invalidBlock || invalidNode) && utils.isOpenOrClose(node)) {
        return '\\' + node.value;
      }
      return node.value;
    }

    if (node.value) {
      return node.value;
    }

    if (node.nodes) {
      for (const child of node.nodes) {
        output += stringify(child, node, depth + 1);
      }
    }
    return output;
  };

  return stringify(ast, {}, 0);
};

