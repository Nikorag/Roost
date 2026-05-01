import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { z } from "zod";
import { extractPurchaseOption } from "@/lib/ai";

const Body = z.object({ url: z.string().url() });

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return new NextResponse("Unauthorized", { status: 401 });
  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json(parsed.error.flatten(), { status: 400 });
  const result = await extractPurchaseOption(parsed.data.url);
  if (!result) {
    return NextResponse.json(
      { error: "Could not extract details from that URL." },
      { status: 422 },
    );
  }
  return NextResponse.json(result);
}
