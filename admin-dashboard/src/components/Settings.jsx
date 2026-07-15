import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Plus, Trash2, Save, Link as LinkIcon, GripVertical, ExternalLink } from 'lucide-react';
import { api } from '../api';
import toast from 'react-hot-toast';

const pageVariants = {
  initial: { opacity: 0, y: 20 },
  in: { opacity: 1, y: 0 },
  out: { opacity: 0, y: -20 },
};

const ICON_OPTIONS = [
  { value: 'github', label: '🐙 GitHub' },
  { value: 'twitter', label: '𝕏 Twitter/X' },
  { value: 'linkedin', label: '💼 LinkedIn' },
  { value: 'instagram', label: '📸 Instagram' },
  { value: 'youtube', label: '▶️ YouTube' },
  { value: 'twitch', label: '🎮 Twitch' },
  { value: 'default', label: '🔗 Other' },
];

// Detect icon from URL automatically
function detectIcon(url) {
  const u = url.toLowerCase();
  if (u.includes('github')) return 'github';
  if (u.includes('twitter') || u.includes('x.com')) return 'twitter';
  if (u.includes('linkedin')) return 'linkedin';
  if (u.includes('instagram')) return 'instagram';
  if (u.includes('youtube')) return 'youtube';
  if (u.includes('twitch')) return 'twitch';
  return 'default';
}

const EMPTY_LINK = { name: '', url: '', icon: 'default', order_index: 0 };

function Settings() {
  const queryClient = useQueryClient();
  const [newLink, setNewLink] = useState(EMPTY_LINK);
  const [editingId, setEditingId] = useState(null);
  const [editValues, setEditValues] = useState({});
  const [showAdvanced, setShowAdvanced] = useState(false);

  const { data: links = [], isLoading } = useQuery({
    queryKey: ['social-links'],
    queryFn: () => api.getSocialLinks(),
  });

  const createMutation = useMutation({
    mutationFn: (data) => api.createSocialLink(data),
    onSuccess: () => {
      queryClient.invalidateQueries(['social-links']);
      setNewLink(EMPTY_LINK);
      setShowAdvanced(false);
      toast.success('Link added');
    },
    onError: (e) => toast.error('Failed to add link: ' + e.message),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => api.updateSocialLink(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['social-links']);
      setEditingId(null);
      toast.success('Link updated');
    },
    onError: (e) => toast.error('Failed to update link: ' + e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => api.deleteSocialLink(id),
    onSuccess: () => {
      queryClient.invalidateQueries(['social-links']);
      toast.success('Link deleted');
    },
    onError: (e) => toast.error('Failed to delete: ' + e.message),
  });

  const handleUrlChange = (url) => {
    setNewLink((p) => ({
      ...p,
      url,
      icon: detectIcon(url),
      // Auto-fill name from icon if name is empty
      name: p.name || ICON_OPTIONS.find(o => o.value === detectIcon(url))?.label.split(' ').slice(1).join(' ') || p.name,
    }));
  };

  const handleAdd = (e) => {
    e.preventDefault();
    if (!newLink.name.trim() || !newLink.url.trim()) {
      toast.error('Name and URL are required');
      return;
    }
    // Ensure URL has protocol
    let url = newLink.url.trim();
    if (url && !url.startsWith('http://') && !url.startsWith('https://')) {
      url = 'https://' + url;
    }
    createMutation.mutate({ ...newLink, url });
  };

  const startEdit = (link) => {
    setEditingId(link.id);
    setEditValues({ name: link.name, url: link.url, icon: link.icon || 'default', order_index: link.order_index });
  };

  const saveEdit = (id) => {
    updateMutation.mutate({ id, data: editValues });
  };

  return (
    <motion.div
      initial="initial"
      animate="in"
      exit="out"
      variants={pageVariants}
      transition={{ type: 'tween', ease: 'anticipate', duration: 0.3 }}
      className="space-y-6 max-w-2xl"
    >
      <h1 className="text-2xl font-bold">Settings</h1>

      {/* Social Links */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <LinkIcon className="h-4 w-4" />
            Social Links
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Existing links */}
          {isLoading ? (
            <p className="text-muted-foreground text-sm">Loading...</p>
          ) : links.length === 0 ? (
            <p className="text-muted-foreground text-sm">No links yet. Add one below.</p>
          ) : (
            <div className="space-y-2">
              {links.map((link) => (
                <div key={link.id} className="border rounded-lg">
                  {editingId === link.id ? (
                    <div className="p-3 space-y-3">
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <Label className="text-xs">Name</Label>
                          <Input
                            value={editValues.name}
                            onChange={(e) => setEditValues((p) => ({ ...p, name: e.target.value }))}
                            className="h-8 text-sm"
                          />
                        </div>
                        <div>
                          <Label className="text-xs">Icon</Label>
                          <select
                            value={editValues.icon}
                            onChange={(e) => setEditValues((p) => ({ ...p, icon: e.target.value }))}
                            className="w-full h-8 text-sm border rounded px-2 bg-background"
                          >
                            {ICON_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                          </select>
                        </div>
                      </div>
                      <div>
                        <Label className="text-xs">URL</Label>
                        <Input
                          value={editValues.url}
                          onChange={(e) => setEditValues((p) => ({ ...p, url: e.target.value }))}
                          className="h-8 text-sm"
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-24">
                          <Label className="text-xs">Order</Label>
                          <Input
                            type="number"
                            value={editValues.order_index}
                            onChange={(e) => setEditValues((p) => ({ ...p, order_index: Number(e.target.value) }))}
                            className="h-8 text-sm"
                          />
                        </div>
                        <div className="flex gap-2 mt-4">
                          <Button size="sm" onClick={() => saveEdit(link.id)} disabled={updateMutation.isPending}>
                            <Save className="h-3 w-3 mr-1" /> Save
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => setEditingId(null)}>Cancel</Button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-3 p-3">
                      <GripVertical className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">{link.name}</p>
                        <a
                          href={link.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1 truncate max-w-xs"
                        >
                          {link.url} <ExternalLink className="h-3 w-3 inline flex-shrink-0" />
                        </a>
                      </div>
                      <div className="flex gap-1 flex-shrink-0">
                        <Button size="sm" variant="outline" onClick={() => startEdit(link)}>Edit</Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-red-600 hover:text-red-700 hover:border-red-300"
                          onClick={() => {
                            if (confirm(`Delete "${link.name}"?`)) deleteMutation.mutate(link.id);
                          }}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Quick-add form */}
          <form onSubmit={handleAdd} className="border rounded-lg p-3 space-y-3 bg-muted/30">
            <p className="text-sm font-medium">Add New Link</p>

            {/* URL first — auto-detects icon + suggests name */}
            <div>
              <Label className="text-xs">URL <span className="text-muted-foreground font-normal">(paste your link — icon auto-detected)</span></Label>
              <Input
                placeholder="https://github.com/yourhandle"
                value={newLink.url}
                onChange={(e) => handleUrlChange(e.target.value)}
                className="h-9 text-sm"
                autoComplete="url"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">Display Name</Label>
                <Input
                  placeholder="GitHub"
                  value={newLink.name}
                  onChange={(e) => setNewLink((p) => ({ ...p, name: e.target.value }))}
                  className="h-9 text-sm"
                />
              </div>
              <div>
                <Label className="text-xs">Icon</Label>
                <select
                  value={newLink.icon}
                  onChange={(e) => setNewLink((p) => ({ ...p, icon: e.target.value }))}
                  className="w-full h-9 text-sm border rounded px-2 bg-background"
                >
                  {ICON_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
            </div>

            {/* Advanced toggle for order */}
            <button
              type="button"
              className="text-xs text-muted-foreground hover:text-foreground"
              onClick={() => setShowAdvanced((v) => !v)}
            >
              {showAdvanced ? '▲ Hide advanced' : '▼ Advanced options'}
            </button>
            {showAdvanced && (
              <div className="w-24">
                <Label className="text-xs">Order (lower = first)</Label>
                <Input
                  type="number"
                  value={newLink.order_index}
                  onChange={(e) => setNewLink((p) => ({ ...p, order_index: Number(e.target.value) }))}
                  className="h-8 text-sm"
                />
              </div>
            )}

            <Button type="submit" size="sm" disabled={createMutation.isPending}>
              <Plus className="h-3 w-3 mr-1" />
              {createMutation.isPending ? 'Adding...' : 'Add Link'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </motion.div>
  );
}

export default Settings;
