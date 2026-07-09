const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const PORT = 443;
const HTTP_PORT = 80;
const ROOT = __dirname;

const MIME = {
    '.html': 'text/html',
    '.js': 'application/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.fbx': 'application/octet-stream',
    '.glb': 'model/gltf-binary',
    '.gltf': 'model/gltf+json',
    '.mp3': 'audio/mpeg',
    '.ogg': 'audio/ogg',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
};

function handler(req, res) {
    let filePath = path.join(ROOT, req.url === '/' ? 'index.html' : req.url);
    filePath = decodeURIComponent(filePath);

    if (!fs.existsSync(filePath)) {
        res.writeHead(404);
        res.end('Not Found');
        return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME[ext] || 'application/octet-stream';

    fs.readFile(filePath, (err, data) => {
        if (err) {
            res.writeHead(500);
            res.end('Error');
            return;
        }
        res.writeHead(200, { 'Content-Type': contentType });
        res.end(data);
    });
}

// Gerar certificado auto-assinado se não existir
const certDir = path.join(ROOT, 'certs');
const keyPath = path.join(certDir, 'key.pem');
const certPath = path.join(certDir, 'cert.pem');

if (!fs.existsSync(keyPath) || !fs.existsSync(certPath)) {
    console.log('Gerando certificado auto-assinado...');
    if (!fs.existsSync(certDir)) fs.mkdirSync(certDir);

    try {
        execSync(`openssl req -x509 -newkey rsa:2048 -keyout "${keyPath}" -out "${certPath}" -days 365 -nodes -subj "/CN=localhost"`, { stdio: 'inherit' });
        console.log('Certificado gerado!');
    } catch (e) {
        console.log('OpenSSL não encontrado. Tentando com Node...');
        // Fallback: usar mkcert ou gerar manualmente
        try {
            execSync(`npx --yes mkcert -install && npx mkcert localhost`, { cwd: certDir, stdio: 'inherit' });
        } catch (e2) {
            console.error('Não foi possível gerar certificado. Use HTTP.');
            console.error('Ou instale o mkcert: https://github.com/FiloSottile/mkcert');
        }
    }
}

// Servidor HTTPS
if (fs.existsSync(keyPath) && fs.existsSync(certPath)) {
    const options = {
        key: fs.readFileSync(keyPath),
        cert: fs.readFileSync(certPath)
    };

    https.createServer(options, handler).listen(PORT, '0.0.0.0', () => {
        console.log(`\n========================================`);
        console.log(`  HTTPS: https://localhost:${PORT}/fps`);
        console.log(`  LAN:   https://192.168.5.54:${PORT}/fps`);
        console.log(`========================================\n`);
    });
}

// Servidor HTTP (fallback)
http.createServer(handler).listen(HTTP_PORT, '0.0.0.0', () => {
    console.log(`HTTP: http://192.168.5.54:${HTTP_PORT}/fps`);
});
