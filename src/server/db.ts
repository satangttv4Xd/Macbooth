import fs from 'fs';
import path from 'path';
import { LeaderboardEntry, BoothStats, AdminSettings, PlayerSession } from './types.js';

const DB_DIR = path.resolve(process.cwd(), 'database');
const DB_FILE = path.join(DB_DIR, 'macdefender_db.json');

interface DatabaseSchema {
  leaderboard: LeaderboardEntry[];
  sessions: PlayerSession[];
  settings: AdminSettings;
  metrics: {
    totalStarts: number;
    totalCompletions: number;
    totalCompromised: number;
    missionStats: Record<number, { correct: number; wrong: number }>;
  };
}

const DEFAULT_SETTINGS: AdminSettings = {
  timeEasy: 420,       // 7 minutes
  timeNormal: 300,     // 5 minutes
  timeNightmare: 180,  // 3 minutes
  soundDefault: true,
  demoMode: false,
  scoreMultiplier: 1.0,
};

const INITIAL_LEADERBOARD: LeaderboardEntry[] = [
  {
    id: 'seed-1',
    nickname: 'CYBERFOX',
    score: 9850,
    rank: 'S',
    timeFormatted: '03:42',
    timeSeconds: 222,
    threatsBlocked: 6,
    difficulty: 'nightmare',
    completedAt: new Date(Date.now() - 3600000 * 2).toISOString(),
  },
  {
    id: 'seed-2',
    nickname: 'H4CKER_BANE',
    score: 9420,
    rank: 'S',
    timeFormatted: '04:10',
    timeSeconds: 250,
    threatsBlocked: 6,
    difficulty: 'normal',
    completedAt: new Date(Date.now() - 3600000 * 4).toISOString(),
  },
  {
    id: 'seed-3',
    nickname: 'APPLESEC_PRO',
    score: 9100,
    rank: 'S',
    timeFormatted: '04:18',
    timeSeconds: 258,
    threatsBlocked: 5,
    difficulty: 'normal',
    completedAt: new Date(Date.now() - 3600000 * 5).toISOString(),
  },
  {
    id: 'seed-4',
    nickname: 'STEVE_SEC',
    score: 8742,
    rank: 'A',
    timeFormatted: '04:32',
    timeSeconds: 272,
    threatsBlocked: 5,
    difficulty: 'easy',
    completedAt: new Date(Date.now() - 3600000 * 6).toISOString(),
  },
  {
    id: 'seed-5',
    nickname: 'GUEST_99',
    score: 8210,
    rank: 'A',
    timeFormatted: '04:45',
    timeSeconds: 285,
    threatsBlocked: 4,
    difficulty: 'normal',
    completedAt: new Date(Date.now() - 3600000 * 8).toISOString(),
  },
  {
    id: 'seed-6',
    nickname: 'MAC_NINJA',
    score: 7650,
    rank: 'A',
    timeFormatted: '04:55',
    timeSeconds: 295,
    threatsBlocked: 4,
    difficulty: 'easy',
    completedAt: new Date(Date.now() - 3600000 * 10).toISOString(),
  },
];

class StorageEngine {
  private data: DatabaseSchema;

  constructor() {
    this.data = this.load();
  }

  private load(): DatabaseSchema {
    try {
      if (!fs.existsSync(DB_DIR)) {
        fs.mkdirSync(DB_DIR, { recursive: true });
      }
      if (fs.existsSync(DB_FILE)) {
        const raw = fs.readFileSync(DB_FILE, 'utf-8');
        return JSON.parse(raw);
      }
    } catch (e) {
      console.warn('⚠️ Could not load database file, initializing defaults:', e);
    }

    const initial: DatabaseSchema = {
      leaderboard: INITIAL_LEADERBOARD,
      sessions: [],
      settings: DEFAULT_SETTINGS,
      metrics: {
        totalStarts: 127,
        totalCompletions: 89,
        totalCompromised: 38,
        missionStats: {
          1: { correct: 110, wrong: 17 },
          2: { correct: 104, wrong: 23 },
          3: { correct: 95, wrong: 32 },
          4: { correct: 88, wrong: 39 },
          5: { correct: 76, wrong: 51 },
          6: { correct: 89, wrong: 38 },
        },
      },
    };
    this.save(initial);
    return initial;
  }

  private save(dataToSave?: DatabaseSchema) {
    try {
      if (!fs.existsSync(DB_DIR)) {
        fs.mkdirSync(DB_DIR, { recursive: true });
      }
      const data = dataToSave || this.data;
      fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf-8');
    } catch (e) {
      console.error('❌ Failed to save database file:', e);
    }
  }

  // --- Leaderboard Methods ---
  public getLeaderboard(limit = 50): LeaderboardEntry[] {
    return [...this.data.leaderboard]
      .sort((a, b) => b.score - a.score || a.timeSeconds - b.timeSeconds)
      .slice(0, limit);
  }

  public addLeaderboardEntry(entry: Omit<LeaderboardEntry, 'id' | 'completedAt'>): LeaderboardEntry {
    const newEntry: LeaderboardEntry = {
      ...entry,
      id: 'entry-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7),
      completedAt: new Date().toISOString(),
    };
    this.data.leaderboard.push(newEntry);
    this.data.leaderboard.sort((a, b) => b.score - a.score || a.timeSeconds - b.timeSeconds);
    this.data.metrics.totalCompletions += 1;
    this.save();
    return newEntry;
  }

  public resetLeaderboard(): void {
    this.data.leaderboard = [];
    this.save();
  }

  public deleteLeaderboardEntry(id: string): boolean {
    const initialLen = this.data.leaderboard.length;
    this.data.leaderboard = this.data.leaderboard.filter(e => e.id !== id);
    if (this.data.leaderboard.length !== initialLen) {
      this.save();
      return true;
    }
    return false;
  }

  // --- Session & Metrics Methods ---
  public recordGameStart(difficulty: 'easy' | 'normal' | 'nightmare'): void {
    this.data.metrics.totalStarts += 1;
    this.save();
  }

  public recordMissionOutcome(missionIndex: number, isCorrect: boolean): void {
    if (!this.data.metrics.missionStats[missionIndex]) {
      this.data.metrics.missionStats[missionIndex] = { correct: 0, wrong: 0 };
    }
    if (isCorrect) {
      this.data.metrics.missionStats[missionIndex].correct += 1;
    } else {
      this.data.metrics.missionStats[missionIndex].wrong += 1;
    }
    this.save();
  }

  public getStats(): BoothStats {
    const list = this.data.leaderboard;
    const totalScore = list.reduce((acc, curr) => acc + curr.score, 0);
    const avgScore = list.length > 0 ? Math.round(totalScore / list.length) : 0;
    
    const totalSecs = list.reduce((acc, curr) => acc + curr.timeSeconds, 0);
    const avgSecs = list.length > 0 ? Math.round(totalSecs / list.length) : 0;
    const mins = Math.floor(avgSecs / 60);
    const secs = avgSecs % 60;
    const avgTimeStr = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;

    const top = list[0];

    const difficultyDist = {
      easy: list.filter(e => e.difficulty === 'easy').length,
      normal: list.filter(e => e.difficulty === 'normal').length,
      nightmare: list.filter(e => e.difficulty === 'nightmare').length,
    };

    return {
      playersToday: this.data.metrics.totalStarts,
      completed: this.data.metrics.totalCompletions,
      averageScore: avgScore,
      averageTime: avgTimeStr,
      topPlayer: top ? top.nickname : 'None',
      topScore: top ? top.score : 0,
      difficultyDistribution: difficultyDist,
    };
  }

  public getSettings(): AdminSettings {
    return { ...this.data.settings };
  }

  public updateSettings(newSettings: Partial<AdminSettings>): AdminSettings {
    this.data.settings = { ...this.data.settings, ...newSettings };
    this.save();
    return this.data.settings;
  }
}

export const db = new StorageEngine();
