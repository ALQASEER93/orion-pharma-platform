import { BadRequestException } from '@nestjs/common';

type TokenType =
  | 'number'
  | 'identifier'
  | 'plus'
  | 'minus'
  | 'multiply'
  | 'divide'
  | 'lparen'
  | 'rparen'
  | 'comma'
  | 'eof';

type Token = {
  type: TokenType;
  value?: string;
};

const MAX_EXPRESSION_LENGTH = 256;
const DISALLOWED_FRAGMENTS = [
  '__proto__',
  'prototype',
  'constructor',
  '[',
  ']',
  '{',
  '}',
  ';',
];
const IDENTIFIER_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*$/;
const FUNCTION_NAMES = new Set(['min', 'max', 'round']);

class ExpressionParser {
  private cursor = 0;

  constructor(
    private readonly tokens: Token[],
    private readonly variables: Record<string, number>,
    private readonly allowUnknownIdentifiers: boolean,
  ) {}

  parse(): number {
    const value = this.parseExpression();
    this.expect('eof');
    this.assertFiniteNumber(value);
    return value;
  }

  private parseExpression(): number {
    let value = this.parseTerm();
    while (this.match('plus') || this.match('minus')) {
      const operator = this.previous();
      const right = this.parseTerm();
      value = operator.type === 'plus' ? value + right : value - right;
      this.assertFiniteNumber(value);
    }

    return value;
  }

  private parseTerm(): number {
    let value = this.parseFactor();
    while (this.match('multiply') || this.match('divide')) {
      const operator = this.previous();
      const right = this.parseFactor();
      if (operator.type === 'divide' && right === 0) {
        throw new BadRequestException(
          'Expression division by zero is not allowed.',
        );
      }

      value = operator.type === 'multiply' ? value * right : value / right;
      this.assertFiniteNumber(value);
    }

    return value;
  }

  private parseFactor(): number {
    if (this.match('plus')) {
      return this.parseFactor();
    }

    if (this.match('minus')) {
      return -1 * this.parseFactor();
    }

    if (this.match('number')) {
      const parsed = Number(this.previous().value);
      this.assertFiniteNumber(parsed);
      return parsed;
    }

    if (this.match('identifier')) {
      const identifier = this.previous().value ?? '';
      if (!IDENTIFIER_PATTERN.test(identifier)) {
        throw new BadRequestException(
          'Expression contains invalid identifier.',
        );
      }

      if (this.match('lparen')) {
        return this.parseFunction(identifier);
      }

      if (identifier in this.variables) {
        const value = this.variables[identifier];
        this.assertFiniteNumber(value);
        return value;
      }

      if (this.allowUnknownIdentifiers) {
        return 0;
      }

      throw new BadRequestException(
        `Expression references unknown identifier: ${identifier}`,
      );
    }

    if (this.match('lparen')) {
      const value = this.parseExpression();
      this.expect('rparen');
      return value;
    }

    throw new BadRequestException('Expression syntax is invalid.');
  }

  private parseFunction(name: string): number {
    const normalized = name.toLowerCase();
    if (!FUNCTION_NAMES.has(normalized)) {
      throw new BadRequestException(`Function "${name}" is not allowed.`);
    }

    const args: number[] = [];
    if (!this.check('rparen')) {
      do {
        args.push(this.parseExpression());
      } while (this.match('comma'));
    }

    this.expect('rparen');

    if (normalized === 'min') {
      if (args.length < 1) {
        throw new BadRequestException('min() requires at least one argument.');
      }

      return Math.min(...args);
    }

    if (normalized === 'max') {
      if (args.length < 1) {
        throw new BadRequestException('max() requires at least one argument.');
      }

      return Math.max(...args);
    }

    if (args.length < 1 || args.length > 2) {
      throw new BadRequestException('round() requires one or two arguments.');
    }

    const precision = args.length === 2 ? Math.trunc(args[1]) : 2;
    if (precision < 0 || precision > 6) {
      throw new BadRequestException(
        'round() precision must be between 0 and 6.',
      );
    }

    return Number(args[0].toFixed(precision));
  }

  private match(type: TokenType): boolean {
    if (!this.check(type)) {
      return false;
    }

    this.cursor += 1;
    return true;
  }

  private check(type: TokenType): boolean {
    if (this.isAtEnd()) {
      return type === 'eof';
    }

    return this.peek().type === type;
  }

  private expect(type: TokenType) {
    if (this.match(type)) {
      return;
    }

    throw new BadRequestException('Expression syntax is invalid.');
  }

  private peek() {
    return this.tokens[this.cursor];
  }

  private previous() {
    return this.tokens[this.cursor - 1];
  }

  private isAtEnd() {
    return this.peek().type === 'eof';
  }

  private assertFiniteNumber(value: number) {
    if (!Number.isFinite(value)) {
      throw new BadRequestException(
        'Expression must evaluate to a finite number.',
      );
    }
  }
}

function tokenizeExpression(expression: string): Token[] {
  const tokens: Token[] = [];
  let cursor = 0;

  while (cursor < expression.length) {
    const char = expression[cursor];

    if (/\s/.test(char)) {
      cursor += 1;
      continue;
    }

    if (/[0-9.]/.test(char)) {
      let numberLiteral = '';
      let dotCount = 0;
      while (cursor < expression.length && /[0-9.]/.test(expression[cursor])) {
        const current = expression[cursor];
        if (current === '.') {
          dotCount += 1;
        }
        numberLiteral += current;
        cursor += 1;
      }

      if (dotCount > 1 || numberLiteral === '.') {
        throw new BadRequestException(
          'Expression contains invalid number literal.',
        );
      }

      tokens.push({ type: 'number', value: numberLiteral });
      continue;
    }

    if (/[A-Za-z_]/.test(char)) {
      let identifier = '';
      while (
        cursor < expression.length &&
        /[A-Za-z0-9_]/.test(expression[cursor])
      ) {
        identifier += expression[cursor];
        cursor += 1;
      }

      tokens.push({ type: 'identifier', value: identifier });
      continue;
    }

    if (char === '+') {
      tokens.push({ type: 'plus' });
      cursor += 1;
      continue;
    }

    if (char === '-') {
      tokens.push({ type: 'minus' });
      cursor += 1;
      continue;
    }

    if (char === '*') {
      tokens.push({ type: 'multiply' });
      cursor += 1;
      continue;
    }

    if (char === '/') {
      tokens.push({ type: 'divide' });
      cursor += 1;
      continue;
    }

    if (char === '(') {
      tokens.push({ type: 'lparen' });
      cursor += 1;
      continue;
    }

    if (char === ')') {
      tokens.push({ type: 'rparen' });
      cursor += 1;
      continue;
    }

    if (char === ',') {
      tokens.push({ type: 'comma' });
      cursor += 1;
      continue;
    }

    throw new BadRequestException(
      'Expression contains unsupported characters.',
    );
  }

  tokens.push({ type: 'eof' });
  return tokens;
}

function assertExpressionSecurity(expression: string) {
  if (expression.length === 0) {
    throw new BadRequestException('Expression is required.');
  }

  if (expression.length > MAX_EXPRESSION_LENGTH) {
    throw new BadRequestException(
      'Expression exceeds the maximum allowed length.',
    );
  }

  const lowered = expression.toLowerCase();
  for (const fragment of DISALLOWED_FRAGMENTS) {
    if (lowered.includes(fragment)) {
      throw new BadRequestException('Expression contains a disallowed token.');
    }
  }
}

export function validateExpressionSyntax(expression: string) {
  assertExpressionSecurity(expression);
  const tokens = tokenizeExpression(expression);
  const parser = new ExpressionParser(tokens, {}, true);
  parser.parse();
}

export function evaluateNumericExpression(
  expression: string,
  variables: Record<string, number>,
) {
  assertExpressionSecurity(expression);
  const tokens = tokenizeExpression(expression);
  const parser = new ExpressionParser(tokens, variables, false);
  return parser.parse();
}

export function buildNumericPayloadContext(payload: Record<string, unknown>) {
  const context: Record<string, number> = {};
  for (const [key, value] of Object.entries(payload)) {
    if (!IDENTIFIER_PATTERN.test(key)) {
      continue;
    }

    if (typeof value === 'number' && Number.isFinite(value)) {
      context[key] = value;
    }
  }

  return context;
}
