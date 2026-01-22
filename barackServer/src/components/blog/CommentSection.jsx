import React, { useState } from "react";
import { base44 } from "@/api/mockData";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { format } from "date-fns";
import { MessageCircle, Send } from "lucide-react";

export default function CommentSection({ postId }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [content, setContent] = useState("");
  const queryClient = useQueryClient();

  const { data: comments = [] } = useQuery({
    queryKey: ['comments', postId],
    queryFn: () => base44.entities.Comment.filter({ post_id: postId }, '-created_date'),
  });

  const createComment = useMutation({
    mutationFn: (data) => base44.entities.Comment.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries(['comments', postId]);
      setContent("");
      setName("");
      setEmail("");
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (name && content) {
      createComment.mutate({
        post_id: postId,
        content,
        author_name: name,
        author_email: email,
      });
    }
  };

  return (
    <div className="mt-16 border-t border-current/10 pt-12">
      <div className="flex items-center gap-2 mb-8">
        <MessageCircle className="w-5 h-5" />
        <h3 className="font-serif-display text-2xl font-bold">
          Comments ({comments.length})
        </h3>
      </div>

      {/* Comment Form */}
      <form onSubmit={handleSubmit} className="mb-12 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input
            placeholder="Your name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="bg-white/50 border-current/20"
            required
          />
          <Input
            type="email"
            placeholder="Your email (optional)"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="bg-white/50 border-current/20"
          />
        </div>
        <Textarea
          placeholder="Share your thoughts..."
          value={content}
          onChange={(e) => setContent(e.target.value)}
          className="bg-white/50 border-current/20 min-h-[100px]"
          required
        />
        <Button 
          type="submit" 
          disabled={createComment.isPending}
          className="gap-2"
        >
          <Send className="w-4 h-4" />
          {createComment.isPending ? "Posting..." : "Post Comment"}
        </Button>
      </form>

      {/* Comments List */}
      <div className="space-y-6">
        {comments.map((comment) => (
          <div key={comment.id} className="border-l-2 border-current/20 pl-4 py-2">
            <div className="flex items-center gap-3 mb-2">
              <span className="font-body font-medium">{comment.author_name}</span>
              <span className="font-body text-xs opacity-60">
                {format(new Date(comment.created_date), 'MMM d, yyyy')}
              </span>
            </div>
            <p className="font-body text-sm leading-relaxed opacity-80">
              {comment.content}
            </p>
          </div>
        ))}
        {comments.length === 0 && (
          <p className="font-body text-center opacity-40 py-8">
            No comments yet. Be the first to share your thoughts!
          </p>
        )}
      </div>
    </div>
  );
}