'use server';

import { connectToDatabase } from '@/database/mongoose';
import { Watchlist } from '@/database/models/watchlist.model';

export async function getWatchlistSymbolsByEmail(email: string): Promise<string[]> {
  try {
    if (!email) return [];

    const mongoose = await connectToDatabase();
    const db = mongoose.connection.db;
    if (!db) return [];

    // Better Auth stores users in the `user` collection
    const user = await db.collection('user').findOne<{ _id?: unknown; id?: string; email?: string }>({ email });
    if (!user) return [];

    const userId = (user.id as string) || (user._id ? String(user._id) : '');
    if (!userId) return [];

    const items = await Watchlist.find({ userId }).select('symbol').lean();
    if (!items?.length) return [];

      return items
          .map((i: unknown) => (i && typeof i === 'object' && 'symbol' in i && typeof i.symbol === 'string' ? i.symbol : ''))
          .filter((s): s is string => !!s);
  } catch (err) {
    console.error('Error in getWatchlistSymbolsByEmail:', err);
    return [];
  }
}
