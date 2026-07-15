import React from 'react';
import { motion } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { 
  CheckCircle, XCircle, AlertCircle, RefreshCw, 
  Server, Database, HardDrive, Activity 
} from 'lucide-react';
import { api } from '../api';

function StatusBadge({ status }) {
  if (status === 'ok') return (
    <span className="flex items-center gap-1 text-green-600 text-sm font-medium">
      <CheckCircle className="h-4 w-4" /> OK
    </span>
  );
  if (status === 'error') return (
    <span className="flex items-center gap-1 text-red-600 text-sm font-medium">
      <XCircle className="h-4 w-4" /> Error
    </span>
  );
  return (
    <span className="flex items-center gap-1 text-yellow-600 text-sm font-medium">
      <AlertCircle className="h-4 w-4" /> Degraded
    </span>
  );
}

function MemoryBar({ used, total, label }) {
  const pct = total > 0 ? Math.round((used / total) * 100) : 0;
  const color = pct > 85 ? 'bg-red-500' : pct > 60 ? 'bg-yellow-500' : 'bg-green-500';
  return (
    <div>
      <div className="flex justify-between text-xs text-muted-foreground mb-1">
        <span>{label}</span>
        <span>{used} MB / {total} MB ({pct}%)</span>
      </div>
      <div className="h-2 bg-muted rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full transition-all`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function formatUptime(seconds) {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m ${s}s`;
  return `${m}m ${s}s`;
}

export default function SystemHealth() {
  const { data, isLoading, isError, refetch, isFetching, dataUpdatedAt } = useQuery({
    queryKey: ['system-health'],
    queryFn: () => api.getHealth(),
    refetchInterval: 30000, // auto-refresh every 30s
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
        <h1 className="text-2xl font-bold">System Health</h1>
        <div className="flex items-center gap-3">
          {dataUpdatedAt > 0 && (
            <span className="text-xs text-muted-foreground">
              Last checked: {new Date(dataUpdatedAt).toLocaleTimeString()}
            </span>
          )}
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw className={`h-4 w-4 mr-2 ${isFetching ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {isLoading && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[...Array(4)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-6">
                <div className="h-4 bg-muted rounded w-1/2 mb-3" />
                <div className="h-8 bg-muted rounded w-1/3" />
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {isError && (
        <Card className="border-red-200 bg-red-50 dark:bg-red-950/20">
          <CardContent className="p-6 flex items-center gap-3">
            <XCircle className="h-5 w-5 text-red-500 flex-shrink-0" />
            <div>
              <p className="font-medium text-red-700 dark:text-red-400">Failed to fetch health data</p>
              <p className="text-sm text-red-600 dark:text-red-500">Check your connection or re-authenticate.</p>
            </div>
          </CardContent>
        </Card>
      )}

      {data && (
        <>
          {/* Overall status banner */}
          <Card className={
            data.status === 'ok'
              ? 'border-green-200 bg-green-50 dark:bg-green-950/20'
              : 'border-yellow-200 bg-yellow-50 dark:bg-yellow-950/20'
          }>
            <CardContent className="p-4 flex items-center gap-3">
              {data.status === 'ok'
                ? <CheckCircle className="h-5 w-5 text-green-600" />
                : <AlertCircle className="h-5 w-5 text-yellow-600" />
              }
              <div>
                <p className="font-medium capitalize">
                  System {data.status === 'ok' ? 'Healthy' : 'Degraded'}
                </p>
                <p className="text-xs text-muted-foreground">
                  Response time: {data.responseTimeMs}ms · {new Date(data.timestamp).toLocaleString()}
                </p>
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {/* API Server */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">API Server</CardTitle>
                <Server className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent className="space-y-2">
                <StatusBadge status="ok" />
                <div className="text-sm space-y-1">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Uptime</span>
                    <span className="font-medium">{formatUptime(data.uptime)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Response</span>
                    <span className="font-medium">{data.responseTimeMs}ms</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Database */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Database (Turso)</CardTitle>
                <Database className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent className="space-y-2">
                <StatusBadge status={data.database.status} />
                {data.database.status === 'ok' ? (
                  <div className="text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Latency</span>
                      <span className="font-medium">{data.database.latencyMs}ms</span>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-red-500 break-all">{data.database.error}</p>
                )}
              </CardContent>
            </Card>

            {/* R2 Storage */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Storage (R2)</CardTitle>
                <HardDrive className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent className="space-y-2">
                <StatusBadge status={data.storage.status} />
                {data.storage.status === 'ok' ? (
                  <div className="text-sm space-y-1">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Latency</span>
                      <span className="font-medium">{data.storage.latencyMs}ms</span>
                    </div>
                    <div className="flex justify-between items-start gap-2">
                      <span className="text-muted-foreground flex-shrink-0">Public URL</span>
                      {data.r2PublicUrlConfigured ? (
                        <span className="font-medium text-green-600 text-xs break-all text-right">{data.r2PublicUrl}</span>
                      ) : (
                        <span className="font-medium text-red-500 text-xs">
                          ⚠️ Not set — images won't load publicly. Set R2_PUBLIC_URL in Render env vars.
                        </span>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-1">
                    <p className="text-xs text-red-500 break-all">{data.storage.error}</p>
                    {!data.r2PublicUrlConfigured && (
                      <p className="text-xs text-orange-500">
                        R2_PUBLIC_URL is also not configured — images won't display even if upload works.
                      </p>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Memory */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Memory</CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent className="space-y-4">
              <MemoryBar
                label="Process RSS (resident)"
                used={data.memory.rss}
                total={data.memory.system}
              />
              <MemoryBar
                label="JS Heap Used"
                used={data.memory.heapUsed}
                total={data.memory.heapTotal}
              />
              <MemoryBar
                label="System RAM"
                used={data.memory.system - data.memory.systemFree}
                total={data.memory.system}
              />
              <div className="grid grid-cols-3 gap-4 pt-2 text-center text-sm">
                <div>
                  <p className="text-muted-foreground text-xs">Process RSS</p>
                  <p className="font-bold">{data.memory.rss} MB</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Heap Used</p>
                  <p className="font-bold">{data.memory.heapUsed} MB</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">System Free</p>
                  <p className="font-bold">{data.memory.systemFree} MB</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </motion.div>
  );
}
