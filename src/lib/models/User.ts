import mongoose, { Schema, Document } from 'mongoose';

export interface IUser extends Document {
  name?: string;
  email: string;
  emailVerified?: Date;
  image?: string;
  isAdmin: boolean;
  passwordHash?: string;
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUser>(
  {
    name: { type: String },
    email: { type: String, required: true, unique: true },
    emailVerified: { type: Date },
    image: { type: String },
    isAdmin: { type: Boolean, default: false },
    passwordHash: { type: String, select: false },
  },
  { timestamps: true }
);

export default mongoose.models.User || mongoose.model<IUser>('User', UserSchema);
