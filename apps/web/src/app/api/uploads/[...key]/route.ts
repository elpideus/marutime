import { getStorage, LocalStorage } from '@marutime/storage';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const TYPES: Record<string, string> = {
  '.webp': 'image/webp',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.avif': 'image/avif',
};

/** Serves public uploads for STORAGE_PROVIDER=local (Docker / self-hosted). */
export async function GET(_request: Request, ctx: { params: Promise<{ key: string[] }> }) {
  const storage = getStorage();
  if (!(storage instanceof LocalStorage)) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const { key } = await ctx.params;
  let file: string | null;
  try {
    file = await storage.publicPath(key.join('/'));
  } catch {
    file = null;
  }
  if (!file) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const type = TYPES[path.extname(file).toLowerCase()];
  if (!type) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return new NextResponse(new Uint8Array(await readFile(file)), {
    headers: {
      'Content-Type': type,
      'Cache-Control': 'public, max-age=31536000, immutable',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
