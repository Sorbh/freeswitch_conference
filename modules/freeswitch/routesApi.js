import express from "express";

export let freeswitchRouter = express.Router();

freeswitchRouter.post("/directory", async (req, res) => {
    const { user, domain, purpose, action, section } = req.body;

    console.log(`FS Directory request: user=${user} domain=${domain} purpose=${purpose} action=${action} section=${section}`);

    // Only handle directory lookups — let FreeSWITCH use its own XML for dialplan and configuration
    if (section !== 'directory') {
        return res.type('xml').send(_notFoundXml());
    }

    if (!user || !domain) {
        return res.type('xml').send(_notFoundXml());
    }

    // message-count is a voicemail check — just return the user if they exist
    if (action === 'message-count') {
        const email = user.includes('.at.') ? user.replace('.at.', '@') : user;
        const existingUser = global.db.getUserInfo(`sip:${email}`);
        if (Object.keys(existingUser).length > 0) {
            return res.type('xml').send(_userXml(user, domain, global.config.SIP_DEFAULT_PASSWORD));
        }
        return res.type('xml').send(_notFoundXml());
    }

    // Reconstruct full email from SIP username
    // Yealink phones send email directly as user part (e.g. user=applericardo.redline@gmail.com)
    // Browser clients encode @ as .at. (e.g. user=applericardo.redline.at.gmail.com)
    let email = user;
    if (email.includes('.at.')) {
        email = email.replace('.at.', '@');
    }

    try {
        // Check if user already exists in our DB
        const existingUser = global.db.getUserInfo(`sip:${email}`);
        if (Object.keys(existingUser).length > 0) {
            console.log(`FS Directory: returning cached user ${email}`);
            return res.type('xml').send(_userXml(user, domain, global.config.SIP_DEFAULT_PASSWORD));
        }

        // Validate against Redline API
        const apiResponse = await (await fetch(`${global.config.USER_VALIDATION_API}?email=${email}`)).json();

        if (!apiResponse.status) {
            console.log(`FS Directory: user ${email} not found in API`);
            return res.type('xml').send(_notFoundXml());
        }

        console.log(`FS Directory: user ${email} validated, returning credentials`);
        return res.type('xml').send(_userXml(user, domain, global.config.SIP_DEFAULT_PASSWORD));

    } catch (err) {
        console.error(`FS Directory error for ${email}: ${err.message}`);
        return res.type('xml').send(_notFoundXml());
    }
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
