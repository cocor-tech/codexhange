import mongoose, { Schema, Document } from 'mongoose';

export interface IUrl extends Document {
  websiteId: mongoose.Types.ObjectId;
  url: string;
  domain: string;
  kind: 'homepage' | 'source_page' | 'coupon_page' | 'redirect';
  source?: string;
  status: 'active' | 'paused' | 'blocked';
  stats: {
    offers_found: number;
    blocked_count: number;
    last_scan?: Date;
    last_error?: string;
    health_score: number;
  };
  fingerprint?: {
    etag?: string;
    last_modified?: string;
    content_hash?: string;
    last_fetch?: Date;
  };
  createdAt: Date;
  updatedAt: Date;
}

const UrlSchema = new Schema<IUrl>(
  {
    websiteId: { type: Schema.Types.ObjectId, ref: 'Website', required: true, index: true },
    url: { type: String, required: true, unique: true },
    domain: { type: String, required: true },
    kind: { type: String, enum: ['homepage', 'source_page', 'coupon_page', 'redirect'], default: 'source_page' },
    source: { type: String },
    status: { type: String, enum: ['active', 'paused', 'blocked'], default: 'active' },
    stats: {
      offers_found: { type: Number, default: 0 },
      blocked_count: { type: Number, default: 0 },
      last_scan: { type: Date },
      last_error: { type: String },
      health_score: { type: Number, default: 100, min: 0, max: 100 },
    },
    fingerprint: {
      etag: { type: String },
      last_modified: { type: String },
      content_hash: { type: String },
      last_fetch: { type: Date },
    },
  },
  { timestamps: true }
);

UrlSchema.index({ websiteId: 1, status: 1 });
UrlSchema.index({ domain: 1 });

export default mongoose.models.Url || mongoose.model<IUrl>('Url', UrlSchema);