import mongoose, { Schema, Document } from 'mongoose';

export interface IFuelLedger extends Document {
  userId: mongoose.Types.ObjectId;
  amount: number;
  type: 'earned' | 'spent';
  reason: 'referral' | 'vote' | 'submission' | 'boost' | 'bonus';
  reference?: string;
  createdAt: Date;
}

const FuelLedgerSchema = new Schema<IFuelLedger>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    amount: { type: Number, required: true },
    type: { type: String, enum: ['earned', 'spent'], required: true },
    reason: {
      type: String,
      enum: ['referral', 'vote', 'submission', 'boost', 'bonus'],
      required: true,
    },
    reference: { type: String },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

FuelLedgerSchema.index({ userId: 1, createdAt: -1 });

export default mongoose.models.FuelLedger || mongoose.model<IFuelLedger>('FuelLedger', FuelLedgerSchema);
