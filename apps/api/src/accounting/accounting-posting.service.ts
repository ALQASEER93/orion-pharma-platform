import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PostingRuleSetStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  buildNumericPayloadContext,
  evaluateNumericExpression,
} from './utils/posting-expression';
import { isEffectiveAt, matchesConditions } from './utils/posting-rules';

type SimulateInput = {
  tenantId: string;
  eventType: string;
  payload: Record<string, unknown>;
  effectiveAt: Date;
  branchId?: string;
};

@Injectable()
export class AccountingPostingService {
  constructor(private readonly prisma: PrismaService) {}

  async resolveRules(
    tenantId: string,
    eventType: string,
    effectiveAt: Date,
    payload: Record<string, unknown>,
  ) {
    const candidateRuleSets = await this.prisma.postingRuleSet.findMany({
      where: {
        tenantId,
        status: PostingRuleSetStatus.ACTIVE,
        effectiveFrom: { lte: effectiveAt },
        OR: [{ effectiveTo: null }, { effectiveTo: { gt: effectiveAt } }],
      },
      orderBy: [
        { effectiveFrom: 'desc' },
        { version: 'desc' },
        { createdAt: 'asc' },
      ],
    });

    if (candidateRuleSets.length === 0) {
      throw new NotFoundException(
        'No active posting rule set for the requested date.',
      );
    }

    const selectedRuleSet = candidateRuleSets.find((ruleSet) =>
      isEffectiveAt(effectiveAt, ruleSet.effectiveFrom, ruleSet.effectiveTo),
    );
    if (!selectedRuleSet) {
      throw new NotFoundException(
        'No active posting rule set for the requested date.',
      );
    }

    const rules = await this.prisma.postingRule.findMany({
      where: {
        tenantId,
        ruleSetId: selectedRuleSet.id,
        eventType,
        isActive: true,
      },
      orderBy: [{ priority: 'desc' }, { createdAt: 'asc' }, { id: 'asc' }],
    });

    const matchedRules = rules.filter((rule) =>
      matchesConditions(rule.conditionsJson, payload),
    );

    return { selectedRuleSet, matchedRules };
  }

  async simulate(input: SimulateInput) {
    const { selectedRuleSet, matchedRules } = await this.resolveRules(
      input.tenantId,
      input.eventType,
      input.effectiveAt,
      input.payload,
    );

    if (matchedRules.length === 0) {
      return {
        selectedRuleSet: this.toRuleSetView(selectedRuleSet),
        matchedRules: [],
        journalPreview: {
          date: input.effectiveAt.toISOString(),
          description: `SIMULATION ${input.eventType}`,
          lines: [],
        },
        totals: {
          debit: 0,
          credit: 0,
        },
        balanced: true,
      };
    }

    const referencedCodes = [
      ...new Set(
        matchedRules.flatMap((rule) => [
          rule.debitAccountCode,
          rule.creditAccountCode,
        ]),
      ),
    ];
    const accounts = await this.prisma.account.findMany({
      where: {
        tenantId: input.tenantId,
        isActive: true,
        code: {
          in: referencedCodes,
        },
      },
      select: {
        code: true,
      },
    });
    const accountCodes = new Set(accounts.map((account) => account.code));
    const missing = referencedCodes.filter((code) => !accountCodes.has(code));
    if (missing.length > 0) {
      throw new BadRequestException(
        `Posting rules reference unknown account codes: ${missing.join(', ')}`,
      );
    }

    const amountContext = buildNumericPayloadContext(input.payload);
    const lines: Array<{
      accountCode: string;
      debit: number;
      credit: number;
      memo: string | null;
      branchId?: string;
    }> = [];
    const matchedRulesView: Array<{
      id: string;
      eventType: string;
      priority: number;
      amountExpr: string;
      amount: number;
      debitAccountCode: string;
      creditAccountCode: string;
    }> = [];

    for (const rule of matchedRules) {
      const amount = this.toRoundedAmount(
        evaluateNumericExpression(rule.amountExpr, amountContext),
      );
      if (amount < 0) {
        throw new BadRequestException(
          `Rule ${rule.id} produced a negative amount.`,
        );
      }

      const memo = this.applyMemoTemplate(rule.memoTemplate, input.payload);
      lines.push({
        accountCode: rule.debitAccountCode,
        debit: amount,
        credit: 0,
        memo,
        ...(input.branchId ? { branchId: input.branchId } : {}),
      });
      lines.push({
        accountCode: rule.creditAccountCode,
        debit: 0,
        credit: amount,
        memo,
        ...(input.branchId ? { branchId: input.branchId } : {}),
      });

      matchedRulesView.push({
        id: rule.id,
        eventType: rule.eventType,
        priority: rule.priority,
        amountExpr: rule.amountExpr,
        amount,
        debitAccountCode: rule.debitAccountCode,
        creditAccountCode: rule.creditAccountCode,
      });
    }

    const debit = this.toRoundedAmount(
      lines.reduce((sum, line) => sum + line.debit, 0),
    );
    const credit = this.toRoundedAmount(
      lines.reduce((sum, line) => sum + line.credit, 0),
    );

    return {
      selectedRuleSet: this.toRuleSetView(selectedRuleSet),
      matchedRules: matchedRulesView,
      journalPreview: {
        date: input.effectiveAt.toISOString(),
        description: `SIMULATION ${input.eventType}`,
        lines,
      },
      totals: {
        debit,
        credit,
      },
      balanced: Math.abs(debit - credit) < 0.000001,
    };
  }

  private toRoundedAmount(value: number) {
    return Number(value.toFixed(2));
  }

  private toRuleSetView(ruleSet: {
    id: string;
    name: string;
    version: number;
    status: PostingRuleSetStatus;
    effectiveFrom: Date;
    effectiveTo: Date | null;
  }) {
    return {
      id: ruleSet.id,
      name: ruleSet.name,
      version: ruleSet.version,
      status: ruleSet.status,
      effectiveFrom: ruleSet.effectiveFrom.toISOString(),
      effectiveTo: ruleSet.effectiveTo?.toISOString() ?? null,
    };
  }

  private applyMemoTemplate(
    template: string | null,
    payload: Record<string, unknown>,
  ) {
    if (!template) {
      return null;
    }

    return template.replace(
      /\{\{\s*([A-Za-z_][A-Za-z0-9_]*)\s*\}\}/g,
      (_match, key: string) => {
        const value = payload[key];
        if (value === undefined || value === null) {
          return '';
        }

        if (typeof value === 'object') {
          return JSON.stringify(value as Record<string, unknown>);
        }

        if (
          typeof value === 'string' ||
          typeof value === 'number' ||
          typeof value === 'boolean'
        ) {
          return `${value}`;
        }

        return '';
      },
    );
  }
}
