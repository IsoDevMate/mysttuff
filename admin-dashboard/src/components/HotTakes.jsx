import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Flame, Plus, Trash2, Link2, Save, Pencil, X } from 'lucide-react';
import { api } from '../api';
import toast from 'react-hot-toast';

/**
 * Manage "AI Hot Takes" — short punchy takes shown on the public Blog page.
 * Each take can link to one of your articles, so clicking it reroutes readers there.
 */
const HotTakes = () => {
  const [takes, setTakes] = useState([]);
  const [articles, setArticles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [newTake, setNewTake] = useState({ take: '', article_slug: '', published: true });
  // id of the take whose text is being edited inline
  const [editingId, setEditingId] = useState(null);
  const [editText, setEditText] = useState('');

  const startEdit = (take) => {
    setEditingId(take.id);
    setEditText(take.take);
  };

  const saveEdit = async (id) => {
    if (!editText.trim()) {
      toast.error('Take text can\'t be empty');
      return;
    }
    try {
      await updateTake(id, { take: editText.trim() });
      setEditingId(null);
    } finally {
      // updateTake handles errors/toasts; editingId cleared on success only
    }
  };

  useEffect(() => {
    load();
  }, []);

  const load = async () => {
    try {
      const [takesData, articlesData] = await Promise.all([api.getHotTakes(), api.getArticles()]);
      setTakes(takesData);
      setArticles(articlesData);
    } catch (error) {
      toast.error('Failed to load hot takes');
    } finally {
      setLoading(false);
    }
  };

  const addTake = async () => {
    if (!newTake.take.trim()) {
      toast.error('Write the take first');
      return;
    }
    try {
      const created = await api.createHotTake({
        take: newTake.take,
        article_slug: newTake.article_slug || null,
        published: newTake.published,
      });
      setTakes((prev) => [created, ...prev]);
      setNewTake({ take: '', article_slug: '', published: true });
      setShowAdd(false);
      toast.success('Hot take added');
    } catch (error) {
      toast.error('Failed to add hot take');
    }
  };

  const updateTake = async (id, patch) => {
    try {
      const current = takes.find((t) => t.id === id);
      const updated = await api.updateHotTake(id, { ...current, ...patch });
      setTakes((prev) => prev.map((t) => (t.id === id ? updated : t)));
      setEditingId(null);
      toast.success('Updated');
    } catch (error) {
      toast.error('Failed to update take');
    }
  };

  const deleteTake = async (id) => {
    if (!confirm('Delete this hot take?')) return;
    try {
      await api.deleteHotTake(id);
      setTakes((prev) => prev.filter((t) => t.id !== id));
      toast.success('Deleted');
    } catch (error) {
      toast.error('Failed to delete take');
    }
  };

  if (loading) return <div aria-label="Loading hot takes" className="space-y-4 animate-pulse p-2"><div className="h-10 w-48 rounded bg-muted" />{[1, 2, 3].map((item) => <div key={item} className="h-24 rounded-xl bg-muted" />)}</div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Short opinions</p>
          <h1 className="font-display text-3xl font-semibold">Hot takes</h1>
        </div>
        <Button onClick={() => setShowAdd(!showAdd)}>
          <Plus className="mr-2 h-4 w-4" /> Add Take
        </Button>
      </div>

      <p className="text-sm text-muted-foreground">
        Short takes appear on the public writing page. Link a take to an article to send readers straight to the full piece.
      </p>

      {showAdd && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">New Hot Take</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="take">Take</Label>
              <textarea
                id="take"
                value={newTake.take}
                onChange={(e) => setNewTake((prev) => ({ ...prev, take: e.target.value }))}
                placeholder="A spicy one-liner about AI…"
                className="w-full min-h-20 p-3 border border-input rounded-lg resize-none bg-background text-foreground text-base"
              />
            </div>
            <div>
              <Label htmlFor="take-link">Link to article (optional)</Label>
              <select
                id="take-link"
                value={newTake.article_slug}
                onChange={(e) => setNewTake((prev) => ({ ...prev, article_slug: e.target.value }))}
                className="w-full min-h-11 border border-input rounded-md bg-background text-base sm:text-sm px-3"
              >
                <option value="">— no link —</option>
                {articles.map((a) => (
                  <option key={a.id} value={a.slug}>
                    {a.title}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={newTake.published}
                  onChange={(e) => setNewTake((prev) => ({ ...prev, published: e.target.checked }))}
                />
                Published
              </label>
              <div className="flex gap-2 ml-auto">
                <Button onClick={addTake}>
                  <Save className="mr-2 h-4 w-4" /> Add
                </Button>
                <Button variant="outline" onClick={() => setShowAdd(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {takes.length === 0 ? (
        <div className="text-center py-12">
          <Flame className="mx-auto h-12 w-12 text-muted-foreground/40 mb-4" />
          <p className="text-muted-foreground">No hot takes yet</p>
        </div>
      ) : (
        <div className="space-y-3">
          {takes.map((take) => (
            <Card key={take.id}>
              <CardContent className="py-4">
                <div className="flex items-start gap-3">
                  <Flame className="h-4 w-4 text-muted-foreground mt-1 shrink-0" />
                  <div className="flex-1 min-w-0">
                    {editingId === take.id ? (
                      <div className="flex items-start gap-2">
                        <textarea
                          autoFocus
                          value={editText}
                          onChange={(e) => setEditText(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Escape') setEditingId(null);
                            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) saveEdit(take.id);
                          }}
                          className="flex-1 p-2 border rounded-lg h-16 resize-none bg-background text-sm"
                        />
                        <div className="flex flex-col gap-1">
                          <Button size="sm" onClick={() => saveEdit(take.id)}>
                            <Save className="h-3.5 w-3.5" />
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => setEditingId(null)}>
                            <X className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <p className="text-sm">{take.take}</p>
                    )}
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 mt-3 min-w-0">
                      {take.article_slug ? (
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Link2 className="h-3 w-3" /> → {take.article_slug}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground/60">not linked</span>
                      )}
                      <select
                        value={take.article_slug || ''}
                        onChange={(e) => updateTake(take.id, { article_slug: e.target.value || null })}
                        className="min-h-11 max-w-full min-w-0 text-sm border border-input rounded-md px-2.5 bg-background"
                      >
                        <option value="">— no link —</option>
                        {articles.map((a) => (
                          <option key={a.id} value={a.slug}>
                            {a.title.slice(0, 50)}
                          </option>
                        ))}
                      </select>
                      <label className="min-h-11 flex items-center gap-2 text-sm cursor-pointer">
                        <input
                          type="checkbox"
                          className="h-4 w-4"
                          checked={take.published === 1 || take.published === true}
                          onChange={(e) => updateTake(take.id, { published: e.target.checked })}
                        />
                        live
                      </label>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label="Edit hot take"
                        title="Edit take text"
                        onClick={() => startEdit(take)}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive hover:text-destructive"
                        aria-label="Delete hot take"
                        onClick={() => deleteTake(take.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default HotTakes;
