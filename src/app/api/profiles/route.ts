import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';

const fields = (data: any) => ({
  businessName: String(data.businessName || '').trim(),
  address: data.address || null,
  phone: data.phone || null,
  email: data.email || null,
  website: data.website || null,
  npwp: data.npwp || null,
  bankInfo: data.bankInfo || null,
  logo: data.logo || null,
});
const invalidLogo = (logo: unknown) => logo != null && logo !== '' && (
  typeof logo !== 'string' || logo.length > 2_800_000 ||
  !/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+=*$/.test(logo)
);

export async function GET(request: Request) {
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: 'Silakan login.' }, { status: 401 });
  const profiles = await prisma.businessProfile.findMany({
    where: { userId: session.workspaceId },
    include: { _count: { select: { receipts: true } } },
    orderBy: [{ isDefault: 'desc' }, { businessName: 'asc' }],
  });
  return NextResponse.json(profiles);
}

export async function POST(req: Request) {
  try {
    const session = await getSession(req);
    if (!session) return NextResponse.json({ error: 'Silakan login.' }, { status: 401 });
    const data = await req.json();
    if (invalidLogo(data.logo)) return NextResponse.json({ error: 'Logo harus berupa PNG, JPEG, atau WebP dengan ukuran maksimal 2 MB.' }, { status: 400 });
    const profileData = fields(data);
    if (!profileData.businessName) return NextResponse.json({ error: 'Nama usaha wajib diisi.' }, { status: 400 });
    const existingCount = await prisma.businessProfile.count({ where: { userId: session.workspaceId } });
    const isDefault = Boolean(data.isDefault) || existingCount === 0;
    const profile = await prisma.$transaction(async (tx) => {
      if (isDefault) await tx.businessProfile.updateMany({ where: { userId: session.workspaceId }, data: { isDefault: false } });
      return tx.businessProfile.create({ data: { ...profileData, isDefault, userId: session.workspaceId } });
    });
    return NextResponse.json(profile);
  } catch (error) {
    return NextResponse.json({ error: 'Gagal membuat profil usaha.', detail: String(error) }, { status: 400 });
  }
}

export async function PUT(req: Request) {
  try {
    const session = await getSession(req);
    if (!session) return NextResponse.json({ error: 'Silakan login.' }, { status: 401 });
    const data = await req.json();
    if (!data.id) return NextResponse.json({ error: 'ID profil wajib diisi.' }, { status: 400 });
    if (invalidLogo(data.logo)) return NextResponse.json({ error: 'Logo harus berupa PNG, JPEG, atau WebP dengan ukuran maksimal 2 MB.' }, { status: 400 });
    const profileData = fields(data);
    if (!profileData.businessName) return NextResponse.json({ error: 'Nama usaha wajib diisi.' }, { status: 400 });
    const profile = await prisma.$transaction(async (tx) => {
      const current = await tx.businessProfile.findFirst({ where: { id: data.id, userId: session.workspaceId } });
      if (!current) return null;
      if (data.isDefault) await tx.businessProfile.updateMany({ where: { userId: session.workspaceId }, data: { isDefault: false } });
      return tx.businessProfile.update({
        where: { id: data.id, userId: session.workspaceId },
        data: { ...profileData, ...(data.isDefault ? { isDefault: true } : {}) },
      });
    });
    return profile ? NextResponse.json(profile) : NextResponse.json({ error: 'Profil tidak ditemukan.' }, { status: 404 });
  } catch (error) {
    return NextResponse.json({ error: 'Gagal memperbarui profil usaha.', detail: String(error) }, { status: 400 });
  }
}
