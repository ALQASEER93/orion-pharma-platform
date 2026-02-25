import { BadRequestException } from '@nestjs/common';
import {
  evaluateNumericExpression,
  validateExpressionSyntax,
} from './utils/posting-expression';

describe('posting-expression', () => {
  it('evaluates numeric expressions with allowed functions', () => {
    const result = evaluateNumericExpression(
      'round(max(total - discountTotal, 0) * 1.15, 2)',
      {
        total: 100,
        discountTotal: 10,
      },
    );

    expect(result).toBe(103.5);
  });

  it('rejects unknown identifiers in runtime evaluation', () => {
    expect(() =>
      evaluateNumericExpression('total + secretToken', { total: 10 }),
    ).toThrow(BadRequestException);
  });

  it('rejects disallowed tokens in expressions', () => {
    expect(() => validateExpressionSyntax('__proto__ + 1')).toThrow(
      BadRequestException,
    );
  });

  it('rejects unsupported characters', () => {
    expect(() => validateExpressionSyntax('total + payload["x"]')).toThrow(
      BadRequestException,
    );
  });
});
