import { connect, isConnected } from './freeswitch/connection.js';
import { ensureInConference } from './freeswitch/registration.js';
import { initiateCall, canInitiateCall, lockCalls, unlockCalls } from './freeswitch/callGate.js';
import {
    hangupCall,
    conferenceKick,
    muteUser,
    unmuteUser,
    muteByMemberId,
    unmuteByMemberId,
    honkRoom,
    getConferenceList,
} from './freeswitch/callAction.js';
import { showMessage, sendCommands, sendActionUri, playTone, stopTone } from './freeswitch/notifications.js';
import { getTalkingUsers } from './freeswitch/callEvents.js';
import './freeswitch/broadcast.js';
import './freeswitch/onlineSync.js';
import './freeswitch/fsLogService.js';
import './freeswitch/directCall.js';
import './freeswitch/autoMute.js';

const freeswitch = {};

freeswitch.isConnected = isConnected;
freeswitch.connect = connect;
freeswitch.hangupCall = hangupCall;
freeswitch.conferenceKick = conferenceKick;
freeswitch.muteUser = muteUser;
freeswitch.unmuteUser = unmuteUser;
freeswitch.muteByMemberId = muteByMemberId;
freeswitch.unmuteByMemberId = unmuteByMemberId;
freeswitch.honkRoom = honkRoom;
freeswitch.showMessage = showMessage;
freeswitch.sendCommands = sendCommands;
freeswitch.sendActionUri = sendActionUri;
freeswitch.playTone = playTone;
freeswitch.stopTone = stopTone;
freeswitch.getConferenceList = getConferenceList;
freeswitch.ensureInConference = ensureInConference;
freeswitch.initiateCall = initiateCall;
freeswitch.canInitiateCall = canInitiateCall;
freeswitch.getTalkingUsers = getTalkingUsers;

export default { freeswitch };
