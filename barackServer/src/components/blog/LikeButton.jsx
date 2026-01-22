import React, { useState, useEffect } from "react";
import { base44 } from "@/api/mockData";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Heart } from "lucide-react";
import { motion } from "framer-motion";

export default function LikeButton({ postId }) {
  const [userIdentifier, setUserIdentifier] = useState(null);
  const queryClient = useQueryClient();

  useEffect(() => {
    // Get or create a unique identifier for this user
    let identifier = localStorage.getItem('user_identifier');
    if (!identifier) {
      identifier = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      localStorage.setItem('user_identifier', identifier);
    }
    setUserIdentifier(identifier);
  }, []);

  const { data: likes = [] } = useQuery({
    queryKey: ['likes', postId],
    queryFn: () => base44.entities.Like.filter({ post_id: postId }),
  });

  const { data: userLikes = [] } = useQuery({
    queryKey: ['user-likes', postId, userIdentifier],
    queryFn: () => base44.entities.Like.filter({ 
      post_id: postId, 
      user_identifier: userIdentifier 
    }),
    enabled: !!userIdentifier,
  });

  const hasLiked = userLikes.length > 0;
  const likeCount = likes.length;

  const toggleLike = useMutation({
    mutationFn: async () => {
      if (hasLiked) {
        await base44.entities.Like.delete(userLikes[0].id);
      } else {
        await base44.entities.Like.create({
          post_id: postId,
          user_identifier: userIdentifier,
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['likes', postId]);
      queryClient.invalidateQueries(['user-likes', postId, userIdentifier]);
    },
  });

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={() => toggleLike.mutate()}
      disabled={!userIdentifier || toggleLike.isPending}
      className="gap-2"
    >
      <motion.div
        whileTap={{ scale: 1.2 }}
        animate={{ scale: hasLiked ? [1, 1.2, 1] : 1 }}
      >
        <Heart 
          className={`w-4 h-4 ${hasLiked ? 'fill-current' : ''}`} 
        />
      </motion.div>
      <span>{likeCount}</span>
    </Button>
  );
}