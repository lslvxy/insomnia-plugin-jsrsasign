# insomnia-plugin-jsrsasign

An [Insomnia](https://insomnia.rest/) plugin that signs requests using [jsrsasign](https://kjur.github.io/jsrsasign/), supporting RSA, ECDSA, and HMAC algorithms.

## Installation

1. Open Insomnia → **Preferences** → **Plugins**
2. Enter `insomnia-plugin-jsrsasign` and click **Install Plugin**

Or place this directory under:
```
~/Library/Application Support/Insomnia/plugins/insomnia-plugin-jsrsasign/
```
then run `npm install` inside it.

## Usage

### Mode 1 — Auto-sign via environment variables (recommended)

Set the following variables in your Insomnia environment:

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `sign_key` | ✅ | — | PEM private key |
| `sign_alg` | | `SHA256withRSA` | Signing algorithm |
| `sign_header` | | `X-Signature` | Request header to write the signature into |
| `sign_payload` | | request body | Payload string to sign |

**Example environment:**
```json
{
  "sign_key": "-----BEGIN RSA PRIVATE KEY-----\n...\n-----END RSA PRIVATE KEY-----",
  "sign_alg": "SHA256withRSA",
  "sign_header": "X-Signature"
}
```

The plugin signs the request body and writes the base64url-encoded signature into the specified header automatically before each request.

#### Custom payload via pre-request script

If you need to build a custom payload, compute it in the pre-request script and write it to `sign_payload`:

```js
const ts   = Math.floor(Date.now() / 1000).toString();
const path = new URL(insomnia.request.getUrl()).pathname;
insomnia.environment.set('sign_payload',
  insomnia.request.getMethod() + ' ' + path + '\n' +
  insomnia.environment.get('clientId') + '.' + ts + '.' +
  (insomnia.request.getBody().text || ''));
```

### Mode 2 — `sign_script` custom script (advanced)

Set the `sign_script` environment variable to a JS code string. The following variables are injected:

| Variable | Description |
|----------|-------------|
| `sign` | Sign helper (see API below) |
| `rs` | Full jsrsasign library |
| `request` | Insomnia request object |
| `environment` | `{ get(key) }` |
| `insomnia` | `{ environment }` (alias) |

**Example:**
```js
const pk  = environment.get('sign_key');
const sig = sign.rsa(request.getBody().text || '', pk);
request.setHeader('X-Signature', sig);
```

## sign helper API

```js
sign.rsa(payload, privateKeyPem [, alg])
// alg default: 'SHA256withRSA' → returns base64url string

sign.ecdsa(payload, privateKeyPem [, alg])
// alg default: 'SHA256withECDSA' → returns base64url string

sign.hmac(payload, secret [, alg])
// alg default: 'HmacSHA256' → returns hex string

sign.digest(str [, alg])
// alg default: 'sha256' → returns hex string

sign.toBase64url(hexStr)
// converts hex string to base64url string
```

## Debugging

Open **View → Toggle DevTools → Console** in Insomnia to see plugin logs.

## License

[MIT](LICENSE)
