import { NextResponse } from "next/server";
import { listRuns } from "../../../../../lib/runs";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ handle: string }> },
): Promise<Response> {
  const { handle } = await context.params;
  const runs = await listRuns(handle);
  return NextResponse.json({ runs });
}
