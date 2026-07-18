// Smart Transcription — local-first, cloud-fallback pipeline.
//
// Goal: extract Year/Make/Model/Part from every broadcast at minimum cost.
// Local Whisper is free and fast; cloud STT (Deepgram/OpenRouter) is accurate
// but costs money. We only pay for cloud when local can't get the job done.
//
// Pipeline (processBroadcastTranscription)
// ┌────┬──────────────────────────────────┬──────────────────────────────────────┐
// │ #  │ Step                             │ Condition                            │
// ├────┼──────────────────────────────────┼──────────────────────────────────────┤
// │ 1  │ Local Whisper (whisper.cpp)      │ Always runs (free, fast)             │
// │ 2  │ Extract Y/M/M from local text   │ If text has year/number pattern      │
// │ 3  │ ✓ Done — skip cloud STT         │ If Y/M/M extraction is valid         │
// │ 4  │ Cloud STT (Deepgram/OpenRouter)  │ Only if #2 failed AND               │
// │    │                                  │   global stt_enabled = true AND      │
// │    │                                  │   provider API key configured AND    │
// │    │                                  │   room.auto_transcribe = true        │
// │ 5  │ Extract Y/M/M from cloud text   │ If cloud text has year/number pattern│
// └────┴──────────────────────────────────┴──────────────────────────────────────┘
//
// Decision flow
// ┌─────────────────────┐
// │ Broadcast finalized │
// │ recording saved     │
// └──────────┬──────────┘
//            │
//            ▼
// ┌─────────────────────┐
// │ 1. Local Whisper     │
// │    (always runs)     │
// └──────────┬──────────┘
//            │
//            ▼
// ┌─────────────────────┐    valid Y/M/M    ┌──────────────────┐
// │ 2. Extract parts    │ ────────────────▶ │ ✓ Done           │
// │    from local text  │                   │ skip cloud STT   │
// └──────────┬──────────┘                   └──────────────────┘
//            │ extraction failed / incomplete
//            ▼
//   ┌── room.auto_transcribe ──┐
//   │  AND stt_enabled         │
//   │  AND API key set?        │
//   └──────────┬───────────────┘
//         no   │   yes
//         │    │
//         ▼    ▼
//  ┌────────┐ ┌─────────────────────┐
//  │ Done   │ │ 4. Cloud STT        │
//  │ (local │ │ (Deepgram/OpenRouter)│
//  │  only) │ └──────────┬──────────┘
//  └────────┘            │
//                        ▼
//              ┌─────────────────────┐
//              │ 5. Extract parts    │
//              │    from cloud text  │
//              └─────────────────────┘
//
// Settings gates
// ┌────────────────────────┬──────────────────────────────────────────────────┐
// │ Setting                │ Effect                                           │
// ├────────────────────────┼──────────────────────────────────────────────────┤
// │ stt_enabled (global)   │ Master switch for all cloud STT                  │
// │ stt_provider           │ 'deepgram' or 'openrouter'                       │
// │ stt_*_api_key          │ Provider API key (must be set for cloud to run)  │
// │ room.auto_transcribe   │ Per-room toggle for cloud STT fallback           │
// └────────────────────────┴──────────────────────────────────────────────────┘
//
// Storage
// ┌──────────────────────────┬────────────────────────────────────────────────┐
// │ Column                   │ Content                                        │
// ├──────────────────────────┼────────────────────────────────────────────────┤
// │ local_transcription      │ Whisper.cpp output (always populated)          │
// │ has_parts_request        │ 1 if local text contains year/number pattern   │
// │ transcription            │ Cloud STT output (only if fallback triggered)  │
// │ transcription_status     │ processing / completed / failed                │
// │ part_details             │ JSON {year, make, model, trim, part, spec}     │
// └──────────────────────────┴────────────────────────────────────────────────┘

import fs from 'fs';
import { execFile } from 'child_process';
import config from '../config/config.js';
import { logSystem } from './logger.js';
import { pingIndexNow } from './indexnow.js';

function _logSTT(title, lines) {
    console.log('');
    console.log(`┌─ STT ── ${title} ${'─'.repeat(Math.max(1, 44 - title.length))}`);
    for (const line of lines) {
        console.log(`│  ${line}`);
    }
    console.log(`└${'─'.repeat(55)}`);
}

const DEEPGRAM_MODELS = [
    { id: 'nova-3', label: 'Nova 3 (Latest)' },
    { id: 'nova-3-medical', label: 'Nova 3 Medical' },
    { id: 'nova-3-finance', label: 'Nova 3 Finance' },
    { id: 'nova-2', label: 'Nova 2' },
    { id: 'nova-2-phonecall', label: 'Nova 2 Phone Call' },
    { id: 'nova-2-meeting', label: 'Nova 2 Meeting' },
    { id: 'whisper-large', label: 'Whisper Large' },
    { id: 'whisper-medium', label: 'Whisper Medium' },
    { id: 'whisper-small', label: 'Whisper Small' },
];

const OPENROUTER_MODELS = [
    { id: 'openai/whisper-large-v3-turbo', label: 'Whisper Large V3 Turbo' },
    { id: 'openai/whisper-large-v3', label: 'Whisper Large V3' },
    { id: 'openai/whisper-1', label: 'Whisper 1' },
    { id: 'openai/gpt-4o-transcribe', label: 'GPT-4o Transcribe' },
    { id: 'openai/gpt-4o-mini-transcribe', label: 'GPT-4o Mini Transcribe' },
    { id: 'google/chirp-3', label: 'Google Chirp 3' },
    { id: 'microsoft/mai-transcribe-1.5', label: 'Microsoft MAI Transcribe 1.5' },
    { id: 'nvidia/parakeet-tdt-0.6b-v3', label: 'NVIDIA Parakeet V3' },
];

export { DEEPGRAM_MODELS, OPENROUTER_MODELS };

// Domain-specific vocabulary for auto parts / salvage yard voice network.
// Deepgram: keyterm parameter boosts recognition of these words.
// OpenRouter/Whisper: initial_prompt primes the decoder with domain context.
const AUTO_PARTS_KEYTERMS = [
    'engine', 'transmission', 'alternator', 'radiator', 'compressor',
    'catalytic converter', 'fender', 'bumper', 'hood', 'trunk',
    'door', 'quarter panel', 'headlight', 'taillight', 'mirror',
    'axle', 'differential', 'transfer case', 'ECU', 'ECM', 'PCM',
    'strut', 'caliper', 'rotor', 'wheel', 'rim', 'tire',
    'intake manifold', 'exhaust manifold', 'turbo', 'supercharger',
    'AC compressor', 'condenser', 'evaporator', 'blower motor',
    'starter', 'flywheel', 'torque converter', 'CV axle',
    'power steering pump', 'rack and pinion', 'steering column',
    'VIN', 'OEM', 'aftermarket', 'pull-a-part', 'junkyard', 'salvage',
    'Ford', 'Chevy', 'Chevrolet', 'Dodge', 'Ram', 'GMC', 'Toyota',
    'Honda', 'Nissan', 'Hyundai', 'Kia', 'Jeep', 'Chrysler', 'Buick',
    'Cadillac', 'Lincoln', 'BMW', 'Mercedes', 'Audi', 'Volkswagen',
    'Subaru', 'Mazda', 'Lexus', 'Acura', 'Infiniti',
    'Camry', 'Accord', 'Civic', 'Corolla', 'F-150', 'Silverado',
    'Sierra', 'Tacoma', 'Tundra', 'Mustang', 'Camaro', 'Challenger',
    'Wrangler', 'Grand Cherokee', 'Explorer', 'Tahoe', 'Suburban',
];

const WHISPER_PROMPT = 'This is audio from a used auto parts and salvage yard voice network. '
    + 'Focus on accurately transcribing vehicle make, model, year, trim, and part names. '
    + 'Speakers may refer to vehicles informally (e.g. "I got a 2012 Ford truck" or "need a tranny for an 06 Tahoe"). '
    + 'Common terms: engine, transmission, alternator, radiator, fender, bumper, catalytic converter, '
    + 'ECU, CV axle, transfer case, quarter panel, compressor, condenser, strut, caliper, rotor.';

function _getSettings() {
    const s = global.db.getSettingsByPrefix('stt_');
    return {
        enabled: s.stt_enabled === '1',
        provider: s.stt_provider || 'deepgram',
        deepgramApiKey: s.stt_deepgram_api_key || '',
        deepgramModel: s.stt_deepgram_model || 'nova-3',
        openrouterApiKey: s.stt_openrouter_api_key || '',
        openrouterModel: s.stt_openrouter_model || 'openai/whisper-large-v3-turbo',
        language: s.stt_language || 'en',
    };
}

async function _deepgramTranscribe(filePath, apiKey, model, language) {
    const audioData = await fs.promises.readFile(filePath);
    const params = new URLSearchParams({
        model,
        smart_format: 'true',
        punctuate: 'true',
        paragraphs: 'true',
        language,
    });
    // Add automotive domain keyterms for vocabulary boosting
    for (const term of AUTO_PARTS_KEYTERMS) {
        params.append('keywords', `${term}:2`);
    }

    const url = `https://api.deepgram.com/v1/listen?${params}`;
    const startMs = Date.now();

    const res = await fetch(url, {
        method: 'POST',
        headers: {
            'Authorization': `Token ${apiKey}`,
            'Content-Type': filePath.endsWith('.mp3') ? 'audio/mpeg' : 'audio/wav',
        },
        body: audioData,
    });

    const elapsedMs = Date.now() - startMs;

    if (!res.ok) {
        const text = await res.text();
        _logSTT(`Deepgram ── ${model}`, [
            `API ${res.status} FAILED in ${elapsedMs}ms`,
            text.slice(0, 200),
        ]);
        throw new Error(`Deepgram API error ${res.status}: ${text}`);
    }

    const result = await res.json();
    const transcript = result.results?.channels?.[0]?.alternatives?.[0]?.transcript || '';
    const confidence = result.results?.channels?.[0]?.alternatives?.[0]?.confidence;
    const durationSec = result.metadata?.duration;

    _logSTT(`Deepgram ── ${model}`, [
        `file: ${filePath.split('/').pop()}`,
        `audio: ${durationSec ? durationSec.toFixed(1) + 's' : 'unknown'} │ lang: ${language} │ keywords: ${AUTO_PARTS_KEYTERMS.length}`,
        `API ${res.status} OK in ${elapsedMs}ms │ confidence: ${confidence ? (confidence * 100).toFixed(1) + '%' : 'n/a'}`,
        `result: ${transcript.length} chars${transcript.length > 0 ? ' │ "' + transcript.slice(0, 80) + (transcript.length > 80 ? '…"' : '"') : ''}`,
    ]);

    return transcript;
}

async function _openrouterTranscribe(filePath, apiKey, model, language) {
    const audioData = await fs.promises.readFile(filePath);
    const base64Audio = audioData.toString('base64');
    const startMs = Date.now();

    const res = await fetch('https://openrouter.ai/api/v1/audio/transcriptions', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            model,
            file: base64Audio,
            language,
            prompt: WHISPER_PROMPT,
        }),
    });

    const elapsedMs = Date.now() - startMs;

    if (!res.ok) {
        const text = await res.text();
        _logSTT(`OpenRouter ── ${model}`, [
            `API ${res.status} FAILED in ${elapsedMs}ms`,
            text.slice(0, 200),
        ]);
        throw new Error(`OpenRouter API error ${res.status}: ${text}`);
    }

    const result = await res.json();
    const transcript = result.text || '';
    const usage = result.usage;

    _logSTT(`OpenRouter ── ${model}`, [
        `file: ${filePath.split('/').pop()}`,
        `lang: ${language} │ prompt: ${WHISPER_PROMPT.length} chars`,
        `API ${res.status} OK in ${elapsedMs}ms${usage?.seconds ? ' │ audio: ' + usage.seconds.toFixed(1) + 's' : ''}${usage?.cost ? ' │ cost: $' + usage.cost.toFixed(4) : ''}`,
        `result: ${transcript.length} chars${transcript.length > 0 ? ' │ "' + transcript.slice(0, 80) + (transcript.length > 80 ? '…"' : '"') : ''}`,
    ]);

    return transcript;
}

export async function transcribeBroadcast(broadcastId) {
    const broadcast = global.db.getBroadcastById(broadcastId);
    if (!broadcast) throw new Error('Broadcast not found');
    if (!broadcast.recording_path || !fs.existsSync(broadcast.recording_path)) {
        throw new Error('Recording file not found');
    }

    const settings = _getSettings();
    if (!settings.enabled) throw new Error('Transcription is disabled');

    const provider = settings.provider;
    const apiKey = provider === 'deepgram' ? settings.deepgramApiKey : settings.openrouterApiKey;
    const model = provider === 'deepgram' ? settings.deepgramModel : settings.openrouterModel;

    if (!apiKey) throw new Error(`No API key configured for ${provider}`);

    const providerName = provider === 'deepgram' ? 'Deepgram' : 'OpenRouter';
    global.db.updateBroadcastTranscription(broadcastId, { status: 'processing', error: null });

    try {
        const transcript = provider === 'deepgram'
            ? await _deepgramTranscribe(broadcast.recording_path, apiKey, model, settings.language)
            : await _openrouterTranscribe(broadcast.recording_path, apiKey, model, settings.language);

        if (!transcript || !transcript.trim()) {
            global.db.updateBroadcastTranscription(broadcastId, {
                transcription: '',
                status: 'completed',
                error: null,
            });
            logSystem('STT', `Broadcast #${broadcastId}: empty transcript (no speech detected) [${providerName} / ${model}]`);
            return '';
        }

        global.db.updateBroadcastTranscription(broadcastId, {
            transcription: transcript,
            status: 'completed',
            error: null,
        });
        return transcript;
    } catch (err) {
        global.db.updateBroadcastTranscription(broadcastId, {
            status: 'failed',
            error: err.message,
        });
        logSystem('STT', `Broadcast #${broadcastId} FAILED [${providerName} / ${model}]: ${err.message}`);
        throw err;
    }
}

export function shouldAutoTranscribe(room) {
    const settings = _getSettings();
    if (!settings.enabled) return false;

    const apiKey = settings.provider === 'deepgram' ? settings.deepgramApiKey : settings.openrouterApiKey;
    if (!apiKey) return false;

    const roomData = global.db.getRoom(room);
    return roomData?.auto_transcribe === 1;
}

export async function transcribeDirectCall(callId) {
    const call = global.db.getDirectCallById(callId);
    if (!call) throw new Error('Direct call not found');
    if (!call.recording_path || !fs.existsSync(call.recording_path)) {
        throw new Error('Recording file not found');
    }

    const settings = _getSettings();
    if (!settings.enabled) throw new Error('Transcription is disabled');

    const provider = settings.provider;
    const apiKey = provider === 'deepgram' ? settings.deepgramApiKey : settings.openrouterApiKey;
    const model = provider === 'deepgram' ? settings.deepgramModel : settings.openrouterModel;

    if (!apiKey) throw new Error(`No API key configured for ${provider}`);

    const providerName = provider === 'deepgram' ? 'Deepgram' : 'OpenRouter';
    global.db.updateDirectCall(callId, { transcription_status: 'processing' });

    try {
        const transcript = provider === 'deepgram'
            ? await _deepgramTranscribe(call.recording_path, apiKey, model, settings.language)
            : await _openrouterTranscribe(call.recording_path, apiKey, model, settings.language);

        global.db.updateDirectCall(callId, {
            transcription: transcript || '',
            transcription_status: 'completed',
        });
        return transcript;
    } catch (err) {
        global.db.updateDirectCall(callId, { transcription_status: 'failed' });
        logSystem('STT', `Direct call #${callId} FAILED [${providerName} / ${model}]: ${err.message}`);
        throw err;
    }
}

export function getAudioSettings() {
    return _getSettings();
}

// ── Local Whisper transcription (whisper.cpp) ──

const NUMBER_WORDS = new Set([
    "zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine",
    "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen",
    "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety",
    "hundred", "thousand"
]);

function checkContainsYearOrNumber(text) {
    if (/\b(1[0-9]{3}|2[0-9]{3})\b|\d/.test(text)) return true;
    const words = text.toLowerCase().split(/\s+/);
    for (const word of words) {
        if (NUMBER_WORDS.has(word)) return true;
    }
    return false;
}

export function whisperTranscribe(audioPath) {
    if (!fs.existsSync(config.WHISPER_CLI)) throw new Error('whisper-cli not found');
    if (!fs.existsSync(config.WHISPER_MODEL)) throw new Error('whisper model not found');
    if (!audioPath || !fs.existsSync(audioPath)) throw new Error('Audio file not found');

    // whisper.cpp only reads WAV — recordings are archived as MP3 after the
    // initial pipeline, so decode to a temp 16kHz WAV for re-transcription.
    if (!audioPath.endsWith('.wav')) {
        const tmpWav = audioPath.replace(/\.[^.]+$/, '') + '_whisper_tmp.wav';
        return new Promise((resolve, reject) => {
            execFile('ffmpeg', ['-y', '-i', audioPath, '-ar', '16000', '-ac', '1', tmpWav], { timeout: 30000 }, (err) => {
                if (err) return reject(new Error(`ffmpeg decode failed: ${err.message}`));
                _whisperRunWav(tmpWav)
                    .then(resolve, reject)
                    .finally(() => { try { fs.unlinkSync(tmpWav); } catch {} });
            });
        });
    }
    return _whisperRunWav(audioPath);
}

function _whisperRunWav(audioPath) {
    const startMs = Date.now();
    return new Promise((resolve, reject) => {
        execFile(config.WHISPER_CLI, [
            '-m', config.WHISPER_MODEL,
            '-f', audioPath,
            '--no-timestamps',
            '-t', '4',
        ], { encoding: 'utf8', timeout: 30000 }, (err, stdout) => {
            if (err) return reject(err);
            const text = (stdout || '').trim();
            const elapsedMs = Date.now() - startMs;
            const hasPartsRequest = checkContainsYearOrNumber(text);

            _logSTT('Whisper Local', [
                `file: ${audioPath.split('/').pop()}`,
                `completed in ${elapsedMs}ms │ parts_request: ${hasPartsRequest}`,
                `result: ${text.length} chars${text.length > 0 ? ' │ "' + text.slice(0, 100) + (text.length > 100 ? '…"' : '"') : ''}`,
            ]);

            resolve({ text, hasPartsRequest, elapsedMs });
        });
    });
}

export async function whisperTranscribeBroadcast(broadcastId) {
    const broadcast = global.db.getBroadcastById(broadcastId);
    if (!broadcast?.recording_path) return null;

    try {
        const result = await whisperTranscribe(broadcast.recording_path);
        global.db.updateBroadcastLocalTranscription(broadcastId, result.text, result.hasPartsRequest);
        return result;
    } catch (err) {
        logSystem('STT', `Whisper local #${broadcastId} FAILED: ${err.message}`);
        return null;
    }
}

export async function processBroadcastTranscription(broadcastId, recordingPath) {
    if (!recordingPath) return { hasPartsRequest: false };

    const row = global.db.getBroadcastByRecordingPath(recordingPath);
    if (!row) return { hasPartsRequest: false };
    const id = row.id;

    // 1. Local whisper first (free, fast)
    let hasPartsRequest = false;
    try {
        const result = await whisperTranscribeBroadcast(id);
        if (result) hasPartsRequest = result.hasPartsRequest;
    } catch (err) {
        logSystem('BCAST', `Whisper failed for #${id}: ${err.message}`);
    }

    // 2. Try part extraction from local transcription
    let partsExtracted = false;
    const afterWhisper = global.db.getBroadcastById(id);
    const localText = afterWhisper?.local_transcription;
    if (localText && localText.length > 10 && checkContainsYearOrNumber(localText)) {
        try {
            await extractPartDetails(id, localText);
            const updated = global.db.getBroadcastById(id);
            const parts = updated?.part_details ? JSON.parse(updated.part_details) : null;
            if (parts && isValidPartRequest(parts)) {
                partsExtracted = true;
                logSystem('BCAST', `#${id}: Y/M/M extracted from local whisper — skipping cloud STT`);
            }
        } catch (err) {
            logSystem('PARTS', `Local extract failed for #${id}: ${err.message}`);
        }
    }

    // 3. Cloud STT fallback — only if local didn't yield valid Y/M/M, and room + global settings allow it
    if (!partsExtracted && shouldAutoTranscribe(row.room)) {
        logSystem('BCAST', `#${id}: local whisper didn't yield Y/M/M — falling back to cloud STT`);
        try {
            await transcribeBroadcast(id);
            const afterCloud = global.db.getBroadcastById(id);
            const cloudText = afterCloud?.transcription;
            if (cloudText && cloudText.length > 10 && checkContainsYearOrNumber(cloudText)) {
                try {
                    await extractPartDetails(id, cloudText);
                } catch (err) {
                    logSystem('PARTS', `Cloud extract failed for #${id}: ${err.message}`);
                }
            }
        } catch (err) {
            logSystem('BCAST', `Cloud STT failed for #${id}: ${err.message}`);
        }
    }

    return { hasPartsRequest };
}

function _pingMarketplaceListing(broadcastId, pd) {
    try {
        const segments = [pd.year, pd.make, pd.model, pd.part]
            .filter(v => v && v !== 'null')
            .map(s => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''));
        const row = global.db.getBroadcastById(broadcastId);
        const room = row?.room ? global.db.getRoom(row.room) : null;
        if (room?.short_code) segments.push(room.short_code.toLowerCase());
        segments.push(String(broadcastId));
        const slug = segments.join('-');
        pingIndexNow(`/parts/${slug}`).catch(() => {});
    } catch {}
}

async function extractPartDetails(broadcastId, text) {
    const url = config.CAPTURE_PART_API || 'http://50.28.84.57:4005/api/v1/ai/capture-partv1';
    const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: text }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    const partDetails = json.data;

    if (partDetails) {
        global.db.updateBroadcastPartDetails(broadcastId, partDetails);
        // Local whisper may have written has_parts_request=0 (e.g. garbage transcript) before
        // cloud STT extracted valid details — without this the listing stays hidden forever.
        if (isValidPartRequest(partDetails)) {
            global.db.markBroadcastHasPartsRequest(broadcastId);
        }
        logSystem('PARTS', `#${broadcastId}: ${partDetails.year || '?'} ${partDetails.make || '?'} ${partDetails.model || '?'} ${partDetails.part || '?'}`);
        _pingMarketplaceListing(broadcastId, partDetails);
    } else {
        logSystem('PARTS', `#${broadcastId}: no part details returned`);
    }
}

function isValidPartRequest(data) {
    for (const field of ['year', 'make', 'model', 'part']) {
        const value = data[field];
        if (!value || typeof value !== 'string' || value.trim() === '' || ['null', 'not available'].includes(value.trim().toLowerCase())) {
            return false;
        }
    }
    return true;
}

export { checkContainsYearOrNumber };
