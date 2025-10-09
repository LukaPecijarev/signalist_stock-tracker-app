import { NextRequest } from "next/server";
import mongoose from "mongoose";
import { connectToDatabase } from "@/database/mongoose";

export const runtime = "nodejs";

export async function GET(_req: NextRequest) {
  try {
    const conn = await connectToDatabase();

    // Attempt a ping to verify the connection is actually working
    const start = Date.now();
    let pingResult: unknown = null;
    try {
      // Using the native driver underneath mongoose
      pingResult = await conn.connection.db?.admin().command({ ping: 1 });
    } catch (e) {
      // If ping fails, we still want to report the error below
      pingResult = { error: (e as Error)?.message };
    }

    const info = {
      ok: mongoose.connection.readyState === 1,
      readyState: mongoose.connection.readyState, // 0 = disconnected, 1 = connected, 2 = connecting, 3 = disconnecting
      host: (mongoose.connection as any).host ?? null,
      name: mongoose.connection.name ?? null,
      user: (mongoose.connection as any).user ?? null,
      db: mongoose.connection.db?.databaseName ?? null,
      pingMs: Date.now() - start,
      pingResult,
      nodeEnv: process.env.NODE_ENV,
    };

    const status = info.ok ? 200 : 500;
    return new Response(JSON.stringify(info, null, 2), {
      status,
      headers: { "content-type": "application/json; charset=utf-8" },
    });
  } catch (error) {
    const message = (error as Error)?.message || "Unknown error";
    return new Response(
      JSON.stringify({ ok: false, error: message, nodeEnv: process.env.NODE_ENV }),
      { status: 500, headers: { "content-type": "application/json; charset=utf-8" } }
    );
  }
}
