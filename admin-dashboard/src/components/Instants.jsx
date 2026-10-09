import React, { useEffect, useRef, useState } from 'react';
import { Card, CardContent } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Zap, Plus, Trash2, Send, Users, Check, X, Clock, MessageCircle, Heart } from 'lucide-react';
import { api } from '../api';
import toast from 'react-hot-toast';

/**
 * Instants — quick captures (words, concepts, sparks) that appear on the
 * public site in realtime. Visitors can read everything; writing a thought
 * requires being on the (approvable) waitlist.
 */
const Instants = () => {
  const [instants, setInstants] = useState([]);
  const [waitlist, setWaitlist] = useState([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [duration, setDuration] = useState('24h');
  const [sending, setSending] = useState(false);
  const [tab, setTab] = useState('instants'); // 'instants' | 'waitlist' | 'notes'
  const [notes, setNotes] = useState([]);
  const [reactionSummary, setReactionSummary] = useState({});
  const fileRef = useRef(null);

  useEffect(() => {
    load();
  }, []);

  const load = async () => {
    try {
      const [instantsData, waitlistData, notesData, reactionsData] = await Promise.all([
        api.getInstants(),
        api.getWaitlist().catch(() => []),
        api.getNotes().catch(() => []),
        api.getReactionSummary().catch(() => {}),
      ]);
      setInstants(instantsData);
      setWaitlist(waitlistData);
      setNotes(notesData);
      setReactionSummary(reactionsData || {});
    } catch {
      toast.error('Failed to load instants');
    } finally {
      setLoading(false);
    }
  };

  const capture = async () => {
    if (!text.trim()) {
      toast.error('Write the instant first');
      return;
    }
    setSending(true);
    try {
      const created = await api.createInstant({ text, link_url: linkUrl || null, duration });
      setInstants((prev) => [created, ...prev]);
      setText('');
      setLinkUrl('');
      toast.success(duration === 'never' ? 'Live — pinned until you remove it' : `Live for the next ${duration}`);
    } catch {
      toast.error('Failed to capture instant');
    } finally {
      setSending(false);
    }
  };

  const uploadImage = async (file) => {
    try {
      const upload = await api.uploadFile(file);
      const created = await api.createInstant({ image_url: upload.url, text: text.trim() || null, duration });
      setInstants((prev) => [created, ...prev]);
      setText('');
      toast.success('Image instant is live');
    } catch {
      toast.error('Upload failed');
    }
  };

  const removeInstant = async (id) => {
    if (!confirm('Delete this instant?')) return;
    try {
      await api.deleteInstant(id);
      setInstants((prev) => prev.filter((i) => i.id !== id));
    } catch {
      toast.error('Failed to delete');
    }
  };

  const setWaitlistStatus = async (id, status) => {
    try {
      await api.setWaitlistStatus(id, status);
      setWaitlist((prev) => prev.map((w) => (w.id === id ? { ...w, status } : w)));
    } catch {
      toast.error('Failed to update');
    }
  };

  if (loading) return <div aria-label="Loading instants" className="space-y-4 animate-pulse p-2"><div className="h-10 w-48 rounded bg-muted" />{[1, 2, 3].map((item) => <div key={item} className="h-24 rounded-xl bg-muted" />)}</div>;

  const pendingCount = waitlist.filter((w) => w.status === 'pending').length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Camera moments</p>
          <h1 className="font-display text-3xl font-semibold">Instants</h1>
        </div>
        <div role="tablist" aria-label="Instant management" className="flex flex-wrap gap-1 rounded-lg border border-border p-1">
          <button
            role="tab"
            aria-selected={tab === 'instants'}
            onClick={() => setTab('instants')}
            className={`min-h-11 rounded-md px-3 text-sm flex items-center gap-1.5 ${tab === 'instants' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'}`}
          >
            <Zap className="h-3.5 w-3.5" /> Instants ({instants.length})
          </button>
          <button
            role="tab"
            aria-selected={tab === 'notes'}
            onClick={() => setTab('notes')}
            className={`min-h-11 rounded-md px-3 text-sm flex items-center gap-1.5 ${tab === 'notes' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'}`}
          >
            <MessageCircle className="h-3.5 w-3.5" /> Notes ({notes.length})
          </button>
          <button
            role="tab"
            aria-selected={tab === 'waitlist'}
            onClick={() => setTab('waitlist')}
            className={`min-h-11 rounded-md px-3 text-sm flex items-center gap-1.5 ${tab === 'waitlist' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'}`}
          >
            <Users className="h-3.5 w-3.5" /> Waitlist
            {pendingCount > 0 && (
              <span className="bg-yellow-500 text-white text-[10px] px-1.5 rounded-full">{pendingCount}</span>
            )}
          </button>
        </div>
      </div>

      <p className="text-sm text-muted-foreground">
        Camera moments appear on your site as soon as you capture them. Set how long each one stays live, then review reactions here.
      </p>

      {tab === 'instants' ? (
        <>
          <Card>
            <CardContent className="pt-4 space-y-3">
              <div>
                <Label htmlFor="instant-text">Capture</Label>
                <textarea
                  id="instant-text"
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  onKeyDown={(e) => {
                    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') capture();
                  }}
                  placeholder="A word, a concept, a link, a spark… (Ctrl+Enter to fire)"
                  className="w-full min-h-20 p-3 border border-input rounded-lg resize-none bg-background text-base"
                />
              </div>
              <div className="flex flex-col sm:flex-row gap-2">

                <Input
                  value={linkUrl}
                  onChange={(e) => setLinkUrl(e.target.value)}
                  placeholder="Optional link — e.g. the article you were reading"
                  className="flex-1"
                />
                <select
                  value={duration}
                  onChange={(e) => setDuration(e.target.value)}
                  title="How long this instant stays live"
                  className="min-h-11 border border-input rounded-md bg-background text-sm px-3"
                >
                  <option value="4h">4 hours</option>
                  <option value="24h">24 hours</option>
                  <option value="7d">7 days</option>
                  <option value="never">Keep forever</option>
                </select>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  hidden
                  onChange={(e) => {
                    if (e.target.files?.[0]) uploadImage(e.target.files[0]);
                    e.target.value = '';
                  }}
                />
                <Button variant="outline" onClick={() => fileRef.current?.click()}>
                  + Image
                </Button>
                <Button onClick={capture} disabled={sending}>
                  <Send className="mr-2 h-4 w-4" />
                  {sending ? 'Firing…' : 'Fire it live'}
                </Button>
              </div>
            </CardContent>
          </Card>

          <div className="space-y-2">
            {instants.length === 0 ? (
              <p className="text-center text-muted-foreground py-10">Nothing captured yet.</p>
            ) : (
              instants.map((instant) => (
                <Card key={instant.id}>
                  <CardContent className="py-3 flex items-start gap-3">
                    <Zap className={`h-4 w-4 mt-1 shrink-0 ${instant.published ? 'text-yellow-500' : 'text-muted-foreground/40'}`} />
                    <div className="flex-1 min-w-0">
                      {instant.text && <p className="text-sm whitespace-pre-wrap break-words">{instant.text}</p>}
                      {instant.image_url && (
                        <img src={instant.image_url} alt="" className="mt-2 max-h-40 rounded-lg border" />
                      )}
                      {instant.link_url && (
                        <a href={instant.link_url} target="_blank" rel="noreferrer" className="min-h-11 text-sm text-muted-foreground hover:text-foreground hover:underline break-all mt-1 inline-flex items-center">
                          {instant.link_url}
                        </a>
                      )}
                      <p className="text-[11px] text-muted-foreground mt-1">
                        {new Date(instant.created_at + (instant.created_at.endsWith('Z') ? '' : 'Z')).toLocaleString()}
                        {!instant.published && ' · draft'}
                        {instant.expired && ' · expired (still in your archive)'}
                        {!instant.expired && instant.expires_at && ` · expires ${new Date(instant.expires_at).toLocaleString()}`}
                        {!instant.expires_at && ' · kept forever'}
                      </p>
                      {(reactionSummary[instant.id] || []).length > 0 && (
                        <p className="text-[11px] mt-1 flex items-center gap-2 flex-wrap">
                          <Heart className="h-3 w-3 text-pink-500" />
                          {reactionSummary[instant.id].map((r) => (
                            <span key={r.emoji} className="px-1.5 py-0.5 rounded bg-muted">
                              {r.emoji} {r.count}
                            </span>
                          ))}
                        </p>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-destructive hover:text-destructive shrink-0"
                      aria-label={`Delete instant ${instant.text || 'photo moment'}`}
                      onClick={() => removeInstant(instant.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </>
      ) : tab === 'notes' ? (
        <div role="tabpanel" className="space-y-2">
          {notes.length === 0 ? (

            <p className="text-center text-muted-foreground py-10">
              No notes to moderate yet. New visitor notes will appear here.
            </p>
          ) : (
            notes.map((n) => (
              <Card key={n.id}>
                <CardContent className="py-3 flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm">{n.body}</p>
                    <p className="text-[11px] text-muted-foreground mt-1 truncate">
                      by {n.author_name || 'someone'} · {new Date(n.created_at + (n.created_at.endsWith('Z') ? '' : 'Z')).toLocaleString()}
                      {n.instant_text && ` · on: “${n.instant_text.slice(0, 40)}”`}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-destructive hover:text-destructive shrink-0"
                    aria-label={`Delete note from ${n.author_name || 'visitor'}`}
                    onClick={async () => {
                      try {
                        await api.deleteNote(n.instant_id, n.id);
                        setNotes((prev) => prev.filter((x) => x.id !== n.id));
                        toast.success('Note removed');
                      } catch {
                        toast.error('Failed to remove note');
                      }
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      ) : (
        <div role="tabpanel" className="space-y-2">
          {waitlist.length === 0 ? (
            <p className="text-center text-muted-foreground py-10">
              No one on the waitlist yet. New requests will appear here.
            </p>
          ) : (
            waitlist.map((w) => (
              <Card key={w.id}>
                <CardContent className="py-3 flex items-center gap-3 flex-wrap">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{w.name || '—'}</p>
                    <p className="text-xs text-muted-foreground truncate">{w.email}</p>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full flex items-center gap-1 ${
                    w.status === 'approved'
                      ? 'bg-green-100 text-green-700'
                      : w.status === 'rejected'
                        ? 'bg-red-100 text-red-700'
                        : 'bg-yellow-100 text-yellow-700'
                  }`}>
                    {w.status === 'approved' ? <Check className="h-3 w-3" /> : w.status === 'rejected' ? <X className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
                    {w.status}
                  </span>
                  {w.status !== 'approved' && (
                    <Button size="sm" variant="outline" onClick={() => setWaitlistStatus(w.id, 'approved')}>
                      Approve
                    </Button>
                  )}
                  {w.status !== 'rejected' && (
                    <Button size="sm" variant="ghost" className="text-red-500" onClick={() => setWaitlistStatus(w.id, 'rejected')}>
                      Reject
                    </Button>
                  )}
                </CardContent>
              </Card>
            ))
          )}
        </div>
      )}
    </div>
  );
};

export default Instants;
