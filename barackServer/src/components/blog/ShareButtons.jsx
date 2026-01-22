import React from "react";
import { Button } from "@/components/ui/button";
import { Facebook, Twitter, Linkedin, Mail, Link as LinkIcon } from "lucide-react";
import { toast } from "sonner";

export default function ShareButtons({ title, url }) {
  const shareUrl = url || window.location.href;
  const shareText = encodeURIComponent(title);
  const encodedUrl = encodeURIComponent(shareUrl);

  const copyLink = () => {
    navigator.clipboard.writeText(shareUrl);
    toast.success("Link copied!");
  };

  return (
    <div className="space-y-2">
      <p className="font-body text-sm font-medium mb-3">Share</p>
      <div className="flex flex-col gap-2">
        <Button
          variant="ghost"
          size="sm"
          className="justify-start gap-2"
          onClick={() => window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`, '_blank')}
        >
          <Facebook className="w-4 h-4" />
          <span className="text-xs">Facebook</span>
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="justify-start gap-2"
          onClick={() => window.open(`https://twitter.com/intent/tweet?text=${shareText}&url=${encodedUrl}`, '_blank')}
        >
          <Twitter className="w-4 h-4" />
          <span className="text-xs">Twitter</span>
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="justify-start gap-2"
          onClick={() => window.open(`https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`, '_blank')}
        >
          <Linkedin className="w-4 h-4" />
          <span className="text-xs">LinkedIn</span>
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="justify-start gap-2"
          onClick={() => window.open(`mailto:?subject=${shareText}&body=${encodedUrl}`, '_blank')}
        >
          <Mail className="w-4 h-4" />
          <span className="text-xs">Email</span>
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="justify-start gap-2"
          onClick={copyLink}
        >
          <LinkIcon className="w-4 h-4" />
          <span className="text-xs">Copy Link</span>
        </Button>
      </div>
    </div>
  );
}