import { useEffect, useState } from 'react';
import { Gauge, Clock, Wallet, PiggyBank, FileAudio } from 'lucide-react';
import { Layout } from '../components/layout/Layout';
import { Spinner } from '../components/ui/Spinner';
import { EmptyState } from '../components/ui/EmptyState';
import { formatDuration, formatDate } from '../utils/formatters';
import api, { getApiError } from '../services/api';

interface UsageRecording {
  id: string;
  title: string;
  duration: number;
  createdAt: string;
  costUsd: number;
}

interface UsageData {
  totalCreditUsd: number;
  ratePerHour: number;
  usedUsd: number;
  remainingUsd: number;
  percentUsed: number;
  totalDurationSec: number;
  recordings: UsageRecording[];
}

function formatUsd(value: number): string {
  return `$${value.toFixed(2)}`;
}

function formatHours(seconds: number): string {
  const hours = seconds / 3600;
  return `${hours.toFixed(1)} hr`;
}

export function UsagePage() {
  const [data, setData] = useState<UsageData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchUsage = async () => {
      setIsLoading(true);
      setError('');
      try {
        const { data } = await api.get('/usage');
        setData(data);
      } catch (err) {
        setError(getApiError(err));
      } finally {
        setIsLoading(false);
      }
    };
    fetchUsage();
  }, []);

  return (
    <Layout>
      <div className="max-w-4xl mx-auto animate-fade-in">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">AssemblyAI Usage</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Estimated transcription credit usage for this app's API key
          </p>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-16">
            <Spinner size="lg" />
          </div>
        ) : error ? (
          <div className="rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 px-4 py-3 text-red-700 dark:text-red-400 text-sm">
            {error}
          </div>
        ) : data ? (
          <div className="space-y-6">
            {/* Progress bar card */}
            <div className="card p-6">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Gauge className="h-5 w-5 text-primary-600 dark:text-primary-400" />
                  <h2 className="font-semibold text-gray-900 dark:text-white">Credit Usage</h2>
                </div>
                <span className="text-sm font-medium text-gray-500 dark:text-gray-400">
                  {data.percentUsed.toFixed(1)}% used
                </span>
              </div>

              <div className="h-3 w-full rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    data.percentUsed >= 90
                      ? 'bg-red-500'
                      : data.percentUsed >= 70
                      ? 'bg-amber-500'
                      : 'bg-primary-600'
                  }`}
                  style={{ width: `${Math.min(data.percentUsed, 100)}%` }}
                />
              </div>

              <div className="flex items-center justify-between mt-2 text-sm text-gray-500 dark:text-gray-400">
                <span>{formatUsd(data.usedUsd)} used</span>
                <span>{formatUsd(data.totalCreditUsd)} total</span>
              </div>
            </div>

            {/* Stats grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="card p-4 flex flex-col gap-1">
                <div className="flex items-center gap-1.5 text-gray-500 dark:text-gray-400 text-xs font-medium">
                  <Wallet className="h-3.5 w-3.5" />
                  Used
                </div>
                <p className="text-xl font-bold text-gray-900 dark:text-white">{formatUsd(data.usedUsd)}</p>
              </div>
              <div className="card p-4 flex flex-col gap-1">
                <div className="flex items-center gap-1.5 text-gray-500 dark:text-gray-400 text-xs font-medium">
                  <PiggyBank className="h-3.5 w-3.5" />
                  Remaining
                </div>
                <p className="text-xl font-bold text-gray-900 dark:text-white">{formatUsd(data.remainingUsd)}</p>
              </div>
              <div className="card p-4 flex flex-col gap-1">
                <div className="flex items-center gap-1.5 text-gray-500 dark:text-gray-400 text-xs font-medium">
                  <Clock className="h-3.5 w-3.5" />
                  Audio Transcribed
                </div>
                <p className="text-xl font-bold text-gray-900 dark:text-white">{formatHours(data.totalDurationSec)}</p>
              </div>
              <div className="card p-4 flex flex-col gap-1">
                <div className="flex items-center gap-1.5 text-gray-500 dark:text-gray-400 text-xs font-medium">
                  <Gauge className="h-3.5 w-3.5" />
                  Rate
                </div>
                <p className="text-xl font-bold text-gray-900 dark:text-white">${data.ratePerHour.toFixed(2)}/hr</p>
              </div>
            </div>

            {/* Recordings log */}
            <div className="card p-6">
              <h2 className="font-semibold text-gray-900 dark:text-white mb-4">Recording Log</h2>

              {data.recordings.length === 0 ? (
                <EmptyState
                  icon={FileAudio}
                  title="No usage yet"
                  description="Completed transcriptions will appear here with their estimated credit cost."
                />
              ) : (
                <div className="overflow-x-auto -mx-6">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-800">
                        <th className="px-6 py-2 font-medium">Title</th>
                        <th className="px-6 py-2 font-medium">Date</th>
                        <th className="px-6 py-2 font-medium">Duration</th>
                        <th className="px-6 py-2 font-medium text-right">Est. Cost</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                      {data.recordings.map((r) => (
                        <tr key={r.id}>
                          <td className="px-6 py-2.5 text-gray-900 dark:text-white truncate max-w-[14rem]">{r.title}</td>
                          <td className="px-6 py-2.5 text-gray-500 dark:text-gray-400">{formatDate(r.createdAt)}</td>
                          <td className="px-6 py-2.5 text-gray-500 dark:text-gray-400">{formatDuration(r.duration)}</td>
                          <td className="px-6 py-2.5 text-gray-900 dark:text-white text-right font-medium">{formatUsd(r.costUsd)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        ) : null}
      </div>
    </Layout>
  );
}
