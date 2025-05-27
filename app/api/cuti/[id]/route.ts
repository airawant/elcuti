import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { id } = params;

    // Ambil data leave request berdasarkan ID
    if (!supabaseAdmin) {
      throw new Error("Supabase admin client not initialized");
    }

    const { data, error } = await supabaseAdmin
      .from("leave_requests")
      .select("link_file")
      .eq("id", id)
      .single();

    if (error || !data) {
      console.error("Error fetching leave request or no data found:", error);
      return NextResponse.json({ error: "Leave request not found" }, { status: 404 });
    }

    const { link_file } = data;

    if (!link_file) {
      console.error("Link file not found for leave request ID:", id);
      return NextResponse.json({ error: "Link file not found" }, { status: 404 });
    }

    // Redirect to the link file
    return NextResponse.redirect(link_file);
  } catch (error) {
    console.error("Error processing request:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
