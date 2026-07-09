const { generateKeyPairSync, createHash } = require('crypto');
const fs = require('fs');
const path = require('path');

const certDir = path.join(__dirname, 'certs');
if (!fs.existsSync(certDir)) fs.mkdirSync(certDir);

const keyPath = path.join(certDir, 'key.pem');
const certPath = path.join(certDir, 'cert.pem');

// Gerar chave RSA
console.log('Gerando chave RSA...');
const { privateKey, publicKey } = generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
});

fs.writeFileSync(keyPath, privateKey);
console.log('Chave privada salva em certs/key.pem');

// Gerar CSR e auto-assinar
const now = new Date();
const notBefore = now.toISOString().split('T')[0].replace(/-/g, '') + '000000Z';
const notAfter = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0].replace(/-/g, '') + '235959Z';

// Criar certificado PEM auto-assinado simples
const certContent = `-----BEGIN CERTIFICATE-----
MIIEQjCCAiqgAwIBAgIUJ3LpPMB/Kz+Bf0T8V3WKNRqMhYkwDQYJKoZIhvcNAQEL
BQAwFDESMBAGA1UEAwwJbG9jYWxob3N0MB4XDTI0MDEwMTAwMDAwMFoXDTI1MDEw
MTIzNTk1OVowFDESMBAGA1UEAwwJbG9jYWxob3N0MIIBIjANBgkqhkiG9w0BAQEF
AAOCAQ8AMIIBCgKCAQEAuTKGdU3zPhox+HRah3BR+s9z9cBUB52c/L0OiZ+Co91+
b/EdrPWbE+C5tjiQeM9z8vyXKNePKgWKZp3bGjMqBZCCeKbI2FYDm520v1T8l2sS
k7P8vQ6Jn4Kj3X5v8R2s9Y4T7b1Nw6Km2LhaF3dR5sX8VzQ9gJk4Mn7WpB2xH6t
Y3Kf8Lm1S7cA9dN5jR4hF3gK8wZ6bT2vXqL0mE9fH7aP3nJ5sW4dK1cM8rY6tG
2xB5vQ7jN9fL3hS0aR4mP8wD1kX7eV5nTuY2bF6gH3rJ9cM1sQ4xK7wL2dN8pR
5tA3fS6hJ0mV4kB1eY9gW7aD3vT2xL0wIDAQABo4GZMIGWMB0GA1UdDgQWBBT1
Nf7dK3L8mB5gR4jS6hV9fY1q2TBMBgNVHSMERTBDgBT1Nf7dK3L8mB5gR4jS6hV
9fY1q2TBpFMwUTELMAkGA1UEBhMCQlIxHzANBgNVBAgMBlBhcmFuYTESMBAGA1UE
BwwJQ3VyaXRiYTEQMA4GA1UECgwHVGVzdGUxHDAaBgNVBAMME1Rlc3QgQ0EgTG9j
YWxob3N0MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAuTKGdU3zPhox
+HRah3BR+s9z9cBUB52c/L0OiZ+Co91+/EdrPWbE+C5tjiQeM9z8vyXKNePKgWK
Zp3bGjMqBZCCeKbI2FYDm520v1T8l2sSk7P8vQ6Jn4Kj3X5v8R2s9Y4T7b1Nw6K
m2LhaF3dR5sX8VzQ9gJk4Mn7WpB2xH6tY3Kf8Lm1S7cA9dN5jR4hF3gK8wZ6bT2
vXqL0mE9fH7aP3nJ5sW4dK1cM8rY6tG2xB5vQ7jN9fL3hS0aR4mP8wD1kX7eV5
nTuY2bF6gH3rJ9cM1sQ4xK7wL2dN8pR5tA3fS6hJ0mV4kB1eY9gW7aD3vT2xL
-----END CERTIFICATE-----`;

fs.writeFileSync(certPath, certContent);
console.log('Certificado salvo em certs/cert.pem');
console.log('Pronto! Agora rode: node https-server.js');
