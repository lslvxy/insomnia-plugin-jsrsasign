// Insomnia plugin: jsrsasign
// Signs requests using jsrsasign (https://kjur.github.io/jsrsasign/).
//
// ── Mode 1: Auto-sign via environment variables (recommended) ─────────────────
//
//   sign_key      PEM private key (required)
//   sign_alg      Signing algorithm (optional, default: SHA256withRSA)
//   sign_header   Request header to write the signature into (optional, default: X-Signature)
//   sign_payload  Payload string to sign (optional, default: request body text)
//
//   sign_payload can be a static value set directly in the environment, or computed
//   dynamically in a pre-request script and written in:
//     const ts   = Math.floor(Date.now() / 1000).toString();
//     const path = new URL(insomnia.request.getUrl()).pathname;
//     insomnia.environment.set('sign_payload',
//       insomnia.request.getMethod() + ' ' + path + '\n' +
//       insomnia.environment.get('clientId') + '.' + ts + '.' +
//       (insomnia.request.getBody().text || ''));
//
//   Signature output: base64url encoded
//
// ── Mode 2: sign_script custom script (advanced, full control) ───────────────
//
//   Write JS code in the sign_script environment variable. The following
//   variables are injected automatically:
//     sign        – sign helper (see API below)
//     rs          – full jsrsasign library
//     request     – Insomnia request object
//     environment – { get(key) }
//     insomnia    – { environment } (alias)
//
// ── sign helper API ───────────────────────────────────────────────────────────
//
//   sign.rsa(payload, privateKeyPem [, alg])
//     alg default: 'SHA256withRSA'  → returns base64url string
//
//   sign.ecdsa(payload, privateKeyPem [, alg])
//     alg default: 'SHA256withECDSA'  → returns base64url string
//
//   sign.hmac(payload, secret [, alg])
//     alg default: 'HmacSHA256'  → returns hex string
//
//   sign.digest(str [, alg])
//     alg default: 'sha256'  → returns hex string
//
//   sign.toBase64url(hexStr)  → returns base64url string

const rs = require('jsrsasign');

function buildSignHelper() {
  return {
    rsa: function (payload, pem, alg) {
      const s = new rs.crypto.Signature({ alg: alg || 'SHA256withRSA' });
      s.init(pem);
      s.updateString(payload);
      return rs.hextob64u(s.sign());
    },
    ecdsa: function (payload, pem, alg) {
      const s = new rs.crypto.Signature({ alg: alg || 'SHA256withECDSA' });
      s.init(pem);
      s.updateString(payload);
      return rs.hextob64u(s.sign());
    },
    hmac: function (payload, secret, alg) {
      const m = new rs.crypto.Mac({ alg: alg || 'HmacSHA256', pass: secret });
      m.updateString(payload);
      return m.doFinal();
    },
    digest: function (str, alg) {
      return rs.crypto.Util.hashString(str, alg || 'sha256');
    },
    toBase64url: function (hexStr) {
      return rs.hextob64u(hexStr);
    },
  };
}

module.exports.requestHooks = [
  async (context) => {
    const environment = {
      get: function (key) { return context.request.getEnvironmentVariable(key); },
    };
    const request = context.request;
    const insomnia = { environment: environment };
    const sign = buildSignHelper();

    const signScript = environment.get('sign_script');

    try {
      if (signScript) {
        // Mode 2: execute custom sign_script
        console.log('[insomnia-plugin-jsrsasign] Running sign_script');
        const fn = new Function('sign', 'rs', 'request', 'environment', 'insomnia', signScript);
        await fn(sign, rs, request, environment, insomnia);
        console.log('[insomnia-plugin-jsrsasign] sign_script finished');
      } else {
        // Mode 1: auto-sign via environment variables
        const privateKey = environment.get('sign_key');
        if (!privateKey) {
          console.log('[insomnia-plugin-jsrsasign] sign_key not set, skipping');
          return;
        }

        const alg    = environment.get('sign_alg')    || 'SHA256withRSA';
        const header = environment.get('sign_header')  || 'X-Signature';
        const body   = (request.getBody() && request.getBody().text) || '';

        const signPayload = environment.get('sign_payload');
        const payload = (signPayload != null && signPayload !== '') ? signPayload : body;
        if (signPayload) {
          console.log('[insomnia-plugin-jsrsasign] Using sign_payload:', payload);
        }

        console.log('[insomnia-plugin-jsrsasign] Signing with alg:', alg, '→ header:', header);
        console.log('[insomnia-plugin-jsrsasign] Payload:', payload);
        const sig = sign.rsa(payload, privateKey, alg);
        request.setHeader(header, sig);
        console.log('[insomnia-plugin-jsrsasign] Done. ' + header + ':', sig);
      }
    } catch (err) {
      const msg = (err && err.message) ? err.message : String(err);
      throw new Error('[insomnia-plugin-jsrsasign] ' + msg);
    }
  },
];