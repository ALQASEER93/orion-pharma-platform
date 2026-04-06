"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { getApiBase } from "./api-base";

const operatorSessionStorageKey = "orion.operator-session.v1";

const defaultTenantId = "11111111-1111-4111-8111-111111111111";
const defaultBranchId = "22222222-2222-4222-8222-222222222222";
const defaultLegalEntityId = "33333333-3333-4333-8333-333333333333";
const defaultRegisterId = "44444444-4444-4444-8444-444444444444";
const defaultEmail = "admin@orion.local";
const defaultPassword = "Admin@123";

type LoginResponse = {
  access_token: string;
  user: OperatorUser;
};

type PosContextResponse = {
  tenantId: string;
  branches: OperatorBranch[];
  registers: OperatorRegister[];
  defaultBranchId: string | null;
  defaultRegisterId: string | null;
};

export type OperatorUser = {
  id: string;
  email: string;
  tenantId: string;
  branchId?: string | null;
  role: string;
  permissions: string[];
};

export type OperatorBranch = {
  id: string;
  name: string;
  legalEntityId: string | null;
};

export type OperatorRegister = {
  id: string;
  code: string;
  nameEn: string;
  nameAr: string;
  branchId: string;
  legalEntityId: string | null;
};

type StoredOperatorSession = {
  accessToken?: string;
  tenantId?: string;
  branchId?: string;
  registerId?: string;
  legalEntityId?: string | null;
  email?: string;
  user?: OperatorUser | null;
};

type ReadyOperatorSession = {
  status: "ready";
  error: null;
  apiBase: string;
  accessToken: string;
  tenantId: string;
  branchId: string;
  registerId: string | null;
  legalEntityId: string | null;
  email: string;
  user: OperatorUser | null;
  branches: OperatorBranch[];
  registers: OperatorRegister[];
  branchName: string;
  registerLabel: string;
};

type PendingOperatorSession = {
  status: "booting";
  error: null;
  apiBase: string;
  accessToken: string;
  tenantId: string;
  branchId: string;
  registerId: string | null;
  legalEntityId: string | null;
  email: string;
  user: OperatorUser | null;
  branches: OperatorBranch[];
  registers: OperatorRegister[];
  branchName: string;
  registerLabel: string;
};

type ErrorOperatorSession = {
  status: "error";
  error: string;
  apiBase: string;
  accessToken: string;
  tenantId: string;
  branchId: string;
  registerId: string | null;
  legalEntityId: string | null;
  email: string;
  user: OperatorUser | null;
  branches: OperatorBranch[];
  registers: OperatorRegister[];
  branchName: string;
  registerLabel: string;
};

export type OperatorSessionState =
  | ReadyOperatorSession
  | PendingOperatorSession
  | ErrorOperatorSession;

function readStoredOperatorSession(): StoredOperatorSession {
  if (typeof window === "undefined") {
    return {};
  }

  try {
    const raw = window.localStorage.getItem(operatorSessionStorageKey);
    if (!raw) {
      return {};
    }
    const parsed = JSON.parse(raw) as StoredOperatorSession;
    return typeof parsed === "object" && parsed ? parsed : {};
  } catch {
    return {};
  }
}

function writeStoredOperatorSession(value: StoredOperatorSession) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(
      operatorSessionStorageKey,
      JSON.stringify(value),
    );
  } catch {
    // Local operator context is best-effort only.
  }
}

function buildHeaders(
  accessToken: string,
  tenantId: string,
  init?: HeadersInit,
): Headers {
  const headers = new Headers(init ?? {});
  headers.set("Content-Type", "application/json");
  headers.set("Authorization", `Bearer ${accessToken}`);
  headers.set("x-tenant-id", tenantId);
  return headers;
}

function pickBranchId(
  stored: StoredOperatorSession,
  user: OperatorUser | null,
  context: PosContextResponse,
) {
  const candidateIds = [
    stored.branchId,
    user?.branchId ?? null,
    context.defaultBranchId,
    defaultBranchId,
    context.branches[0]?.id,
  ].filter((value): value is string => Boolean(value));

  for (const candidate of candidateIds) {
    if (context.branches.some((branch) => branch.id === candidate)) {
      return candidate;
    }
  }

  return defaultBranchId;
}

function pickRegisterId(
  stored: StoredOperatorSession,
  branchId: string,
  context: PosContextResponse,
  requireRegister: boolean,
) {
  const branchRegisters = context.registers.filter(
    (register) => register.branchId === branchId,
  );

  const candidateIds = [
    stored.registerId,
    branchRegisters.find((register) => register.id === context.defaultRegisterId)
      ?.id ?? null,
    branchRegisters[0]?.id,
    context.defaultRegisterId,
    defaultRegisterId,
    context.registers[0]?.id,
  ].filter((value): value is string => Boolean(value));

  for (const candidate of candidateIds) {
    if (context.registers.some((register) => register.id === candidate)) {
      return candidate;
    }
  }

  return requireRegister ? defaultRegisterId : null;
}

function toSessionState(
  apiBase: string,
  accessToken: string,
  email: string,
  user: OperatorUser | null,
  context: PosContextResponse,
  branchId: string,
  registerId: string | null,
  legalEntityId: string | null,
): ReadyOperatorSession {
  const branch = context.branches.find((item) => item.id === branchId) ?? null;
  const register =
    context.registers.find((item) => item.id === registerId) ?? null;

  return {
    status: "ready",
    error: null,
    apiBase,
    accessToken,
    tenantId: context.tenantId,
    branchId,
    registerId,
    legalEntityId,
    email,
    user,
    branches: context.branches,
    registers: context.registers,
    branchName: branch?.name ?? "Main Branch",
    registerLabel: register
      ? `${register.code} · ${register.nameEn}`
      : "No register selected",
  };
}

export function useOperatorSession(options?: { requireRegister?: boolean }) {
  const apiBase = useMemo(() => getApiBase(), []);
  const requireRegister = options?.requireRegister ?? false;

  const [session, setSession] = useState<OperatorSessionState>({
    status: "booting",
    error: null,
    apiBase,
    accessToken: "",
    tenantId: defaultTenantId,
    branchId: defaultBranchId,
    registerId: requireRegister ? defaultRegisterId : null,
    legalEntityId: defaultLegalEntityId,
    email: defaultEmail,
    user: null,
    branches: [],
    registers: [],
    branchName: "Main Branch",
    registerLabel: requireRegister ? "Cashier Counter 01" : "Not required",
  });

  const refreshSession = useCallback(async () => {
    const stored = readStoredOperatorSession();
    const tenantId = stored.tenantId ?? defaultTenantId;
    const email = stored.email ?? defaultEmail;

    setSession((current) => ({
      ...current,
      status: "booting",
      error: null,
      apiBase,
      tenantId,
      email,
    }));

    try {
      const loginResponse = await fetch(`${apiBase}/auth/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        cache: "no-store",
        body: JSON.stringify({
          email,
          password: defaultPassword,
          tenantId,
        }),
      });

      const loginPayload = (await loginResponse.json().catch(() => null)) as
        | LoginResponse
        | { message?: string }
        | null;

      if (
        !loginResponse.ok ||
        !loginPayload ||
        !("access_token" in loginPayload)
      ) {
        throw new Error(
          loginPayload && "message" in loginPayload && loginPayload.message
            ? loginPayload.message
            : "Unable to open the local operator session.",
        );
      }

      const contextResponse = await fetch(`${apiBase}/pos/operational/context`, {
        headers: buildHeaders(loginPayload.access_token, tenantId),
        cache: "no-store",
      });

      const contextPayload = (await contextResponse.json().catch(() => null)) as
        | PosContextResponse
        | { message?: string }
        | null;

      if (
        !contextResponse.ok ||
        !contextPayload ||
        !("branches" in contextPayload)
      ) {
        throw new Error(
          contextPayload &&
            "message" in contextPayload &&
            contextPayload.message
            ? contextPayload.message
            : "Unable to resolve branch and register context.",
        );
      }

      const branchId = pickBranchId(stored, loginPayload.user, contextPayload);
      const registerId = pickRegisterId(
        stored,
        branchId,
        contextPayload,
        requireRegister,
      );
      const branch =
        contextPayload.branches.find((item) => item.id === branchId) ?? null;
      const register =
        contextPayload.registers.find((item) => item.id === registerId) ?? null;
      const legalEntityId =
        register?.legalEntityId ??
        branch?.legalEntityId ??
        stored.legalEntityId ??
        defaultLegalEntityId;

      const nextState = toSessionState(
        apiBase,
        loginPayload.access_token,
        email,
        loginPayload.user,
        contextPayload,
        branchId,
        registerId,
        legalEntityId,
      );

      writeStoredOperatorSession({
        accessToken: loginPayload.access_token,
        tenantId: nextState.tenantId,
        branchId: nextState.branchId,
        registerId: nextState.registerId ?? undefined,
        legalEntityId: nextState.legalEntityId,
        email: nextState.email,
        user: nextState.user,
      });

      setSession(nextState);
    } catch (error) {
      setSession({
        status: "error",
        error:
          error instanceof Error
            ? error.message
            : "Unable to open the local operator session.",
        apiBase,
        accessToken: "",
        tenantId,
        branchId: stored.branchId ?? defaultBranchId,
        registerId: requireRegister ? stored.registerId ?? defaultRegisterId : null,
        legalEntityId: stored.legalEntityId ?? defaultLegalEntityId,
        email,
        user: stored.user ?? null,
        branches: [],
        registers: [],
        branchName: "Main Branch",
        registerLabel: requireRegister ? "Cashier Counter 01" : "Not required",
      });
    }
  }, [apiBase, requireRegister]);

  useEffect(() => {
    void refreshSession();
  }, [refreshSession]);

  const setActiveBranch = useCallback((branchId: string) => {
    setSession((current) => {
      if (current.status !== "ready") {
        return current;
      }

      const branch = current.branches.find((item) => item.id === branchId);
      if (!branch) {
        return current;
      }

      const branchRegisters = current.registers.filter(
        (item) => item.branchId === branchId,
      );
      const register =
        branchRegisters.find((item) => item.id === current.registerId) ??
        branchRegisters[0] ??
        null;

      const nextState: ReadyOperatorSession = {
        ...current,
        branchId,
        branchName: branch.name,
        registerId: register?.id ?? null,
        registerLabel: register
          ? `${register.code} · ${register.nameEn}`
          : "No register selected",
        legalEntityId:
          register?.legalEntityId ?? branch.legalEntityId ?? current.legalEntityId,
      };

      writeStoredOperatorSession({
        accessToken: nextState.accessToken,
        tenantId: nextState.tenantId,
        branchId: nextState.branchId,
        registerId: nextState.registerId ?? undefined,
        legalEntityId: nextState.legalEntityId,
        email: nextState.email,
        user: nextState.user,
      });

      return nextState;
    });
  }, []);

  const setActiveRegister = useCallback((registerId: string) => {
    setSession((current) => {
      if (current.status !== "ready") {
        return current;
      }

      const register = current.registers.find((item) => item.id === registerId);
      if (!register) {
        return current;
      }

      const branch =
        current.branches.find((item) => item.id === register.branchId) ?? null;

      const nextState: ReadyOperatorSession = {
        ...current,
        branchId: register.branchId,
        branchName: branch?.name ?? current.branchName,
        registerId: register.id,
        registerLabel: `${register.code} · ${register.nameEn}`,
        legalEntityId:
          register.legalEntityId ?? branch?.legalEntityId ?? current.legalEntityId,
      };

      writeStoredOperatorSession({
        accessToken: nextState.accessToken,
        tenantId: nextState.tenantId,
        branchId: nextState.branchId,
        registerId: nextState.registerId ?? undefined,
        legalEntityId: nextState.legalEntityId,
        email: nextState.email,
        user: nextState.user,
      });

      return nextState;
    });
  }, []);

  return {
    ...session,
    refreshSession,
    setActiveBranch,
    setActiveRegister,
  };
}

export function buildOperatorHeaders(
  session: Pick<ReadyOperatorSession, "accessToken" | "tenantId">,
  init?: HeadersInit,
) {
  return buildHeaders(session.accessToken, session.tenantId, init);
}
