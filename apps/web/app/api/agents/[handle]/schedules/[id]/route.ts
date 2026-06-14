import { NextResponse } from "next/server";
import { setScheduleEnabled, deleteSchedule } from "@agenomy/invoker";
import { getPool } from "../../../../../../lib/db";

export const dynamic = "force-dynamic";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ handle: string; id: string }> },
): Promise<Response> {
  const { handle, id } = await context.params;
  const body = (await request.json().catch(() => ({}))) as { enabled?: boolean };
  await setScheduleEnabled(getPool(), handle, id, Boolean(body.enabled));
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ handle: string; id: string }> },
): Promise<Response> {
  const { handle, id } = await context.params;
  await deleteSchedule(getPool(), handle, id);
  return NextResponse.json({ ok: true });
}
