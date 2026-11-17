import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

/** Gera um link temporário (60 s) para baixar o arquivo, só para quem tem acesso pelo RLS. */
export async function GET(request: NextRequest, ctx: RouteContext<"/materiais/[id]/download">) {
  const { id } = await ctx.params;
  const supabase = await createClient();

  const { data: material } = await supabase
    .from("materials")
    .select("file_path, file_name")
    .eq("id", id)
    .maybeSingle();
  if (!material) return NextResponse.redirect(new URL("/materiais", request.url));

  const { data } = await supabase.storage
    .from("materials")
    .createSignedUrl(material.file_path, 60, { download: material.file_name });
  if (!data?.signedUrl) return NextResponse.redirect(new URL("/materiais", request.url));

  return NextResponse.redirect(data.signedUrl);
}
