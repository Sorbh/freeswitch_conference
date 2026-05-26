import { connect, isConnected } from './freeswitch/connection.js';
import { ensureInConference } from './freeswitch/registration.js';
import { initiateCall, canInitiateCall, lockCalls, unlockCalls } from './freeswitch/callGate.js';
import {
    hangupCall,
    muteUser,
    unmuteUser,
    honkRoom,
    getConferenceList,
} from './freeswitch/callAction.js';
import { showMessage, sendCommands, sendActionUri } from './freeswitch/notifications.js';
import './freeswitch/callEvents.js';
import './freeswitch/broadcast.js';
import './freeswitch/onlineSync.js';

const freeswitch = {};

freeswitch.isConnected = isConnected;
freeswitch.connect = connect;
freeswitch.hangupCall = hangupCall;
freeswitch.muteUser = muteUser;
freeswitch.unmuteUser = unmuteUser;
freeswitch.honkRoom = honkRoom;
freeswitch.showMessage = showMessage;
freeswitch.sendCommands = sendCommands;
freeswitch.sendActionUri = sendActionUri;
freeswitch.getConferenceList = getConferenceList;
freeswitch.ensureInConference = ensureInConference;
freeswitch.initiateCall = initiateCall;
freeswitch.canInitiateCall = canInitiateCall;

export default { freeswitch };
