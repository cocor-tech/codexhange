import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongoose';
import Category from '@/lib/models/Category';

export const dynamic = 'force-dynamic';

export async function GET() {
  await connectDB();
  const categories = await Category.find({}).sort({ order: 1, name: 1 }).lean();
  return NextResponse.json({ categories });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  if (!body.name) return NextResponse.json({ error: 'Name required' }, { status: 400 });
  await connectDB();
  const category = await Category.create({
    ...body,
    slug: body.slug || body.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''),
  });
  return NextResponse.json({ category }, { status: 201 });
}

export async function PATCH(req: NextRequest) {
  const { categoryId, ...updates } = await req.json();
  if (!categoryId) return NextResponse.json({ error: 'categoryId required' }, { status: 400 });
  await connectDB();
  const category = await Category.findByIdAndUpdate(categoryId, updates, { new: true }).lean();
  return NextResponse.json({ category });
}

export async function DELETE(req: NextRequest) {
  const { categoryId } = await req.json();
  if (!categoryId) return NextResponse.json({ error: 'categoryId required' }, { status: 400 });
  await connectDB();
  await Category.findByIdAndDelete(categoryId);
  return NextResponse.json({ ok: true });
}
