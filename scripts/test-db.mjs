#!/usr/bin/env node
import 'dotenv/config';
import mongoose from 'mongoose';

const uri = process.env.MONGODB_URI;

if (!uri) {
  console.error('Error: MONGODB_URI is not set in your environment (.env).');
  process.exit(1);
}

async function main() {
  const started = Date.now();
  try {
    const conn = await mongoose.connect(uri, { bufferCommands: false });

    let pingResult = null;
    try {
      pingResult = await conn.connection.db?.admin().command({ ping: 1 });
    } catch (e) {
      pingResult = { error: e?.message };
    }

    const info = {
      ok: mongoose.connection.readyState === 1,
      readyState: mongoose.connection.readyState,
      host: mongoose.connection?.host ?? null,
      name: mongoose.connection?.name ?? null,
      db: mongoose.connection?.db?.databaseName ?? null,
      pingMs: Date.now() - started,
      pingResult,
      nodeEnv: process.env.NODE_ENV,
    };

    console.log(JSON.stringify(info, null, 2));
    await mongoose.disconnect();
    process.exit(info.ok ? 0 : 2);
  } catch (err) {
    console.error(JSON.stringify({ ok: false, error: err?.message || String(err) }, null, 2));
    try { await mongoose.disconnect(); } catch {}
    process.exit(2);
  }
}

main();
