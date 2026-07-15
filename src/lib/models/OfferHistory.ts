import mongoose, { Schema, Document } from 'mongoose';

export interface IOfferHistory extends Document {
  offerId: mongoose.Types.ObjectId;
  changedFields: Record<string, { from: any; to: any }>;
  previousStatus: string;
  newStatus: string;
  changedBy: 'bot' | 'admin';
  notes?: string;
  timestamp: Date;
}

const OfferHistorySchema = new Schema<IOfferHistory>(
  {
    offerId: { type: Schema.Types.ObjectId, ref: 'Offer', required: true, index: true },
    changedFields: { type: Schema.Types.Mixed, default: {} },
    previousStatus: { type: String, required: true },
    newStatus: { type: String, required: true },
    changedBy: { type: String, enum: ['bot', 'admin'], default: 'bot' },
    notes: { type: String },
    timestamp: { type: Date, default: Date.now },
  },
  { timestamps: false }
);

OfferHistorySchema.index({ offerId: 1, timestamp: -1 });

export default mongoose.models.OfferHistory || mongoose.model<IOfferHistory>('OfferHistory', OfferHistorySchema);
