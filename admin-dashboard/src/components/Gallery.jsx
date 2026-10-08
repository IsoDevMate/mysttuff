import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Trash2, Plus, Upload, X, Film, Pencil } from 'lucide-react';
import ImageUpload from './ImageUpload';
import { api } from '../api';
import toast from 'react-hot-toast';

const parseMedia = (raw) => {
    if (Array.isArray(raw)) return raw;
    if (!raw) return [];
    try {
        const v = JSON.parse(raw);
        return Array.isArray(v) ? v : [];
    } catch {
        return [];
    }
};

const emptyItem = () => ({
    title: '',
    description: '',
    type: 'photo',
    image_url: '',
    media: [],
    date: new Date().toISOString().split('T')[0]
});

const Gallery = () => {
    const [gallery, setGallery] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showAddForm, setShowAddForm] = useState(false);
    const [newItem, setNewItem] = useState(emptyItem());
    // Edit mode: id of the gallery item being edited (form above is reused)
    const [editingId, setEditingId] = useState(null);

    useEffect(() => {
        loadGallery();
    }, []);

    const loadGallery = async () => {
        try {
            const data = await api.getGallery();
            setGallery(data);
        } catch (error) {
            toast.error('Failed to load gallery');
        } finally {
            setLoading(false);
        }
    };

    const handleMediaUploaded = (url, media) => {
        setNewItem(prev => {
            const kind = media?.isVideo ? 'video' : 'image';
            const mediaList = [...(prev.media || []), { url, type: kind }];
            return { ...prev, media: mediaList, image_url: prev.image_url || url };
        });
        toast.success('Uploaded — add as many images/videos as you like');
    };

    const removeMedia = (index) => {
        setNewItem(prev => {
            const mediaList = prev.media.filter((_, i) => i !== index);
            return {
                ...prev,
                media: mediaList,
                image_url: prev.image_url && mediaList.some(m => m.url === prev.image_url)
                    ? prev.image_url
                    : mediaList[0]?.url || '',
            };
        });
    };

    const startEdit = (item) => {
        setEditingId(item.id);
        setShowAddForm(true);
        setNewItem({
            title: item.title || '',
            description: item.description || '',
            type: item.type || 'photo',
            image_url: item.image_url || '',
            media: parseMedia(item.media),
            date: item.date ? String(item.date).split('T')[0] : new Date().toISOString().split('T')[0],
        });
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const cancelEdit = () => {
        setEditingId(null);
        setShowAddForm(false);
        setNewItem(emptyItem());
    };

    const replaceMediaUrl = (oldUrl, newUrl) => {
        setNewItem(prev => ({
            ...prev,
            media: prev.media.map(m => (m.url === oldUrl ? { ...m, url: newUrl } : m)),
            image_url: prev.image_url === oldUrl ? newUrl : prev.image_url,
        }));
    };

    const addGalleryItem = async () => {
        if (!newItem.title || !(newItem.media.length || newItem.image_url)) {
            toast.error('Title and at least one image or video are required');
            return;
        }

        try {
            if (editingId) {
                const updated = await api.updateGalleryItem(editingId, newItem);
                setGallery(prev => prev.map(item => (item.id === editingId ? updated : item)));
                toast.success('Gallery item updated');
            } else {
                const item = await api.createGalleryItem(newItem);
                setGallery(prev => [item, ...prev]);
                toast.success('Gallery item added');
            }
            cancelEdit();
        } catch (error) {
            toast.error(editingId ? 'Failed to update gallery item' : 'Failed to add gallery item');
        }
    };

    const deleteGalleryItem = async (id) => {
        if (!confirm('Delete this gallery item?')) return;

        try {
            await api.deleteGalleryItem(id);
            setGallery(prev => prev.filter(item => item.id !== id));
            toast.success('Gallery item deleted');
        } catch (error) {
            toast.error('Failed to delete gallery item');
        }
    };

    if (loading) return <div className="p-6">Loading...</div>;

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h1 className="text-3xl font-bold">Gallery</h1>
                <Button onClick={() => (showAddForm ? cancelEdit() : setShowAddForm(true))}>
                    <Plus className="mr-2 h-4 w-4" />
                    Add Item
                </Button>
            </div>

            {showAddForm && (
                <Card>
                    <CardHeader>
                        <CardTitle>
                            {editingId ? 'Edit Gallery Item' : 'Add Gallery Item'}
                            {editingId && (
                                <span className="ml-2 text-xs font-normal text-muted-foreground">
                                    editing “{gallery.find(g => g.id === editingId)?.title}”
                                </span>
                            )}
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <Label htmlFor="title">Title</Label>
                                <Input
                                    id="title"
                                    value={newItem.title}
                                    onChange={(e) => setNewItem(prev => ({ ...prev, title: e.target.value }))}
                                    placeholder="Gallery item title"
                                />
                            </div>
                            <div>
                                <Label htmlFor="date">Date</Label>
                                <Input
                                    id="date"
                                    type="date"
                                    value={newItem.date}
                                    onChange={(e) => setNewItem(prev => ({ ...prev, date: e.target.value }))}
                                />
                            </div>
                        </div>

                        <div>
                            <Label htmlFor="description">Description</Label>
                            <textarea
                                id="description"
                                value={newItem.description}
                                onChange={(e) => setNewItem(prev => ({ ...prev, description: e.target.value }))}
                                placeholder="Optional description"
                                className="w-full p-3 border rounded-lg h-20 resize-none"
                            />
                        </div>

                        <div>
                            <Label>Upload media (images & videos, multiple allowed)</Label>
                            <ImageUpload
                                onUploaded={handleMediaUploaded}
                                onReplaced={replaceMediaUrl}
                                allowVideos
                                openCropOnSelect
                            />
                        </div>

                        {newItem.media.length > 0 && (
                            <div>
                                <Label>Media ({newItem.media.length})</Label>
                                <div className="grid grid-cols-3 md:grid-cols-5 gap-2 mt-2">
                                    {newItem.media.map((m, i) => (
                                        <div key={i} className="relative group rounded-lg overflow-hidden border">
                                            {m.type === 'video' ? (
                                                <div className="w-full h-20 bg-muted flex items-center justify-center">
                                                    <Film className="h-6 w-6 text-muted-foreground" />
                                                </div>
                                            ) : (
                                                <img src={m.url} alt="" className="w-full h-20 object-cover" />
                                            )}
                                            <button
                                                type="button"
                                                onClick={() => removeMedia(i)}
                                                className="absolute top-1 right-1 bg-red-600 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                                            >
                                                <X className="h-3 w-3" />
                                            </button>
                                            {i === 0 && (
                                                <span className="absolute bottom-0 left-0 right-0 text-[10px] text-center bg-background/80">
                                                    cover
                                                </span>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        <div className="flex space-x-2">
                            <Button onClick={addGalleryItem}>
                                {editingId ? 'Save Changes' : 'Add to Gallery'}
                            </Button>
                            <Button variant="outline" onClick={cancelEdit}>
                                Cancel
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {gallery.map((item) => (
                    <Card key={item.id} className="overflow-hidden">
                        <div className="aspect-video relative">
                            <img
                                src={item.image_url}
                                alt={item.title}
                                className="w-full h-full object-cover"
                            />
                            {(parseMedia(item.media).some(m => m.type === 'video')) && (
                                <span className="absolute bottom-2 left-2 bg-black/60 text-white text-xs px-1.5 py-0.5 rounded flex items-center gap-1">
                                    <Film className="h-3 w-3" /> video
                                </span>
                            )}
                            <div className="absolute top-2 right-2 flex gap-1">
                                <Button
                                    variant="secondary"
                                    size="sm"
                                    onClick={() => startEdit(item)}
                                    title="Edit this item"
                                >
                                    <Pencil className="h-4 w-4" />
                                </Button>
                                <Button
                                    variant="destructive"
                                    size="sm"
                                    onClick={() => deleteGalleryItem(item.id)}
                                >
                                    <Trash2 className="h-4 w-4" />
                                </Button>
                            </div>
                        </div>
                        <CardContent className="p-4">
                            <h3 className="font-semibold mb-2">{item.title}</h3>
                            {item.description && (
                                <p className="text-sm text-gray-600 mb-2">{item.description}</p>
                            )}
                            <p className="text-xs text-gray-500">
                                {new Date(item.date).toLocaleDateString()}
                            </p>
                        </CardContent>
                    </Card>
                ))}
            </div>

            {gallery.length === 0 && (
                <div className="text-center py-12">
                    <Upload className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                    <p className="text-gray-500 mb-4">No gallery items yet</p>
                    <Button onClick={() => setShowAddForm(true)}>
                        Add your first gallery item
                    </Button>
                </div>
            )}
        </div>
    );
};

export default Gallery;
