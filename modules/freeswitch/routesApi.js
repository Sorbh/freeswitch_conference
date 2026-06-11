import express from "express";
import { createHash } from "crypto";
import { logBlocked } from "../../service/logger.js";

export let freeswitchRouter = express.Router();

const ALLOWED_UA_PATTERNS = ['yealink', 'redline-webclient'];

freeswitchRouter.post("/directory", async (req, res) => {
    const { user, domain, action, section, sip_auth_username, sip_user_agent, sip_auth_realm } = req.body;

    if (section !== 'directory' || !user || !domain) {
        return res.type('xml').send(_notFoundXml());
    }

    if (!_isAllowedRequest(req.body)) {
        logBlocked('UA', `"${sip_user_agent}" user=${user} ip=${req.body.ip}`);
        return res.type('xml').send(_notFoundXml());
    }

    const account = _findAccount(user, sip_auth_username, domain);

    if (!account) {
        return res.type('xml').send(_userXml(user, domain, { password: '__challenge_dummy_' + Date.now() }));
    }

    // For sip_auth: compute a1-hash with the phone's actual realm so digest matches
    // even though the XML domain is always force-register-domain (50.28.84.57)
    if (action === 'sip_auth' && sip_auth_realm && sip_auth_username) {
        const a1 = _md5(`${sip_auth_username}:${sip_auth_realm}:${account.password}`);

        return res.type('xml').send(_userXml(account.resolvedUser, domain, { a1Hash: a1 }));
    }

    return res.type('xml').send(_userXml(account.resolvedUser, domain, { password: account.password }));
});

function _isAllowedRequest(body) {
    const ua = (body.sip_user_agent || '').toLowerCase();
    const viaProto = (body.sip_via_protocol || '').toLowerCase();
    if (!body.sip_user_agent && !body.ip) return true;
    if (viaProto === 'ws' || viaProto === 'wss') return true;
    return ALLOWED_UA_PATTERNS.some(p => ua.includes(p));
}

function _findAccount(user, authUsername, domain) {
    const candidates = [user, authUsername].filter(Boolean);

    // Admin listen user — virtual account for conference monitoring
    for (const candidate of candidates) {
        if (candidate === 'admin-listen') {
            return { password: global.config.SIP_DEFAULT_PASSWORD, active: true, resolvedUser: candidate };
        }
    }

    for (const candidate of candidates) {
        const email = candidate.includes('.at.') ? candidate.replace('.at.', '@') : candidate;
        const account = global.db.getAccountByEmail(email);
        if (account?.active) return { ...account, resolvedUser: candidate };

        if (domain && domain !== '50.28.84.57') {
            const fullEmail = `${candidate}@${domain}`;
            const acct = global.db.getAccountByEmail(fullEmail);
            if (acct?.active) return { ...acct, resolvedUser: candidate };
        }
    }
    return null;
}

function _md5(str) {
    return createHash('md5').update(str).digest('hex');
}

function _userXml(user, domain, creds) {
    const credParam = creds.a1Hash
        ? `<param name="a1-hash" value="${creds.a1Hash}"/>`
        : `<param name="password" value="${creds.password}"/>`;
    return `<?xml version="1.0" encoding="UTF-8"?>
<document type="freeswitch/xml">
  <section name="directory">
    <domain name="${domain}">
      <params>
        <param name="dial-string" value="{presence_id=\${dialed_user}@\${dialed_domain}}\${sofia_contact(\${dialed_user}@\${dialed_domain})}"/>
      </params>
      <user id="${user}">
        <params>
          ${credParam}
        </params>
        <variables>
          <variable name="user_context" value="default"/>
        </variables>
      </user>
    </domain>
  </section>
</document>`;
}

function _notFoundXml() {
    return `<?xml version="1.0" encoding="UTF-8"?>
<document type="freeswitch/xml">
  <section name="result">
    <result status="not found"/>
  </section>
</document>`;
}
