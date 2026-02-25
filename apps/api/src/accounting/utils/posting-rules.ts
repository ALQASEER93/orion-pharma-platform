import { Prisma } from '@prisma/client';

type Primitive = string | number | boolean | null;

type RuleConditionValue =
  | Primitive
  | Primitive[]
  | {
      eq?: Primitive;
      in?: Primitive[];
      gte?: number;
      lte?: number;
    };

const CONDITION_KEYS = new Set(['eq', 'in', 'gte', 'lte']);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function primitiveEquals(left: unknown, right: Primitive) {
  return left === right;
}

function asNumber(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function matchesConditionValue(actual: unknown, expected: RuleConditionValue) {
  if (Array.isArray(expected)) {
    return expected.some((entry) => primitiveEquals(actual, entry));
  }

  if (isRecord(expected)) {
    const keys = Object.keys(expected);
    if (keys.some((key) => !CONDITION_KEYS.has(key))) {
      return false;
    }

    if (
      'eq' in expected &&
      !primitiveEquals(actual, expected.eq as Primitive)
    ) {
      return false;
    }

    if (
      'in' in expected &&
      Array.isArray(expected.in) &&
      !expected.in.some((entry) => primitiveEquals(actual, entry))
    ) {
      return false;
    }

    const actualNumber = asNumber(actual);
    if ('gte' in expected) {
      if (actualNumber === null || actualNumber < Number(expected.gte)) {
        return false;
      }
    }

    if ('lte' in expected) {
      if (actualNumber === null || actualNumber > Number(expected.lte)) {
        return false;
      }
    }

    return true;
  }

  return primitiveEquals(actual, expected);
}

export function matchesConditions(
  conditionsJson: Prisma.JsonValue | null,
  payload: Record<string, unknown>,
) {
  if (conditionsJson === null) {
    return true;
  }

  if (!isRecord(conditionsJson)) {
    return false;
  }

  for (const [field, expected] of Object.entries(conditionsJson)) {
    if (
      !matchesConditionValue(payload[field], expected as RuleConditionValue)
    ) {
      return false;
    }
  }

  return true;
}

export function rangesOverlap(
  startA: Date,
  endA: Date | null,
  startB: Date,
  endB: Date | null,
) {
  const aEnd = endA ?? new Date('9999-12-31T23:59:59.999Z');
  const bEnd = endB ?? new Date('9999-12-31T23:59:59.999Z');
  return startA < bEnd && startB < aEnd;
}

export function isEffectiveAt(
  effectiveAt: Date,
  effectiveFrom: Date,
  effectiveTo: Date | null,
) {
  if (effectiveFrom > effectiveAt) {
    return false;
  }

  if (effectiveTo !== null && effectiveAt >= effectiveTo) {
    return false;
  }

  return true;
}
