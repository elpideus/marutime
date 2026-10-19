'use client';

import { Avatar, Button, useToast } from '@marutime/ui';
import { Camera, Trash } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useRef, useState, useTransition } from 'react';
import { removeImageAction } from '@/actions/profile';
import { downscaleImage } from '@/lib/client-image';

export function ImageUploader({ kind, current, name }: { kind: 'avatar' | 'cover'; current: string | null; name: string }) {
  const [url, setUrl] = useState(current);
  const [busy, setBusy] = useState(false);
  const [, start] = useTransition();
  const ref = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const { toast } = useToast();

  const upload = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    try {
      const blob = await downscaleImage(file, kind === 'avatar' ? 1024 : 2000);
      const fd = new FormData();
      fd.append('file', blob, file.name);
      const res = await fetch(`/api/upload/${kind}`, { method: 'POST', body: fd });
      const data = (await res.json()) as { url?: string; error?: string };
      if (!res.ok || !data.url) throw new Error(data.error ?? 'Upload failed');
      setUrl(data.url);
      toast({ tone: 'success', title: kind === 'avatar' ? 'Profile picture updated' : 'Cover updated' });
      router.refresh();
    } catch (err) {
      toast({ tone: 'error', title: (err as Error).message });
    } finally {
      setBusy(false);
      if (ref.current) ref.current.value = '';
    }
  };

  const remove = () => {
    setUrl(null);
    start(async () => {
      const r = await removeImageAction(kind);
      if (!r.ok) toast({ tone: 'error', title: r.error });
      router.refresh();
    });
  };

  return (
    <div className={kind === 'cover' ? 'relative h-40 w-full overflow-hidden rounded-card bg-surface-3 sm:h-48' : 'flex items-center gap-4'}>
      {kind === 'cover' ? (
        <>
          {url ? <img src={url} alt="" className="size-full object-cover" /> : <div className="size-full bg-gradient-to-br from-accent/30 via-surface-3 to-surface" />}
          <div className="absolute right-3 bottom-3 flex gap-2">
            <Button size="sm" variant="secondary" onClick={() => ref.current?.click()} loading={busy}>
              <Camera className="size-4" /> {url ? 'Change cover' : 'Add cover'}
            </Button>
            {url ? (
              <Button size="icon-sm" variant="secondary" onClick={remove} aria-label="Remove cover">
                <Trash className="size-4" />
              </Button>
            ) : null}
          </div>
        </>
      ) : (
        <>
          <Avatar src={url} name={name} size="xl" />
          <div className="flex flex-col gap-2">
            <Button size="sm" variant="secondary" onClick={() => ref.current?.click()} loading={busy}>
              <Camera className="size-4" /> {url ? 'Change picture' : 'Upload picture'}
            </Button>
            {url ? (
              <Button size="sm" variant="ghost" onClick={remove}>
                <Trash className="size-4" /> Remove
              </Button>
            ) : null}
            <p className="text-xs text-fg-subtle">Square works best. Up to 4 MB.</p>
          </div>
        </>
      )}
      <input ref={ref} type="file" accept="image/*" hidden onChange={(e) => upload(e.target.files?.[0])} />
    </div>
  );
}
