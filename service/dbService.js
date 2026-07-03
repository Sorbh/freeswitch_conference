// Barrel for the database service. The implementation lives in service/db/
// (one module per domain, shared connection state in db/connection.js).
// Consumers use global.db (assigned in index.js) — the attached names below
// are the public contract and must stay stable.
import { eventEmitter, getTableInfo, getTables, rawQuery } from './db/connection.js';
import { init } from './db/schema.js';
import {
    getUserInfo, setUserInfo, touchLastSeen, updateUserInfo, getAllUserInfo,
    findUserInfo, filter, deleteUserInfo, resetAllConnectionStates,
} from './db/users.js';
import {
    createAccount, getAccountByEmail, getAccountByUserName, getAccountById,
    getAccountByExtension, getAllAccounts, updateAccount,
    getAccountByVerificationToken, getAccountByResetToken, deleteAccount,
    generateReferralCode, getAccountByReferralCode, getReferralCount, getReferrals,
    getActiveAccountsByRoom, setAccountPushPrefs,
} from './db/accounts.js';
import { getAllRooms, getRoom, createRoom, updateRoom, deleteRoom } from './db/rooms.js';
import {
    logBroadcast, getBroadcastStats, getRecentBroadcasts, getPaginatedBroadcasts,
    getHourlyBroadcasts, getTimelineBroadcasts,
    generateBroadcastShareToken, revokeBroadcastShareToken,
    getBroadcastByShareToken, getBroadcastById, getBroadcastByRecordingPath,
    updateBroadcastTranscription, updateBroadcastLocalTranscription, updateBroadcastPartDetails,
} from './db/broadcasts.js';
import {
    logEvent, getEvents, logOnlineStatus, getOnlineHistory, getDashboardStats,
    snapshotRoomCounts, getRoomSnapshots, cleanOldSnapshots, getRoomAvailability,
} from './db/metrics.js';
import {
    getAllNotificationChannels, getNotificationChannel, createNotificationChannel,
    updateNotificationChannel, deleteNotificationChannel,
    incrementNotificationDelivered, getEnabledNotificationChannels,
} from './db/notificationChannels.js';
import {
    getAllAudioAds, getAudioAd, createAudioAd, updateAudioAd, deleteAudioAd,
    logAdPlay, getAdPlayLog, getAdStats, getScheduledAds,
} from './db/audioAds.js';
import {
    getAdminByEmail, getAdminById, getAllAdmins, createAdmin, updateAdmin, deleteAdmin, adminCount,
    saveRefreshToken, getRefreshToken, deleteRefreshToken, deleteRefreshTokensByAdmin, cleanExpiredRefreshTokens,
    getAllApiKeys, getApiKeyByHash, createApiKey, deleteApiKey,
} from './db/adminAuth.js';
import { logDirectCall, updateDirectCall, getDirectCallById, getDirectCalls } from './db/directCalls.js';
import { upsertPushSubscription, deletePushSubscriptionByEndpoint, getPushSubscriptionsByAccount } from './db/push.js';
import { getSetting, setSetting, getSettingsByPrefix, getBlockedUAs, addBlockedUA, removeBlockedUA } from './db/settings.js';
import {
    generateShortCode, createShortUrl, getShortUrlByCode, getAllShortUrls,
    updateShortUrl, deleteShortUrl, incrementShortUrlClicks,
} from './db/shortUrls.js';

const db = {};

db.init = init;
db.getUserInfo = getUserInfo;
db.setUserInfo = setUserInfo;
db.updateUserInfo = updateUserInfo;
db.getAllUserInfo = getAllUserInfo;
db.findUserInfo = findUserInfo;
db.filter = filter;
db.deleteUserInfo = deleteUserInfo;
db.resetAllConnectionStates = resetAllConnectionStates;
db.getTableInfo = getTableInfo;
db.getTables = getTables;
db.rawQuery = rawQuery;
db.eventEmitter = eventEmitter;
db.logEvent = logEvent;
db.getEvents = getEvents;
db.logOnlineStatus = logOnlineStatus;
db.getOnlineHistory = getOnlineHistory;
db.getDashboardStats = getDashboardStats;
db.logBroadcast = logBroadcast;
db.getBroadcastStats = getBroadcastStats;
db.getRecentBroadcasts = getRecentBroadcasts;
db.getPaginatedBroadcasts = getPaginatedBroadcasts;
db.createAccount = createAccount;
db.getAccountByEmail = getAccountByEmail;
db.getAccountByUserName = getAccountByUserName;
db.getAccountById = getAccountById;
db.getAccountByExtension = getAccountByExtension;
db.getAllAccounts = getAllAccounts;
db.updateAccount = updateAccount;
db.deleteAccount = deleteAccount;
db.generateReferralCode = generateReferralCode;
db.getAccountByReferralCode = getAccountByReferralCode;
db.getReferralCount = getReferralCount;
db.getReferrals = getReferrals;
db.getAccountByVerificationToken = getAccountByVerificationToken;
db.getAccountByResetToken = getAccountByResetToken;
db.touchLastSeen = touchLastSeen;
db.getTimelineBroadcasts = getTimelineBroadcasts;
db.getHourlyBroadcasts = getHourlyBroadcasts;
db.getRoomAvailability = getRoomAvailability;
db.snapshotRoomCounts = snapshotRoomCounts;
db.getRoomSnapshots = getRoomSnapshots;
db.cleanOldSnapshots = cleanOldSnapshots;
db.getAllRooms = getAllRooms;
db.getRoom = getRoom;
db.createRoom = createRoom;
db.updateRoom = updateRoom;
db.deleteRoom = deleteRoom;
db.getAllNotificationChannels = getAllNotificationChannels;
db.getNotificationChannel = getNotificationChannel;
db.createNotificationChannel = createNotificationChannel;
db.updateNotificationChannel = updateNotificationChannel;
db.deleteNotificationChannel = deleteNotificationChannel;
db.getEnabledNotificationChannels = getEnabledNotificationChannels;
db.incrementNotificationDelivered = incrementNotificationDelivered;
db.getAllAudioAds = getAllAudioAds;
db.getAudioAd = getAudioAd;
db.createAudioAd = createAudioAd;
db.updateAudioAd = updateAudioAd;
db.deleteAudioAd = deleteAudioAd;
db.logAdPlay = logAdPlay;
db.getAdPlayLog = getAdPlayLog;
db.getAdStats = getAdStats;
db.getScheduledAds = getScheduledAds;
db.generateBroadcastShareToken = generateBroadcastShareToken;
db.revokeBroadcastShareToken = revokeBroadcastShareToken;
db.getBroadcastByShareToken = getBroadcastByShareToken;
db.getBroadcastById = getBroadcastById;
db.upsertPushSubscription = upsertPushSubscription;
db.deletePushSubscriptionByEndpoint = deletePushSubscriptionByEndpoint;
db.getPushSubscriptionsByAccount = getPushSubscriptionsByAccount;
db.getActiveAccountsByRoom = getActiveAccountsByRoom;
db.setAccountPushPrefs = setAccountPushPrefs;

db.logDirectCall = logDirectCall;
db.updateDirectCall = updateDirectCall;
db.getDirectCalls = getDirectCalls;
db.getDirectCallById = getDirectCallById;

db.getSetting = getSetting;
db.setSetting = setSetting;
db.getSettingsByPrefix = getSettingsByPrefix;
db.updateBroadcastTranscription = updateBroadcastTranscription;
db.updateBroadcastLocalTranscription = updateBroadcastLocalTranscription;
db.updateBroadcastPartDetails = updateBroadcastPartDetails;
db.getBroadcastByRecordingPath = getBroadcastByRecordingPath;
db.getAdminByEmail = getAdminByEmail;
db.getAdminById = getAdminById;
db.getAllAdmins = getAllAdmins;
db.createAdmin = createAdmin;
db.updateAdmin = updateAdmin;
db.deleteAdmin = deleteAdmin;
db.adminCount = adminCount;
db.saveRefreshToken = saveRefreshToken;
db.getRefreshToken = getRefreshToken;
db.deleteRefreshToken = deleteRefreshToken;
db.deleteRefreshTokensByAdmin = deleteRefreshTokensByAdmin;
db.cleanExpiredRefreshTokens = cleanExpiredRefreshTokens;
db.getAllApiKeys = getAllApiKeys;
db.getApiKeyByHash = getApiKeyByHash;
db.createApiKey = createApiKey;
db.deleteApiKey = deleteApiKey;

db.getBlockedUAs = getBlockedUAs;
db.addBlockedUA = addBlockedUA;
db.removeBlockedUA = removeBlockedUA;
db.generateShortCode = generateShortCode;
db.createShortUrl = createShortUrl;
db.getShortUrlByCode = getShortUrlByCode;
db.getAllShortUrls = getAllShortUrls;
db.updateShortUrl = updateShortUrl;
db.deleteShortUrl = deleteShortUrl;
db.incrementShortUrlClicks = incrementShortUrlClicks;

export default { db };
