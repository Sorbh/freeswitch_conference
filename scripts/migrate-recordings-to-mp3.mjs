// Migrate legacy WAV broadcast recordings to 64kbps mono MP3 (~12x smaller).
// Converts every broadcast_log row whose recording_path ends in .wav, updates
// the DB to point at the .mp3, and deletes the WAV (plus its Telegram .ogg
// sibling). Safe to re-run; already-migrated rows are not selected.
//
// Run from the repo root, AFTER deploying the sendFile-based audio endpoints
// (the old endpoints hardcoded Content-Type: audio/wav and would mislabel MP3):
//   node scripts/migrate-recordings-to-mp3.mjs
import Database from 'better-sqlite3';
import { execFileSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const DB_PATH = path.resolve('data/freeswitch_conference.db');
const db = new Database(DB_PATH);
db.pragma('busy_timeout = 5000');

const rows = db.prepare("SELECT id, recording_path FROM broadcast_log WHERE recording_path LIKE '%.wav'").all();
console.log(`Found ${rows.length} WAV recording(s) in broadcast_log`);

const update = db.prepare('UPDATE broadcast_log SET recording_path = ? WHERE id = ?');
let converted = 0, missing = 0, failed = 0, freedBytes = 0;

for (const row of rows) {
    const wav = row.recording_path.startsWith('/') ? row.recording_path : path.resolve(row.recording_path);
    if (!fs.existsSync(wav)) { missing++; continue; }
    const mp3 = wav.replace(/\.wav$/, '.mp3');
    try {
        execFileSync('ffmpeg', ['-y', '-i', wav, '-codec:a', 'libmp3lame', '-b:a', '64k', '-ac', '1', mp3], { stdio: 'pipe', timeout: 120000 });
        const wavSize = fs.statSync(wav).size;
        const mp3Size = fs.statSync(mp3).size;
        update.run(mp3, row.id);
        fs.unlinkSync(wav);
        try { fs.unlinkSync(wav.replace(/\.wav$/, '.ogg')); } catch {}
        freedBytes += wavSize - mp3Size;
        converted++;
        console.log(`#${row.id} ${path.basename(wav)}: ${(wavSize / 1048576).toFixed(1)}MB → ${(mp3Size / 1024).toFixed(0)}KB`);
    } catch (e) {
        failed++;
        try { fs.unlinkSync(mp3); } catch {}
        console.error(`#${row.id} FAILED (WAV kept): ${e.message}`);
    }
}

console.log(`\nDone: ${converted} converted, ${missing} file-missing (skipped), ${failed} failed, ${(freedBytes / 1048576).toFixed(1)}MB freed`);
db.close();
