"use server";

import { revalidatePath } from "next/cache";
import { authorizedFetch } from "../lib/api";

async function postExecutiveBrief(
  tenantSlug: string,
  useAgent: boolean
): Promise<{ status?: string; briefJobId?: string }> {
  const res = await authorizedFetch(`/v1/tenants/${tenantSlug}/reports/executive-brief`, {
    method: "POST",
    body: JSON.stringify({
      title: useAgent ? "Executive Brief (Agent)" : "Executive Brief",
      useAgent,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `Brief failed (${res.status})`);
  }

  const data = (await res.json()) as { status?: string; briefJobId?: string; reportId?: string };

  if (data.status !== "queued") {
    revalidatePath("/");
    revalidatePath("/reports");
  }

  return data;
}

export async function generateExecutiveBrief(tenantSlug: string): Promise<void> {
  const useAgent = process.env.LANDSCRAPE_DEFAULT_AGENT_BRIEF === "true";
  await postExecutiveBrief(tenantSlug, useAgent);
}

export async function generateExecutiveBriefDeep(
  tenantSlug: string
): Promise<{ status?: string; briefJobId?: string }> {
  return postExecutiveBrief(tenantSlug, true);
}
