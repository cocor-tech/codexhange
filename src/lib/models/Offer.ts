import mongoose, { Schema, Document } from 'mongoose';

export type OfferType =
  | 'promo_code' | 'coupon' | 'coupon_page' | 'referral_link' | 'referral_code'
  | 'automatic_discount' | 'cashback' | 'gift_card' | 'student_discount'
  | 'military_discount' | 'teacher_discount' | 'healthcare_discount'
  | 'nonprofit_discount' | 'government_discount' | 'employee_discount'
  | 'birthday_reward' | 'welcome_bonus' | 'signup_bonus' | 'first_order_discount'
  | 'bundle_discount' | 'seasonal_sale' | 'clearance_sale' | 'price_drop'
  | 'free_shipping' | 'reward_points' | 'store_credit' | 'bonus_credit'
  | 'trial_extension' | 'free_trial' | 'invite_reward' | 'loyalty_reward';

export type SourceReliability =
  | 'Official Site' | 'Official Blog' | 'Official Help Center' | 'Official Email'
  | 'Partner' | 'Affiliate' | 'Community' | 'Third Party';

export type OfferStatus =
  | 'discovered' | 'verified' | 'pending_review' | 'approved'
  | 'published' | 'expired' | 'archived';

export type VerifiedBy = 'bot' | 'admin';

export interface IOffer extends Document {
  serviceId: mongoose.Types.ObjectId;
  websiteId?: mongoose.Types.ObjectId;
  urlId?: mongoose.Types.ObjectId;
  store_name?: string;
  store_slug?: string;
  type: OfferType | OfferType[];
  title: string;
  code?: string;
  referralUrl?: string;
  discount: string;
  description?: string;
  terms?: string;
  sourceUrl: string;
  sourcePage?: string;
  sourceReliability: SourceReliability;
  countries: string[];
  confidence: number;
  status: OfferStatus;
  verifiedAt?: Date;
  verifiedBy: VerifiedBy;
  validUntil?: Date;
  clicks: number;
  upvotes: number;
  downvotes: number;
  createdAt: Date;
  updatedAt: Date;
}

const OfferSchema = new Schema<IOffer>(
  {
    serviceId: { type: Schema.Types.ObjectId, ref: 'Service', required: true, index: true },
    websiteId: { type: Schema.Types.ObjectId, ref: 'Website', index: true },
    urlId: { type: Schema.Types.ObjectId, ref: 'Url', index: true },
    store_name: { type: String, index: true },
    store_slug: { type: String, index: true },
    type: { type: Schema.Types.Mixed, required: true },
    title: { type: String, required: true },
    code: { type: String },
    referralUrl: { type: String },
    discount: { type: String, required: true },
    description: { type: String },
    terms: { type: String },
    sourceUrl: { type: String, required: true },
    sourcePage: { type: String },
    sourceReliability: {
      type: String,
      enum: ['Official Site', 'Official Blog', 'Official Help Center', 'Official Email', 'Partner', 'Affiliate', 'Community', 'Third Party'],
      default: 'Official Site',
    },
    countries: { type: [String], default: [] },
    confidence: { type: Number, default: 50, min: 0, max: 100 },
    status: {
      type: String,
      enum: ['discovered', 'verified', 'pending_review', 'approved', 'published', 'expired', 'archived'],
      default: 'discovered',
      index: true,
    },
    verifiedAt: { type: Date },
    verifiedBy: { type: String, enum: ['bot', 'admin'], default: 'bot' },
    validUntil: { type: Date },
    clicks: { type: Number, default: 0 },
    upvotes: { type: Number, default: 0 },
    downvotes: { type: Number, default: 0 },
  },
  { timestamps: true }
);

OfferSchema.index({ serviceId: 1, status: 1 });
OfferSchema.index({ status: 1, confidence: -1 });
OfferSchema.index({ validUntil: 1 });

export default mongoose.models.Offer || mongoose.model<IOffer>('Offer', OfferSchema);
