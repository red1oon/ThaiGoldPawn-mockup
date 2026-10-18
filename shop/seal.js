// Sealed messages + device-bound keys (spec §16.1 / §20.7). Pure WebCrypto; runs in the page and in node.
//  seal():      ECDH(P-256, ephemeral) -> HKDF-SHA-256 ("tgp-seal-v1") -> AES-256-GCM, AAD = tk|kid_to   (to a registered recipient key)
//  sealCode():  PBKDF2-SHA-256(one-time code, salt = tk) -> AES-256-GCM                                (the FIRST offer, before any key is registered)
// Sign-then-encrypt: the plaintext is the already-signed token, so carriers see only {tk, kid_to, ct}.
(function (root) {
  const nodeCrypto = typeof require === 'function' && typeof module !== 'undefined' ? require('crypto') : null;
  const webcrypto = root.crypto && root.crypto.subtle ? root.crypto : nodeCrypto.webcrypto, subtle = webcrypto.subtle, enc = new TextEncoder(), dec = new TextDecoder();
  const b64 = u8 => { let r = ''; u8.forEach(c => r += String.fromCharCode(c)); return btoa(r); }, unb64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
  const ECDH = { name: 'ECDH', namedCurve: 'P-256' }, INFO = enc.encode('tgp-seal-v1'), PBKDF_ITER = 210000;
  const pubOf = j => ({ kty: j.kty, crv: j.crv, x: j.x, y: j.y });
  const canonPub = j => JSON.stringify({ crv: j.crv, kty: j.kty, x: j.x, y: j.y });
  const hex = buf => [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
  const kidOf = async pub => hex(await subtle.digest('SHA-256', enc.encode(canonPub(pub))));        // key ID = SHA-256 of the public key
  // bound = true: the private key is NON-EXTRACTABLE (cannot be exported or copied out of the device); false: exportable JWK (fallback, warned in the UI)
  async function genEcdh(bound) {
    const k = await subtle.generateKey(ECDH, !bound, ['deriveBits']), pub = await subtle.exportKey('jwk', k.publicKey);
    return { priv: bound ? k.privateKey : await subtle.exportKey('jwk', k.privateKey), pub: pubOf(pub), kid: await kidOf(pub), bound: !!bound };
  }
  const privKey = async p => (p && p.type === 'private') ? p : subtle.importKey('jwk', p, ECDH, false, ['deriveBits']);
  async function aesFrom(secretBits, saltBytes) {
    const hk = await subtle.importKey('raw', secretBits, 'HKDF', false, ['deriveKey']);
    return subtle.deriveKey({ name: 'HKDF', hash: 'SHA-256', salt: saltBytes, info: INFO }, hk, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
  }
  const aad = (tk, kid) => enc.encode(tk + '|' + kid);
  async function seal(plain, toPub, tk) {
    const eph = await subtle.generateKey(ECDH, true, ['deriveBits']), epk = pubOf(await subtle.exportKey('jwk', eph.publicKey)), kidTo = await kidOf(toPub);
    const rk = await subtle.importKey('jwk', pubOf(toPub), ECDH, false, []), bits = await subtle.deriveBits({ name: 'ECDH', public: rk }, eph.privateKey, 256);
    const iv = webcrypto.getRandomValues(new Uint8Array(12)), key = await aesFrom(bits, iv);
    const ct = await subtle.encrypt({ name: 'AES-GCM', iv, additionalData: aad(tk, kidTo) }, key, enc.encode(plain));
    return { v: 1, tk, kid_to: kidTo, epk, iv: b64(iv), ct: b64(new Uint8Array(ct)) };
  }
  async function unseal(env, myPriv, myKid) {
    try {
      if (!env || env.v !== 1 || !env.epk) return { ok: false, why: 'format' };
      if (myKid && env.kid_to !== myKid) return { ok: false, why: 'not-for-me' };
      const bits = await subtle.deriveBits({ name: 'ECDH', public: await subtle.importKey('jwk', pubOf(env.epk), ECDH, false, []) }, await privKey(myPriv), 256), iv = unb64(env.iv);
      return { ok: true, plain: dec.decode(await subtle.decrypt({ name: 'AES-GCM', iv, additionalData: aad(env.tk, env.kid_to) }, await aesFrom(bits, iv), unb64(env.ct))) };
    } catch (e) { return { ok: false, why: 'cannot-open' }; }
  }
  async function codeKey(code, tk, iter) {
    const base = await subtle.importKey('raw', enc.encode(String(code).trim()), 'PBKDF2', false, ['deriveKey']);
    return subtle.deriveKey({ name: 'PBKDF2', hash: 'SHA-256', salt: enc.encode('tgp-offer|' + tk), iterations: iter }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
  }
  async function sealCode(plain, code, tk, iter) {
    iter = iter || PBKDF_ITER; const iv = webcrypto.getRandomValues(new Uint8Array(12));
    const ct = await subtle.encrypt({ name: 'AES-GCM', iv, additionalData: aad(tk, 'code') }, await codeKey(code, tk, iter), enc.encode(plain));
    return { v: 1, tk, kdf: 'PBKDF2-SHA256', iter, iv: b64(iv), ct: b64(new Uint8Array(ct)) };
  }
  async function unsealCode(env, code) {
    try { return { ok: true, plain: dec.decode(await subtle.decrypt({ name: 'AES-GCM', iv: unb64(env.iv), additionalData: aad(env.tk, 'code') }, await codeKey(code, env.tk, env.iter), unb64(env.ct))) }; }
    catch (e) { return { ok: false, why: 'cannot-open' }; }
  }
  // a sealed token travels as one string: "s1." + base64url(JSON envelope)
  // compact wire form (no JSON-in-base64): s1.c.<tk>.<iter>.<iv>.<ct>  (sealed by code)  |  s1.e.<tk>.<kid_to>.<epk.x>.<epk.y>.<iv>.<ct>  (sealed to a key)
  const u = s => s.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''), d = s => s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4);
  const wrap = env => env.kdf ? ['s1', 'c', env.tk, env.iter, u(env.iv), u(env.ct)].join('.') : ['s1', 'e', env.tk, env.kid_to, env.epk.x, env.epk.y, u(env.iv), u(env.ct)].join('.');
  const unwrapEnv = s => {
    try { const p = s.split('.');
      if (p[1] === 'c' && p.length === 6) return { v: 1, tk: p[2], kdf: 'PBKDF2-SHA256', iter: +p[3], iv: d(p[4]), ct: d(p[5]) };
      if (p[1] === 'e' && p.length === 8) return { v: 1, tk: p[2], kid_to: p[3], epk: { kty: 'EC', crv: 'P-256', x: p[4], y: p[5] }, iv: d(p[6]), ct: d(p[7]) };
    } catch (e) {} return null;
  };
  const isSealed = s => typeof s === 'string' && s.startsWith('s1.');
  root.Seal = { genEcdh, kidOf, seal, unseal, sealCode, unsealCode, wrap, unwrapEnv, isSealed, pubOf, PBKDF_ITER };
  if (typeof module !== 'undefined') module.exports = root.Seal;
})(typeof window !== 'undefined' ? window : globalThis);
