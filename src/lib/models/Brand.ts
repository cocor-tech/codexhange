import mongoose, { Schema, Document } from 'mongoose';

export interface IBrand extends Document {
  name: string;
  slug: string;
  website: string;
  categories: mongoose.Types.ObjectId[];
  hasPromoCodes: boolean;
  hasReferralProgram: boolean;
  country: string;
  discounts: {
    firstYear: boolean;
    transfer: boolean;
    renewal: boolean;
    bundle: boolean;
    sslBundle: boolean;
    emailHosting: boolean;
    student: boolean;
    blackFriday: boolean;
    cyberMonday: boolean;
    newYear: boolean;
    anniversary: boolean;
    flashSale: boolean;
  };
  extensions: string[];
  referralLink?: string;
  notes?: string;
  active: boolean;
  discovery: {
    enabled: boolean;
    crawlDelay: number;
    crawlDepth: number;
    allowGoogleSearch: boolean;
    allowSitemap: boolean;
    allowReferral: boolean;
  };
  lastChecked?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const BrandSchema = new Schema<IBrand>(
  {
    name: { type: String, required: true },
    slug: { type: String, required: true, lowercase: true },
    website: { type: String, required: true },
    categories: [{ type: Schema.Types.ObjectId, ref: 'Category' }],
    hasPromoCodes: { type: Boolean, default: true },
    hasReferralProgram: { type: Boolean, default: false },
    country: { type: String, default: 'US' },
    discounts: {
      firstYear: { type: Boolean, default: false },
      transfer: { type: Boolean, default: false },
      renewal: { type: Boolean, default: false },
      bundle: { type: Boolean, default: false },
      sslBundle: { type: Boolean, default: false },
      emailHosting: { type: Boolean, default: false },
      student: { type: Boolean, default: false },
      blackFriday: { type: Boolean, default: false },
      cyberMonday: { type: Boolean, default: false },
      newYear: { type: Boolean, default: false },
      anniversary: { type: Boolean, default: false },
      flashSale: { type: Boolean, default: false },
    },
    extensions: { type: [String], default: [] },
    referralLink: { type: String },
    notes: { type: String },
    active: { type: Boolean, default: true },
    discovery: {
      enabled: { type: Boolean, default: true },
      crawlDelay: { type: Number, default: 3000 },
      crawlDepth: { type: Number, default: 2 },
      allowGoogleSearch: { type: Boolean, default: false },
      allowSitemap: { type: Boolean, default: true },
      allowReferral: { type: Boolean, default: true },
    },
    lastChecked: { type: Date },
  },
  { timestamps: true }
);

BrandSchema.index({ slug: 1 });
BrandSchema.index({ categories: 1 });

export default mongoose.models.Brand || mongoose.model<IBrand>('Brand', BrandSchema);
