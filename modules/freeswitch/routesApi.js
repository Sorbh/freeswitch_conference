import express from "express";

export let freeswitchRouter = express.Router();

freeswitchRouter.post("/directory", async (req, res) => {
    const { user, domain, action, section, sip_auth_username } = req.body;
    // console.log(`[XML-CURL] section=${section} action=${action} user=${user} auth_user=${sip_auth_username} domain=${domain}`);

    if (section !== 'directory') {
        return res.type('xml').send(_notFoundXml());
    }

    if (!user || !domain) {
        return res.type('xml').send(_notFoundXml());
    }

    // Build candidate emails from user, sip_auth_username, and user@domain
    const candidates = [user, sip_auth_username].filter(Boolean);
    let account = null;
    let resolvedUser = user;

    for (const candidate of candidates) {
        // Try .at. decoding (web client format)
        const email = candidate.includes('.at.') ? candidate.replace('.at.', '@') : candidate;
        account = global.db.getAccountByEmail(email);
        if (account && account.active) {
            resolvedUser = candidate;
            // console.log(`[XML-CURL] matched email=${email} via candidate=${candidate}`);
            break;
        }
        // Try user@domain (Yealink sends user=er.sorbh domain=gmail.com)
        if (domain && domain !== '50.28.84.57') {
            const fullEmail = `${candidate}@${domain}`;
            account = global.db.getAccountByEmail(fullEmail);
            if (account && account.active) {
                resolvedUser = candidate;
                // console.log(`[XML-CURL] matched email=${fullEmail} via user@domain`);
                break;
            }
        }
        account = null;
    }

    if (!account) {
        // No match — return a dummy user so FreeSWITCH sends 401 challenge instead of 403
        // The challenge will make the phone re-send with proper auth credentials
        // console.log(`[XML-CURL] no account found, returning challenge-able dummy for user=${user}`);
        return res.type('xml').send(_userXml(user, domain, '__challenge_dummy_' + Date.now()));
    }

    if (action === 'message-count') {
        return res.type('xml').send(_userXml(resolvedUser, domain, account.password));
    }

    return res.type('xml').send(_userXml(resolvedUser, domain, account.password));
});

function _userXml(user, domain, password) {
    return `<?xml version="1.0" encoding="UTF-8"?>
<document type="freeswitch/xml">
  <section name="directory">
    <domain name="${domain}">
      <params>
        <param name="dial-string" value="{presence_id=\${dialed_user}@\${dialed_domain}}\${sofia_contact(\${dialed_user}@\${dialed_domain})}"/>
      </params>
      <user id="${user}">
        <params>
          <param name="password" value="${password}"/>
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
