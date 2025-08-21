export type Captions = {
  title: string;
  videoId: string;
  url: string;
  transcript: string; // plain text transcript (no timestamps)
  vtt?: string; // original VTT content when available
  // Optional metadata when available from provider (yt-dlp)
  channel?: string;
  channelId?: string;
  published?: string;    // ISO date string when available
  durationSec?: number;  // total duration in seconds when available
  viewCount?: number;
  likeCount?: number;
  commentCount?: number;
  averageRating?: number;
};

export type Provider = 'claude-cli' | 'codex-cli' | 'ollama';

// Basic type for yt-dlp info.json structure
export interface YtDlpInfo {
  id?: string;
  title?: string;
  channel?: string;
  uploader?: string;
  channel_id?: string;
  uploader_id?: string;
  duration?: number;
  view_count?: number;
  like_count?: number;
  comment_count?: number;
  average_rating?: number;
  upload_date?: string; // YYYYMMDD format
  [key: string]: unknown; // Allow other fields
}
