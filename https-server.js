const forge = require('node-forge');
const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

const ROOT = __dirname;
const HTTPS_PORT = 8443;
const HTTP_PORT = 8080;

const MIME = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.fbx': 'application/octet-stream',
    '.mp3': 'audio/mpeg',
    '.m4a': 'audio/mp4',
    '.ogg': 'audio/ogg',
    '.wav': 'audio/wav',
};

function handler(req, res) {
    let url = req.url.split('?')[0];

    // Redirecionar /fps para /
    if (url === '/fps' || url.startsWith('/fps/')) {
        url = url.replace('/fps', '') || '/';
    }

    let filePath = path.join(ROOT, url === '/' ? 'index.html' : url);
    filePath = decodeURIComponent(filePath);
    if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) filePath = path.join(filePath, 'index.html');
    if (!fs.existsSync(filePath)) { res.writeHead(404); res.end('404'); return; }
    const ext = path.extname(filePath).toLowerCase();
    try {
        const data = fs.readFileSync(filePath);
        res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream', 'Access-Control-Allow-Origin': '*' });
        res.end(data);
    } catch (e) { res.writeHead(500); res.end('Error'); }
}

// Gerar certificado com node-forge
const certDir = path.join(ROOT, 'certs');
const keyPath = path.join(certDir, 'key.pem');
const certPath = path.join(certDir, 'cert.pem');

if (!fs.existsSync(keyPath) || !fs.existsSync(certPath)) {
    if (!fs.existsSync(certDir)) fs.mkdirSync(certDir);
    console.log('Gerando certificado SSL...');

    const keys = forge.pki.rsa.generateKeyPair(2048);
    const cert = forge.pki.createCertificate();
    cert.publicKey = keys.publicKey;
    cert.serialNumber = '01';
    cert.validity.notBefore = new Date();
    cert.validity.notAfter = new Date();
    cert.validity.notAfter.setFullYear(cert.validity.notBefore.getFullYear() + 1);

    const attrs = [{ name: 'commonName', value: 'localhost' }];
    cert.setSubject(attrs);
    cert.setIssuer(attrs);

    cert.setExtensions([
        { name: 'basicConstraints', cA: true },
        { name: 'subjectAltName', altNames: [
            { type: 2, value: 'localhost' },
            { type: 7, ip: '127.0.0.1' },
            { type: 7, ip: '192.168.5.54' }
        ]}
    ]);

    cert.sign(keys.privateKey, forge.md.sha256.create());

    fs.writeFileSync(keyPath, forge.pki.privateKeyToPem(keys.privateKey));
    fs.writeFileSync(certPath, forge.pki.certificateToPem(cert));
    console.log('Certificado gerado em certs/');
}

const options = { key: fs.readFileSync(keyPath), cert: fs.readFileSync(certPath) };

https.createServer(options, handler).listen(HTTPS_PORT, '0.0.0.0', () => {
    console.log('');
    console.log('==========================================');
    console.log('  SERVIDOR HTTPS RODANDO!');
    console.log('');
    console.log('  Local:  https://localhost:' + HTTPS_PORT + '/fps');
    console.log('  LAN:    https://192.168.5.54:' + HTTPS_PORT + '/fps');
    console.log('');
    console.log('  Abra no Quest Browser!');
    console.log('==========================================');
});

http.createServer((req, res) => {
    res.writeHead(301, { Location: `https://${req.headers.host}:${HTTPS_PORT}${req.url}` });
    res.end();
}).listen(HTTP_PORT, '0.0.0.0', () => {
    console.log('HTTP redirecionando para HTTPS na porta ' + HTTP_PORT);
});
