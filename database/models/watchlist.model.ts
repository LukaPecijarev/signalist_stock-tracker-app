import mongoose, { Document, Schema, models, model } from 'mongoose';

export interface WatchlistItem extends Document {
  userId: string;
  symbol: string;
  company: string;
  addedAt: Date;
}

const WatchlistSchema = new Schema<WatchlistItem>(
  {
    userId: {
      type: String,
      required: true,
      index: true,
      trim: true,
    },
    symbol: {
      type: String,
      required: true,
      uppercase: true,
      trim: true,
    },
    company: {
      type: String,
      required: true,
      trim: true,
    },
    addedAt: {
      type: Date,
      default: () => new Date(),
    },
  },
  { timestamps: false }
);

// Prevent duplicate symbol per user
WatchlistSchema.index({ userId: 1, symbol: 1 }, { unique: true });

export const Watchlist = (models?.Watchlist as mongoose.Model<WatchlistItem>) ||
  model<WatchlistItem>('Watchlist', WatchlistSchema);
