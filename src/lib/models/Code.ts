import mongoose, { Schema, Document } from 'mongoose';

export interface ICode extends Document {
  code: string;
  brand: string;
  brandSlug: string;
  description: string;
  discount: string;
  restrictions?: string;
  expiresAt?: Date;
  link?: string;
  scope: 'global' | 'local';
  country?: string;
  submittedBy: mongoose.Types.ObjectId;
  upvotes: number;
  downvotes: number;
  clicks: number;
  boosted: boolean;
  boostedUntil?: Date;
  boostClicksUsed: number;
  boostClicksLimit: number;
  archived: boolean;
  archivedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const CodeSchema = new Schema<ICode>(
  {
    code: { type: String, required: true },
    brand: { type: String, required: true, index: true },
    brandSlug: { type: String, required: true, index: true },
    description: { type: String, required: true },
    discount: { type: String, required: true },
    restrictions: { type: String },
    expiresAt: { type: Date },
    link: { type: String },
    scope: { type: String, enum: ['global', 'local'], default: 'global' },
    country: { type: String },
    submittedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    upvotes: { type: Number, default: 0 },
    downvotes: { type: Number, default: 0 },
    clicks: { type: Number, default: 0 },
    boosted: { type: Boolean, default: false },
    boostedUntil: { type: Date },
    boostClicksUsed: { type: Number, default: 0 },
    boostClicksLimit: { type: Number, default: 0 },
    archived: { type: Boolean, default: false },
    archivedAt: { type: Date },
  },
  { timestamps: true }
);

CodeSchema.index({ brandSlug: 1, scope: 1, country: 1 });
CodeSchema.index({ brandSlug: 1, archived: 1, boosted: 1 });

export default mongoose.models.Code || mongoose.model<ICode>('Code', CodeSchema);
