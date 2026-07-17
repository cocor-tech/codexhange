import mongoose, { Schema, Document } from 'mongoose';

export interface IScanJob extends Document {
  websiteId: mongoose.Types.ObjectId;
  url: string;
  source_type: string;
  status: 'queued' | 'running' | 'completed' | 'failed' | 'blocked';
  priority: number;
  attempts: number;
  max_attempts: number;
  next_run?: Date;
  error?: string;
  offers_found: number;
  started_at?: Date;
  finished_at?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const ScanJobSchema = new Schema<IScanJob>(
  {
    websiteId: { type: Schema.Types.ObjectId, ref: 'Website', required: true },
    url: { type: String, required: true },
    source_type: { type: String, default: 'url_patterns' },
    status: {
      type: String,
      enum: ['queued', 'running', 'completed', 'failed', 'blocked'],
      default: 'queued',
    },
    priority: { type: Number, default: 0, min: 0, max: 10 },
    attempts: { type: Number, default: 0 },
    max_attempts: { type: Number, default: 3 },
    next_run: { type: Date },
    error: { type: String },
    offers_found: { type: Number, default: 0 },
    started_at: { type: Date },
    finished_at: { type: Date },
  },
  { timestamps: true }
);

ScanJobSchema.index({ status: 1, priority: -1, createdAt: 1 });
ScanJobSchema.index({ websiteId: 1 });

export default mongoose.models.ScanJob || mongoose.model<IScanJob>('ScanJob', ScanJobSchema);
