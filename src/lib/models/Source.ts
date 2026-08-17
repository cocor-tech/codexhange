import mongoose, { Schema, Document } from 'mongoose';

export interface ISource extends Document {
  name: string;
  url: string;
  type: 'promo' | 'deal' | 'cashback';
  frequency_hours: number;
  status: 'active' | 'paused' | 'blocked';
  stats: {
    brands_found: number;
    offers_found: number;
    blocked_count: number;
    last_scan?: Date;
    last_error?: string;
  };
  createdAt: Date;
  updatedAt: Date;
}

const SourceSchema = new Schema<ISource>(
  {
    name: { type: String, required: true },
    url: { type: String, required: true, unique: true },
    type: { type: String, enum: ['promo', 'deal', 'cashback'], default: 'promo' },
    frequency_hours: { type: Number, default: 6 },
    status: { type: String, enum: ['active', 'paused', 'blocked'], default: 'active' },
    stats: {
      brands_found: { type: Number, default: 0 },
      offers_found: { type: Number, default: 0 },
      blocked_count: { type: Number, default: 0 },
      last_scan: { type: Date },
      last_error: { type: String },
    },
  },
  { timestamps: true }
);

SourceSchema.index({ status: 1 });
SourceSchema.index({ 'stats.last_scan': 1 });

export default mongoose.models.Source || mongoose.model<ISource>('Source', SourceSchema);