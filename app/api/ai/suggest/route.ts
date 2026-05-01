import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db, schema } from "@/lib/db";
import { z } from "zod";
import { suggestForProject } from "@/lib/ai";

const Body = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
});

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return new NextResponse("Unauthorized", { status: 401 });
  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json(parsed.error.flatten(), { status: 400 });

  const [contractors, personnelRows, toolsRows] = await Promise.all([
    db.select({ name: schema.contractors.name, trade: schema.contractors.trade }).from(schema.contractors),
    db
      .select({ name: schema.personnel.name, relation: schema.personnel.relation })
      .from(schema.personnel),
    db.select({ name: schema.tools.name }).from(schema.tools),
  ]);

  const suggestions = await suggestForProject({
    title: parsed.data.title,
    description: parsed.data.description,
    knownContractors: contractors,
    knownPersonnel: personnelRows,
    knownTools: toolsRows,
  });
  return NextResponse.json(suggestions);
}
