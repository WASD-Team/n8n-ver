import { NextResponse } from "next/server";
import { listWorkflowGroups, saveWorkflowGroups, type WorkflowFolderMap } from "@/lib/workflowGroupsStore";

export async function GET() {
  try {
    const folders = await listWorkflowGroups();
    return NextResponse.json({ ok: true, folders });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    );
  }
}

export async function PUT(request: Request) {
  try {
    const body = (await request.json()) as { folders?: WorkflowFolderMap };
    const folders = body.folders ?? {};
    await saveWorkflowGroups(folders);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    );
  }
}
