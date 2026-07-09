const config = {};

config.FREESWITCH_ESL_HOST = process.env.FREESWITCH_ESL_HOST || '127.0.0.1';
config.FREESWITCH_ESL_PORT = parseInt(process.env.FREESWITCH_ESL_PORT) || 8021;
config.FREESWITCH_ESL_PASSWORD = process.env.FREESWITCH_ESL_PASSWORD || 'redline_fs_2024';
config.FREESWITCH_SOFIA_PROFILE = 'internal';
config.FREESWITCH_CONFERENCE_PROFILE = 'redline-hotline';
config.FREESWITCH_PUBLIC_IP = process.env.FREESWITCH_PUBLIC_IP || '50.28.84.57';

// Room names and codes are loaded from DB at startup (see dbService._refreshRoomConfig)
config.ROOM_NAME = {};
config.ROOM_SHORT_CODE = {};

config.loginExpireTime = 24 * 60 * 60 * 7; // 7 days

config.TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
config.TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

config.EXTENSION_REQUEST_TO_EMAIL = process.env.EXTENSION_REQUEST_TO_EMAIL || 'er.sorbh@gmail.com';
config.ROOM_REQUEST_TO_EMAIL = process.env.ROOM_REQUEST_TO_EMAIL || config.EXTENSION_REQUEST_TO_EMAIL;
config.SENDGRID_API_KEY = process.env.SENDGRID_API_KEY;
config.SENDGRID_FROM_EMAIL = process.env.SENDGRID_FROM_EMAIL;
config.SENDGRID_FROM_NAME = process.env.SENDGRID_FROM_NAME;
config.CLIENT_APP_URL = process.env.CLIENT_APP_URL || 'https://hotlinehq.online';

config.USER_VALIDATION_API = process.env.USER_VALIDATION_API || 'https://apis.redlineusedautoparts.com/api/user-info';
config.SIP_DEFAULT_PASSWORD = process.env.SIP_DEFAULT_PASSWORD || '12345678';
config.PUBLIC_WSS_URL = process.env.PUBLIC_WSS_URL || 'wss://hotlinehq.online/fs_wss/';
config.HONK_AUDIO_FILE = process.env.HONK_AUDIO_FILE || '/root/sorbh/freeswitch_conference/public/redlinehonk.wav';
config.RECORDING_DIR = process.env.RECORDING_DIR || '/root/sorbh/freeswitch_conference/recordings';

config.WHISPER_CLI = process.env.WHISPER_CLI || '/root/sorbh/freeswitch_conference/whisper_build/build/bin/whisper-cli';
config.WHISPER_MODEL = process.env.WHISPER_MODEL || '/root/sorbh/freeswitch_conference/whisper_build/models/ggml-small.en.bin';

config.VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || '';
config.VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || '';
config.VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:er.sorbh@gmail.com';

export default config;
