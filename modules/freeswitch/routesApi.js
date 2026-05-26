import express from "express";

export let freeswitchRouter = express.Router();

freeswitchRouter.post("/directory", async (req, res) => {
    const { user, domain, action, section } = req.body;

    if (section !== 'directory') {
        return res.type('xml').send(_notFoundXml());
    }

    if (!user || !domain) {
        return res.type('xml').send(_notFoundXml());
    }

    const email = user.includes('.at.') ? user.replace('.at.', '@') : user;
    const account = global.db.getAccountByEmail(email);

    if (!account || !account.active) {
        return res.type('xml').send(_notFoundXml());
    }

    if (action === 'message-count') {
        return res.type('xml').send(_userXml(user, domain, account.password));
    }

    return res.type('xml').send(_userXml(user, domain, account.password));
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
