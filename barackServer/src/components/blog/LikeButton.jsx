import React, { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Heart } from "lucide-react";
import { motion } from "framer-motion";

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

function getUserIdentifier() {
  let id = localStorage.getItem('user_identifier');
  if (!id) {
    id = `user_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    localStorage.setItem('user_identifier', id);
  }
  return id;
}

async function fetchLikes(postId) {
  const res = await fetch(`${API_BASE}/articles/${postId}/likes`);
  if (!res.ok) throw new Error('Failed to fetch likes');
  return res.json(); // { count: number }
}

async function toggleLike(postId, userIdentifier) {
  const res = await fetch(`${API_BASE}/articles/${postId}/likes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user_identifier: userIdentifier }),
  });
  if (!res.ok) throw new Error('Failed to toggle like');
  return res.json(); // { liked: boolean, count: number }
}

export default function LikeButton({ postId }) {
  const [userIdentifier] = useState(getUserIdentifier);
  const [hasLiked, setHasLiked] = useState(false);
  const queryClient = useQueryClient();

  const { data } = useQuery({
    queryKey: ['likes', postId],
    queryFn: () => fetchLikes(postId),
    enabled: !!postId,
  });

  const likeCount = data?.count ?? 0;

  const toggle = useMutation({
    mutationFn: () => toggleLike(postId, userIdentifier),
    onSuccess: (result) => {
      setHasLiked(result.liked);
      queryClient.setQueryData(['likes', postId], { count: result.count });
    },
  });

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={() => toggle.mutate()}
      disabled={toggle.isPending}
      className="gap-2"
    >
      <motion.div
        whileTap={{ scale: 1.3 }}
        animate={{ scale: hasLiked ? [1, 1.3, 1] : 1 }}
      >
        <Heart className={`w-4 h-4 ${hasLiked ? 'fill-current text-red-500' : ''}`} />
      </motion.div>
      <span>{likeCount}</span>
    </Button>
  );
}
