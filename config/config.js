const config = {};

config.FREESWITCH_ESL_HOST = process.env.FREESWITCH_ESL_HOST || '127.0.0.1';
config.FREESWITCH_ESL_PORT = parseInt(process.env.FREESWITCH_ESL_PORT) || 8021;
config.FREESWITCH_ESL_PASSWORD = process.env.FREESWITCH_ESL_PASSWORD || 'redline_fs_2024';
config.FREESWITCH_SOFIA_PROFILE = 'internal';
config.FREESWITCH_CONFERENCE_PROFILE = 'redline-hotline';
config.FREESWITCH_PUBLIC_IP = process.env.FREESWITCH_PUBLIC_IP || '50.28.84.57';

config.ROOM_NAME = {
    123456701: 'California',
    123456702: 'Texas',
    123456703: 'Florida',
    123456704: 'Mexico',
    123456705: 'ENS',
    123456706: 'Arizona',
    123456707: 'Ohio',
    123456708: 'New York',
    123456709: 'Georgia',
    123456710: 'Indiana',
    123456711: 'Michigan',
    123456712: 'Carolinas',
};

config.ROOM_SHORT_CODE = {
    123456701: 'CA',
    123456702: 'TX',
    123456703: 'FL',
    123456704: 'MX',
    123456705: 'ENS',
    123456706: 'AZ',
    123456707: 'OH',
    123456708: 'NY',
    123456709: 'GA',
    123456710: 'IN',
    123456711: 'MI',
    123456712: 'CR',
};

config.loginExpireTime = 24 * 60 * 60 * 7; // 7 days

config.USER_VALIDATION_API = process.env.USER_VALIDATION_API || 'https://apis.redlineusedautoparts.com/api/user-info';
config.SIP_DEFAULT_PASSWORD = process.env.SIP_DEFAULT_PASSWORD || '12345678';
config.HONK_AUDIO_FILE = process.env.HONK_AUDIO_FILE || '/root/sorbh/freeswitch_conference/public/redlinehonk.wav';
config.RECORDING_DIR = process.env.RECORDING_DIR || '/root/sorbh/freeswitch_conference/recordings';

export default config;
