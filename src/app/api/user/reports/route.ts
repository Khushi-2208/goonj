import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getOrCreateDbUser } from '@/lib/auth';

export async function GET() {
  try {
    const dbUser = await getOrCreateDbUser();
    const userId = dbUser?.id;

    if (!userId) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const reports = await prisma.downloadedReport.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' }
    });

    return NextResponse.json({ success: true, reports });
  } catch (error) {
    console.error('Fetch reports error:', error);
    const message = error instanceof Error ? error.message : 'Failed to fetch reports list';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const dbUser = await getOrCreateDbUser();
    const userId = dbUser?.id;

    if (!userId) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { schemeTitle, language } = await request.json();
    if (!schemeTitle || !language) {
      return NextResponse.json({ success: false, error: 'Scheme Title and Language are required' }, { status: 400 });
    }

    const report = await prisma.downloadedReport.create({
      data: {
        userId,
        schemeTitle,
        language
      }
    });

    return NextResponse.json({ success: true, report });
  } catch (error) {
    console.error('Report log error:', error);
    const message = error instanceof Error ? error.message : 'Failed to log downloaded report';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
