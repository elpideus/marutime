'use client';

import type { CommentTarget, CommentView } from '@marutime/core';
import type { CommentImage, PublicUser } from '@marutime/db';
import { Avatar, Button, Island, Menu, MenuContent, MenuItem, MenuTrigger, Segmented, Switch, Textarea, cn, fadeUp, springs, useToast } from '@marutime/ui';
import { Ellipsis, Eye, EyeOff, Flag, Heart, ImagePlus, MessageCircle, Reply, Send, Trash, X } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useRef, useState, useTransition } from 'react';
import { createCommentAction, deleteCommentAction, hideCommentAction, reportContentAction, toggleCommentLikeAction } from '@/actions/comments';
import { formatRelative } from '@/lib/format';
import { downscaleImage } from '@/lib/client-image';

export type CommentFeedProps = {
  target: CommentTarget;
  initial: CommentView[];
  total: number;
  viewer: PublicUser | null;
  viewerIsStaff?: boolean;
  hideSpoilersByDefault?: boolean;
  /** Replies loaded per root, keyed by root id. */
  initialReplies?: Record<string, CommentView[]>;
};

export function CommentFeed({ target, initial, total, viewer, viewerIsStaff = false, hideSpoilersByDefault = true, initialReplies = {} }: CommentFeedProps) {
  const [items, setItems] = useState(initial);
  const [sort, setSort] = useState<'new' | 'top'>('new');
  const sorted = sort === 'top' ? [...items].sort((a, b) => b.likeCount - a.likeCount || +b.createdAt - +a.createdAt) : items;
  return (
    <Island>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-lg font-semibold tracking-tight text-fg">
          <MessageCircle className="size-5 text-accent" /> Discussion <span className="text-sm font-normal text-fg-muted">{total + (items.length - initial.length)}</span>
        </h2>
        <Segmented size="sm" value={sort} onChange={setSort} items={[{ value: 'new', label: 'Newest' }, { value: 'top', label: 'Top' }]} aria-label="Sort comments" />
      </div>
      {viewer ? (
        <Composer target={target} viewer={viewer} onCreated={(c) => setItems((x) => [c, ...x])} />
      ) : (
        <p className="rounded-card border border-dashed border-border px-4 py-4 text-sm text-fg-muted">
          <Link href="/login" className="font-medium text-accent hover:underline">Sign in</Link> to join the discussion. Mark spoilers so everyone can enjoy the ride.
        </p>
      )}
      <motion.ul className="mt-5 flex flex-col gap-5" initial={false}>
        <AnimatePresence initial={false}>
          {sorted.map((c) => (
            <motion.li key={c.id} layout variants={fadeUp} initial="hidden" animate="show" exit="exit">
              <CommentItem comment={c} target={target} viewer={viewer} viewerIsStaff={viewerIsStaff} hideSpoilers={hideSpoilersByDefault} initialReplies={initialReplies[c.id] ?? []} onDeleted={() => setItems((x) => x.filter((y) => y.id !== c.id))} />
            </motion.li>
          ))}
        </AnimatePresence>
        {sorted.length === 0 ? <li className="py-6 text-center text-sm text-fg-muted">Be the first to share your thoughts.</li> : null}
      </motion.ul>
    </Island>
  );
}

function Composer({ target, viewer, parentId, onCreated, onCancel, autoFocus, placeholder }: { target: CommentTarget; viewer: PublicUser; parentId?: string; onCreated: (c: CommentView) => void; onCancel?: () => void; autoFocus?: boolean; placeholder?: string }) {
  const [body, setBody] = useState('');
  const [spoiler, setSpoiler] = useState(false);
  const [images, setImages] = useState<CommentImage[]>([]);
  const [uploading, setUploading] = useState(false);
  const [pending, start] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const router = useRouter();

  const upload = useCallback(
    async (files: FileList | null) => {
      if (!files?.length) return;
      if (images.length + files.length > 4) {
        toast({ tone: 'warning', title: 'Up to 4 images per comment' });
        return;
      }
      setUploading(true);
      try {
        for (const file of Array.from(files)) {
          const blob = await downscaleImage(file, 1600);
          const fd = new FormData();
          fd.append('file', blob, file.name);
          const res = await fetch('/api/upload/comment', { method: 'POST', body: fd });
          const data = (await res.json()) as CommentImage & { error?: string };
          if (!res.ok) throw new Error(data.error ?? 'Upload failed');
          setImages((x) => [...x, { url: data.url, width: data.width, height: data.height }]);
        }
      } catch (err) {
        toast({ tone: 'error', title: 'Image upload failed', description: (err as Error).message });
      } finally {
        setUploading(false);
        if (fileRef.current) fileRef.current.value = '';
      }
    },
    [images.length, toast],
  );

  const submit = () => {
    if (!body.trim()) return;
    start(async () => {
      const result = await createCommentAction(target, { body, isSpoiler: spoiler, images, parentId: parentId ?? null });
      if (!result.ok) {
        toast({ tone: 'error', title: 'Could not post', description: result.error });
        return;
      }
      onCreated(result.data);
      setBody('');
      setImages([]);
      setSpoiler(false);
      router.refresh();
    });
  };

  return (
    <div className="flex gap-3">
      <Avatar src={viewer.avatarUrl} name={viewer.displayName} size="sm" className="mt-1 hidden sm:inline-flex" />
      <div className="min-w-0 flex-1">
        <Textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder={placeholder ?? 'What did you think?'}
          rows={parentId ? 2 : 3}
          maxLength={2000}
          autoFocus={autoFocus}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') submit();
          }}
          className={cn(spoiler && 'border-accent/40')}
        />
        {images.length ? (
          <div className="mt-2 flex flex-wrap gap-2">
            {images.map((im) => (
              <span key={im.url} className="relative size-20 overflow-hidden rounded-card border border-border">
                <img src={im.url} alt="" className="size-full object-cover" />
                <button type="button" onClick={() => setImages((x) => x.filter((y) => y.url !== im.url))} className="absolute top-1 right-1 rounded-full bg-black/60 p-0.5 text-white" aria-label="Remove image">
                  <X className="size-3" />
                </button>
              </span>
            ))}
          </div>
        ) : null}
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-xs text-fg-muted">
            <Switch checked={spoiler} onCheckedChange={setSpoiler} label="Contains spoilers" />
            Spoiler
          </label>
          <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={(e) => upload(e.target.files)} />
          <Button variant="ghost" size="sm" onClick={() => fileRef.current?.click()} loading={uploading} disabled={images.length >= 4}>
            <ImagePlus className="size-4" /> Image
          </Button>
          <div className="ml-auto flex items-center gap-2">
            {onCancel ? (
              <Button variant="ghost" size="sm" onClick={onCancel}>
                Cancel
              </Button>
            ) : null}
            <Button size="sm" onClick={submit} loading={pending} disabled={!body.trim()}>
              <Send className="size-3.5" /> {parentId ? 'Reply' : 'Post'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function CommentItem({ comment, target, viewer, viewerIsStaff, hideSpoilers, initialReplies, onDeleted, isReply = false }: { comment: CommentView; target: CommentTarget; viewer: PublicUser | null; viewerIsStaff: boolean; hideSpoilers: boolean; initialReplies: CommentView[]; onDeleted: () => void; isReply?: boolean }) {
  const [revealed, setRevealed] = useState(!comment.isSpoiler || !hideSpoilers);
  const [liked, setLiked] = useState(comment.likedByViewer);
  const [likeCount, setLikeCount] = useState(comment.likeCount);
  const [replying, setReplying] = useState(false);
  const [replies, setReplies] = useState<CommentView[]>(initialReplies);
  const [showReplies, setShowReplies] = useState(initialReplies.length > 0 && initialReplies.length <= 3);
  const [loadingReplies, setLoadingReplies] = useState(false);
  const [deleted, setDeleted] = useState(Boolean(comment.deletedAt));
  const [hidden, setHidden] = useState(Boolean(comment.hiddenAt));
  const [, start] = useTransition();
  const { toast } = useToast();
  const router = useRouter();

  const toggleLike = () => {
    if (!viewer) {
      router.push('/login');
      return;
    }
    setLiked((l) => !l);
    setLikeCount((n) => n + (liked ? -1 : 1));
    start(async () => {
      const r = await toggleCommentLikeAction(comment.id);
      if (r.ok) {
        setLiked(r.data.liked);
        setLikeCount(r.data.likeCount);
      }
    });
  };

  const remove = () => {
    start(async () => {
      const r = await deleteCommentAction(comment.id);
      if (!r.ok) toast({ tone: 'error', title: r.error });
      else {
        setDeleted(true);
        if (replies.length === 0 && !isReply) onDeleted();
      }
    });
  };

  const report = (reason: 'spam' | 'harassment' | 'unmarked_spoiler' | 'nsfw' | 'other') => {
    start(async () => {
      const r = await reportContentAction({ targetType: 'comment', targetId: comment.id, reason });
      toast(r.ok ? { tone: 'success', title: 'Thanks, a moderator will take a look.' } : { tone: 'error', title: r.error });
    });
  };

  const loadReplies = async () => {
    if (replies.length === 0 && comment.replyCount > 0) {
      setLoadingReplies(true);
      const res = await fetch(`/api/comments/${comment.id}/replies`);
      if (res.ok) setReplies(((await res.json()) as { items: CommentView[] }).items);
      setLoadingReplies(false);
    }
    setShowReplies((s) => !s);
  };

  const body = deleted ? <span className="italic text-fg-subtle">This comment was removed.</span> : comment.body;

  return (
    <article className={cn('group flex gap-3', hidden && 'opacity-60')} id={`comment-${comment.id}`}>
      <Link href={`/u/${comment.author.username}`} className="mt-0.5 shrink-0">
        <Avatar src={comment.author.avatarUrl} name={comment.author.displayName} size={isReply ? 'xs' : 'sm'} />
      </Link>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-sm">
          <Link href={`/u/${comment.author.username}`} className="font-semibold text-fg hover:underline">
            {comment.author.displayName}
          </Link>
          <span className="text-xs text-fg-subtle">@{comment.author.username}</span>
          <span className="text-xs text-fg-subtle">· {formatRelative(comment.createdAt)}</span>
          {comment.editedAt ? <span className="text-xs text-fg-subtle">(edited)</span> : null}
          {comment.isSpoiler ? <span className="rounded-pill bg-accent-soft px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-accent uppercase">Spoiler</span> : null}
          {hidden ? <span className="rounded-pill bg-danger/15 px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-danger uppercase">Hidden</span> : null}
        </div>
        <div className="relative mt-1">
          <div className={cn('text-sm leading-relaxed whitespace-pre-wrap break-words text-fg', !revealed && 'spoiler-blur')} aria-hidden={!revealed}>
            {body}
            {!deleted && comment.images.length > 0 ? (
              <div className={cn('mt-2 grid gap-2', comment.images.length > 1 ? 'grid-cols-2' : 'grid-cols-1')}>
                {comment.images.map((im) => (
                  <a key={im.url} href={im.url} target="_blank" rel="noopener noreferrer" className="overflow-hidden rounded-card border border-border">
                    <img src={im.url} alt={im.alt ?? ''} width={im.width} height={im.height} className="max-h-96 w-full object-cover" loading="lazy" />
                  </a>
                ))}
              </div>
            ) : null}
          </div>
          {!revealed ? (
            <button type="button" onClick={() => setRevealed(true)} className="absolute inset-0 flex items-center justify-center gap-2 rounded-card text-xs font-semibold text-fg">
              <EyeOff className="size-4" /> Spoiler — tap to reveal
            </button>
          ) : null}
        </div>
        <div className="mt-2 flex items-center gap-1 text-xs text-fg-muted">
          <motion.button type="button" whileTap={{ scale: 0.85 }} transition={springs.pop} onClick={toggleLike} aria-pressed={liked} className={cn('flex items-center gap-1 rounded-pill px-2 py-1 hover:bg-surface-2', liked && 'text-danger')}>
            <Heart className={cn('size-3.5', liked && 'fill-current')} /> {likeCount || ''}
          </motion.button>
          {viewer && !isReply ? (
            <button type="button" onClick={() => setReplying((r) => !r)} className="flex items-center gap-1 rounded-pill px-2 py-1 hover:bg-surface-2">
              <Reply className="size-3.5" /> Reply
            </button>
          ) : null}
          {!isReply && comment.replyCount > 0 ? (
            <button type="button" onClick={loadReplies} className="flex items-center gap-1 rounded-pill px-2 py-1 hover:bg-surface-2">
              <MessageCircle className="size-3.5" /> {showReplies ? 'Hide' : `${comment.replyCount} ${comment.replyCount === 1 ? 'reply' : 'replies'}`}
            </button>
          ) : null}
          {comment.isSpoiler && revealed && hideSpoilers ? (
            <button type="button" onClick={() => setRevealed(false)} className="flex items-center gap-1 rounded-pill px-2 py-1 hover:bg-surface-2">
              <Eye className="size-3.5" /> Hide spoiler
            </button>
          ) : null}
          {viewer ? (
            <Menu className="ml-auto">
              <MenuTrigger>
                {(props) => (
                  <button type="button" {...props} className="rounded-pill p-1 opacity-0 transition-opacity group-hover:opacity-100 hover:bg-surface-2 focus:opacity-100 aria-expanded:opacity-100" aria-label="More">
                    <Ellipsis className="size-4" />
                  </button>
                )}
              </MenuTrigger>
              <MenuContent>
                {comment.canDelete && !deleted ? <MenuItem icon={<Trash />} destructive onSelect={remove}>Delete</MenuItem> : null}
                {viewerIsStaff ? (
                  <MenuItem icon={hidden ? <Eye /> : <EyeOff />} onSelect={() => start(async () => { const r = await hideCommentAction(comment.id, !hidden); if (r.ok) setHidden(!hidden); })}>
                    {hidden ? 'Unhide' : 'Hide (moderation)'}
                  </MenuItem>
                ) : null}
                {viewer.id !== comment.userId ? (
                  <>
                    <MenuItem icon={<Flag />} onSelect={() => report('unmarked_spoiler')}>Report unmarked spoiler</MenuItem>
                    <MenuItem icon={<Flag />} onSelect={() => report('harassment')}>Report harassment</MenuItem>
                    <MenuItem icon={<Flag />} onSelect={() => report('spam')}>Report spam</MenuItem>
                  </>
                ) : null}
              </MenuContent>
            </Menu>
          ) : null}
        </div>
        {replying && viewer ? (
          <div className="mt-3">
            <Composer target={target} viewer={viewer} parentId={comment.id} autoFocus placeholder={`Reply to ${comment.author.displayName}…`} onCancel={() => setReplying(false)} onCreated={(c) => { setReplies((r) => [...r, c]); setShowReplies(true); setReplying(false); }} />
          </div>
        ) : null}
        <AnimatePresence initial={false}>
          {showReplies && replies.length > 0 ? (
            <motion.ul initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} transition={springs.gentle} className="mt-4 flex flex-col gap-4 border-l-2 border-border pl-4">
              {replies.map((r) => (
                <li key={r.id}>
                  <CommentItem comment={r} target={target} viewer={viewer} viewerIsStaff={viewerIsStaff} hideSpoilers={hideSpoilers} initialReplies={[]} onDeleted={() => setReplies((x) => x.filter((y) => y.id !== r.id))} isReply />
                </li>
              ))}
            </motion.ul>
          ) : null}
        </AnimatePresence>
        {loadingReplies ? <p className="mt-2 text-xs text-fg-subtle">Loading replies…</p> : null}
      </div>
    </article>
  );
}
