import { auth, clerkClient } from '@clerk/nextjs/server';

export async function checkIsAdmin() {
  try {
    const { userId } = await auth();
    if (!userId) return false;

    const client = await clerkClient();
    const user = await client.users.getUser(userId);
    return user.publicMetadata?.role === 'admin';
  } catch (err) {
    console.error('Error checking admin status:', err);
    return false;
  }
}
