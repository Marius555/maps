import "server-only";

import type { NextResponse } from "next/server";

import { NewsSlugTakenError } from "@/lib/repositories/news.repository";
import { fail } from "./responses";

/**
 * Run a news write, answering a taken slug under the Slug field rather than as a
 * toast — the one repository error the editor can point at a field for.
 */
export async function answeringSlugClash(write: () => Promise<NextResponse>): Promise<NextResponse> {
  try {
    return await write();
  } catch (error) {
    if (error instanceof NewsSlugTakenError) {
      return fail("conflict", error.message, 409, { slug: [error.message] });
    }
    throw error;
  }
}
