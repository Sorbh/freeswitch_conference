import { connect, isConnected } from './freeswitch/connection.js';
import { ensureInConference } from './freeswitch/registration.js';
import {
    originateToConference,
    hangupCall,
    muteUser,
    unmuteUser,
    honkRoom,
    showMessage,
    getConferenceList,
} from './freeswitch/calls.js';
import './freeswitch/broadcast.js';

const freeswitch = {};

freeswitch.isConnected = isConnected;
freeswitch.connect = connect;
freeswitch.originateToConference = originateToConference;
freeswitch.hangupCall = hangupCall;
freeswitch.muteUser = muteUser;
freeswitch.unmuteUser = unmuteUser;
freeswitch.honkRoom = honkRoom;
freeswitch.showMessage = showMessage;
freeswitch.getConferenceList = getConferenceList;
freeswitch.ensureInConference = ensureInConference;

export default { freeswitch };
