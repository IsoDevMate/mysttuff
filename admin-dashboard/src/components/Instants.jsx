import React, { useEffect, useRef, useState } from 'react';
import { Card, CardContent } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Zap, Plus, Trash2, Send, Users, Check, X, Clock } from 'lucide-react';
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
  const [sending, setSending] = useState(false);
  const [tab, setTab] = useState('instants'); // 'instants' | 'waitlist'
  const fileRef = useRef(null);

  useEffect(() => {
    load();
  }, []);

  const load = async () => {
    try {
      const [instantsData, waitlistData] = await Promise.all([
        api.getInstants(),
        api.getWaitlist().catch(() => []),
      ]);
      setInstants(instantsData);
      setWaitlist(waitlistData);
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
      const created = await api.createInstant({ text, link_url: linkUrl || null });
      setInstants((prev) => [created, ...prev]);
      setText('');
      setLinkUrl('');
      toast.success('Live on your site — instantly');
    } catch {
      toast.error('Failed to capture instant');
    } finally {
      setSending(false);
    }
  };

  const uploadImage = async (file) => {
    try {
      const upload = await api.uploadFile(file);
      const created = await api.createInstant({ image_url: upload.url, text: text.trim() || null });
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

  if (loading) return <div className="p-6">Loading...</div>;

  const pendingCount = waitlist.filter((w) => w.status === 'pending').length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Zap className="h-7 w-7 text-yellow-500" /> Instants
        </h1>
        <div className="flex border rounded-lg overflow-hidden">
          <button
            onClick={() => setTab('instants')}
            className={`px-4 py-1.5 text-sm flex items-center gap-1.5 ${tab === 'instants' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}
          >
            <Zap className="h-3.5 w-3.5" /> Instants ({instants.length})
          </button>
          <button
            onClick={() => setTab('waitlist')}
            className={`px-4 py-1.5 text-sm flex items-center gap-1.5 border-l ${tab === 'waitlist' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}
          >
            <Users className="h-3.5 w-3.5" /> Waitlist
            {pendingCount > 0 && (
              <span className="bg-yellow-500 text-white text-[10px] px-1.5 rounded-full">{pendingCount}</span>
            )}
          </button>
        </div>
      </div>

      <p className="text-sm text-muted-foreground">
        Words, concepts, links you stumble on during the day — capture them here and they show up
        on your site <strong>instantly</strong>. Readers can think along; new ones join a waitlist
        before they can post thoughts. Seeds for future deep dives.
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
                  className="w-full p-3 border rounded-lg h-20 resize-none bg-background text-sm"
                />
              </div>
              <div className="flex flex-col sm:flex-row gap-2">
                <Input
                  value={linkUrl}
                  onChange={(e) => setLinkUrl(e.target.value)}
                  placeholder="Optional link — e.g. the article you were reading"
                  className="flex-1"
                />
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
                        <a href={instant.link_url} target="_blank" rel="noreferrer" className="text-xs text-blue-500 hover:underline break-all mt-1 block">
                          {instant.link_url}
                        </a>
                      )}
                      <p className="text-[11px] text-muted-foreground mt-1">
                        {new Date(instant.created_at + (instant.created_at.endsWith('Z') ? '' : 'Z')).toLocaleString()}
                        {!instant.published && ' · draft'}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-1.5 text-red-500 hover:text-red-600 shrink-0"
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
      ) : (
        <div className="space-y-2">
          {waitlist.length === 0 ? (
            <p className="text-center text-muted-foreground py-10">
              Nobody on the waitlist yet — people join when they try to post a thought.
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
