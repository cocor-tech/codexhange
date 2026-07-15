import mongoose, { Schema, Document } from 'mongoose';

export interface IService extends Document {
  name: string;
  slug: string;
  brandId: mongoose.Types.ObjectId;
  description?: string;
  icon?: string;
  categoryId?: mongoose.Types.ObjectId;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const ServiceSchema = new Schema<IService>(
  {
    name: { type: String, required: true },
    slug: { type: String, required: true, lowercase: true },
    brandId: { type: Schema.Types.ObjectId, ref: 'Brand', required: true, index: true },
    description: { type: String },
    icon: { type: String },
    categoryId: { type: Schema.Types.ObjectId, ref: 'Category' },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

ServiceSchema.index({ brandId: 1, slug: 1 }, { unique: true });
ServiceSchema.index({ slug: 1 });

export default mongoose.models.Service || mongoose.model<IService>('Service', ServiceSchema);
