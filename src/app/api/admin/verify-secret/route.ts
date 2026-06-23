import { NextRequest, NextResponse } from 'next/server';
import { auth, clerkClient } from '@clerk/nextjs/server';

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ success: false, error: 'Unauthorized. Please log in first.' }, { status: 401 });
    }

    const body = await request.json();
    const { secretKey } = body;

    const adminSecret = process.env.ADMIN_SECRET_KEY;
    if (!adminSecret) {
      return NextResponse.json({ success: false, error: 'Admin secret key is not configured on the server.' }, { status: 500 });
    }

    if (secretKey !== adminSecret) {
      return NextResponse.json({ success: false, error: 'Invalid admin secret key.' }, { status: 400 });
    }

    // Set Clerk public metadata role to admin
    const client = await clerkClient();
    await client.users.updateUserMetadata(userId, {
      publicMetadata: {
        role: 'admin',
      },
    });

    return NextResponse.json({ success: true, message: 'Admin status successfully granted!' });
  } catch (error) {
    console.error('Verify admin secret error:', error);
    const message = error instanceof Error ? error.message : 'An error occurred during verification';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
