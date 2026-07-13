import mongoose, { Schema, Document } from 'mongoose';

export interface IUser extends Document {
  name?: string;
  email: string;
  emailVerified?: Date;
  image?: string;
  fuelBalance: number;
  fingerprintHashes: string[];
  isAdmin: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUser>(
  {
    name: { type: String },
    email: { type: String, required: true, unique: true },
    emailVerified: { type: Date },
    image: { type: String },
    fuelBalance: { type: Number, default: 0 },
    fingerprintHashes: { type: [String], default: [] },
    isAdmin: { type: Boolean, default: false },
  },
  { timestamps: true }
);

UserSchema.index({ fingerprintHashes: 1 });

export default mongoose.models.User || mongoose.model<IUser>('User', UserSchema);
