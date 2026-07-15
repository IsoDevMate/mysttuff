import React from 'react';
import { motion } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { RefreshCw, ClipboardList, Plus, Edit, Trash2 } from 'lucide-react';
import { api } from '../api';
import { format } from 'date-fns';

const ACTION_STYLES = {
  CREATE: { icon: Plus, color: 'text-green-600 bg-green-50 dark:bg-green-950/20' },
  UPDATE: { icon: Edit, color: 'text-blue-600 bg-blue-50 dark:bg-blue-950/20' },
  DELETE: { icon: Trash2, color: 'text-red-600 bg-red-50 dark:bg-red-950/20' },
};

function ActionBadge({ action }) {
  const cfg = ACTION_STYLES[action] || { icon: ClipboardList, color: 'text-gray-600 bg-gray-50' };
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${cfg.color}`}>
      <Icon className="h-3 w-3" />
      {action}
    </span>
  );
}

function ResourceBadge({ type }) {
  const labels = {
    article: 'Article',
    gallery: 'Gallery',
    social_link: 'Social Link',
    comment: 'Comment',
  };
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-muted text-muted-foreground">
      {labels[type] || type}
    </span>
  );
}

export default function AuditLogs() {
  const { data: logs = [], isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ['audit-logs'],
    queryFn: () => api.getAuditLogs(100),
    refetchInterval: 60000,
  });

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ type: 'tween', ease: 'anticipate', duration: 0.3 }}
      className="space-y-6"
    >
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <ClipboardList className="h-6 w-6" />
          Audit Logs
        </h1>
        <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
          <RefreshCw className={`h-4 w-4 mr-2 ${isFetching ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Last {logs.length} admin actions
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading && (
            <div className="p-6 space-y-3">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-12 bg-muted animate-pulse rounded" />
              ))}
            </div>
          )}

          {isError && (
            <div className="p-6 text-center text-red-500 text-sm">
              Failed to load audit logs. Make sure you are logged in.
            </div>
          )}

          {!isLoading && !isError && logs.length === 0 && (
            <div className="p-12 text-center text-muted-foreground text-sm">
              No audit log entries yet. Actions like creating, editing, or deleting articles will appear here.
            </div>
          )}

          {logs.length > 0 && (
            <div className="divide-y">
              {logs.map((log) => (
                <div key={log.id} className="flex items-center gap-4 px-6 py-3 hover:bg-muted/30 transition-colors">
                  <div className="flex-shrink-0 w-20">
                    <ActionBadge action={log.action} />
                  </div>
                  <div className="flex-shrink-0 w-24">
                    <ResourceBadge type={log.resource_type} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{log.resource_title || log.resource_id}</p>
                    {log.detail && (
                      <p className="text-xs text-muted-foreground">{log.detail}</p>
                    )}
                  </div>
                  <div className="flex-shrink-0 text-xs text-muted-foreground whitespace-nowrap">
                    {format(new Date(log.created_at), 'MMM d, yyyy · HH:mm')}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}
