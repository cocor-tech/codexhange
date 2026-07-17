import mongoose, { Schema, Document } from 'mongoose';

export interface IWebsite extends Document {
  url: string;
  domain: string;
  brand: {
    name: string;
    slug: string;
    logo?: string;
    category?: string;
  };
  status: 'active' | 'paused' | 'blocked';
  settings: {
    scan_frequency: number;
    crawl_depth: number;
    javascript: boolean;
    auto_publish: boolean;
    ai_enabled: boolean;
  };
  stats: {
    offers_found: number;
    offers_published: number;
    blocked_count: number;
    success_rate: number;
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
  createdBy?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const WebsiteSchema = new Schema<IWebsite>(
  {
    url: { type: String, required: true, unique: true },
    domain: { type: String, required: true },
    brand: {
      name: { type: String, required: true },
      slug: { type: String, required: true },
      logo: { type: String },
      category: { type: String },
    },
    status: {
      type: String,
      enum: ['active', 'paused', 'blocked'],
      default: 'active',
    },
    settings: {
      scan_frequency: { type: Number, default: 12 },
      crawl_depth: { type: Number, default: 2 },
      javascript: { type: Boolean, default: false },
      auto_publish: { type: Boolean, default: false },
      ai_enabled: { type: Boolean, default: false },
    },
    stats: {
      offers_found: { type: Number, default: 0 },
      offers_published: { type: Number, default: 0 },
      blocked_count: { type: Number, default: 0 },
      success_rate: { type: Number, default: 0 },
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
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

WebsiteSchema.index({ domain: 1 });
WebsiteSchema.index({ 'brand.slug': 1 });
WebsiteSchema.index({ status: 1 });

export default mongoose.models.Website || mongoose.model<IWebsite>('Website', WebsiteSchema);
