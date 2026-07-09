# Floresta Sombria - FPS VR

Jogo de tiro em primeira pessoa (FPS) com suporte a realidade virtual, otimizado para Meta Quest 2 via browser. Tema de terror com menu atmosferico, musica dinamica e gameplay completa.

**Versao atual: v1.0.2**

---

## Changelog

### v1.0.2 (2026-07-09)
- **4 novos monstros**: Zumbi, Lobisomem, Demo e Fantasma
- **Habilidades unicas**: Lobisomem salta, Demo lança fogo, Fantasma flutua
- **Sons ambientais**: Rugidos aleatorios dos monstros na floresta
- **24 inimigos total**: 12 soldados + 12 monstros

### v1.0.1 (2026-07-09)
- **Nova arma: Faca** (corpo a corpo, dano 50, alcance 2m, municao infinita)
- **Texturas de arvores reais**: Troncos com BarkDecidious, copas com Leaves0120
- **Flash corrigido**: Offset (-0.03 left, +0.04 up) para alinhar com cano
- **Luz verde removida**: PointLight(0x00ff88) removida da arma
- **VR weapon switch**: Botao A/X no controller esquerdo troca entre armas
- **Muzzle flash dinamico**: Usa matrix do controller (VR) ou camera (desktop)

### v1.0.0 (2026-07-08)
- Release inicial

---

## 1. Pre-requisitos

| Software | Versao Minima | Onde Baixar |
|---|---|---|
| Node.js | 16+ | https://nodejs.org |
| npm | (vem com Node) | - |
| XAMPP | - | https://www.apachefriends.org |
| Quest 2 | - | Meta Quest Browser |

### Verificar instalacao

```bash
node -v      # deve mostrar v16+
npm -v       # deve mostrar 8+
```

---

## 2. Instalacao Completa (Do Zero)

### 2.1 Instalar Node.js

```bash
# Baixar de https://nodejs.org (versao LTS)
# Instalar com todas as opcoes padrao
# Verificar:
node -v
npm -v
```

### 2.2 Instalar XAMPP

```bash
# Baixar de https://www.apachefriends.org
# Instalar Apache + MySQL
# Iniciar Apache na porta 80
# Verificar: http://localhost funciona
```

### 2.3 Copiar o projeto

```bash
# Copiar a pasta fps/ inteira para:
# C:\xampp\htdocs\fps

# Estrutura final:
C:\xampp\htdocs\fps\
├── index.html
├── style.css
├── js\main.js
├── assets\...
├── certs\...         (gerado automaticamente)
├── https-server.js
└── package.json
```

### 2.4 Instalar dependencias npm

```bash
cd C:\xampp\htdocs\fps
npm install
```

Isso instala:

| Pacote | Versao | O que faz |
|---|---|---|
| three | 0.160.0 | Motor 3D (WebGL, WebXR, loaders) |
| node-forge | 1.4.0 | Geracao de certificados SSL |

### 2.5 Gerar certificado SSL (automatico)

O certificado e gerado **automaticamente** na primeira execucao do servidor HTTPS:

```
certs/
├── cert.pem    # Certificado auto-assinado (valido 1 ano)
└── key.pem     # Chave privada RSA 2048-bit
```

Para regenerar:

```bash
del certs\cert.pem
del certs\key.pem
node https-server.js    # gera novos automaticamente
```

### 2.6 Iniciar o servidor HTTPS

```bash
cd C:\xampp\htdocs\fps
node https-server.js
```

Saida esperada no terminal:

```
==========================================
  SERVIDOR HTTPS RODANDO!

  Local:  https://localhost:8443/fps
  LAN:    https://<SEU_IP>:8443/fps

  Abra no Quest Browser!
==========================================
HTTP redirecionando para HTTPS na porta 8080
```

### 2.7 Acessar no Quest 2

1. Descubra o IP do seu PC:
   - Windows: `ipconfig` no CMD → procurar "IPv4 Address"
   - Formato: algo como `192.168.x.x` ou `10.0.x.x`
2. Abrir **Meta Quest Browser**
3. Digitar: `https://<SEU_IP>:8443/fps`
4. Aceitar certificado (veja Secao 2.9 abaixo)
5. Clicar em **"ENTRAR EM VR"**
6. Aceitar permissao "Allow VR" no Quest

### 2.8 Acessar no Desktop

```
http://localhost/fps
```

### 2.9 Como Instalar o Certificado SSL no Quest 2

O navegador Quest **nao aceita certificados auto-assinados automaticamente**. Siga estes passos:

#### Opcao A: Aceitar temporariamente (mais rapido)

1. No Quest Browser, apos digitar a URL HTTPS, vai aparecer um aviso de seguranca
2. Clicar em **"Advanced"**
3. Clicar em **"Proceed to \<seu-ip\> (unsafe)"**
4. Pronto! O jogo vai carregar

> **Nota**: Esse aceite e por sessao. Ao fechar e reabrir o browser, tera que aceitar novamente.

#### Opcao B: Instalar certificado permanentemente (recomendado)

1. No PC, abra o navegador e acesse: `https://<seu-ip>:8443/fps`
2. Aceite o certificado como na Opcao A
3. No PC, abra `chrome://settings/certificates` (Chrome) ou `edge://settings/certificates` (Edge)
4. Va em **Authorities** (Autoridades) ou **Intermediate Certificate Authorities**
5. Clique **Import** e selecione o arquivo `certs/cert.pem` do projeto
6. Marque como **Trusted for websites**
7. Agora instale o certificado no Quest:
   - Copie o arquivo `cert.pem` para o Quest via USB ou pasta compartilhada
   - No Quest Browser, va em `chrome://settings/certificates`
   - Importe o `cert.pem` como autoridade confiavel
8. Apos instalar, o browser vai aceitar o certificado automaticamente

#### Opcao C: Usarmkcert (ferramenta externa, melhor opcao)

```bash
# Instalar mkcert (Windows)
choco install mkcert

# Criar certificado local confiavel
mkcert -install
mkcert -key-file key.pem -cert-file cert.pem localhost 127.0.0.1

# Copiar para o diretorio certs/
copy key.pem certs\
copy cert.pem certs\
```

Depois instale o certificado no Quest (mesmo processo da Opcao B).

#### Certificado para outros IPs

Para incluir o IP da sua rede local, edite `https-server.js` na secao `altNames`:

```javascript
{ name: 'subjectAltName', altNames: [
    { type: 2, value: 'localhost' },         // hostname
    { type: 7, ip: '127.0.0.1' },            // loopback
    { type: 7, ip: '<SEU_IP>' },             // IP da sua rede
]}
```

Depois delete os certificados antigos e reinicie o servidor:

```bash
del certs\cert.pem
del certs\key.pem
node https-server.js
```

---

## 3. Endpoints

| URL | Servidor | Porta | Protocolo | Uso |
|---|---|---|---|---|
| `http://localhost/fps` | XAMPP | 80 | HTTP | Desktop (local) |
| `http://<SEU_IP>/fps` | XAMPP | 80 | HTTP | Desktop (LAN) |
| `https://localhost:8443/fps` | Node.js | 8443 | HTTPS | VR (local) |
| `https://<SEU_IP>:8443/fps` | Node.js | 8443 | HTTPS | **VR (obrigatorio)** |

**IMPORTANTE**: O Quest 2 so funciona com **HTTPS** para WebXR immersive-vr. Substitua `<SEU_IP>` pelo IP do seu PC (use `ipconfig` no CMD para descobrir).

---

## 4. Estrutura do Projeto

```
fps/
├── index.html                  # Pagina principal (HUD, menu terror, VR)
├── style.css                   # Estilos (menu horror, HUD, blood, particles)
├── js/
│   └── main.js                 # Logica completa (~1700 linhas)
├── assets/
│   ├── arma/
│   │   └── 99-weapon-3-pack/
│   │       ├── pistol.fbx      # Modelo 3D da pistola
│   │       └── glock.jpg       # Textura da pistola
│   ├── audio/
│   │   ├── arma/
│   │   │   └── pistola/
│   │   │       └── pistola-1.m4a   # Audio do tiro
│   │   └── gamaplay/
│   │       ├── menu.mp3            # Musica do menu
│   │       ├── Abandoned Echoes.mp3     # Gameplay musica 1
│   │       └── Abandoned Echoes (1).mp3 # Gameplay musica 2
│   └── cenario/
│       ├── arvore/             # Arvores (InstancedMesh)
│       ├── casa/               # Casa fantasy
│       ├── ceu/
│       │   └── sky-night.jpg   # Textura do ceu noturno
│       ├── inimigo/wolf/       # Modelo de lobo
│       └── maos/               # Modelos de maos (FBX/OBJ - nao usado)
├── certs/
│   ├── cert.pem                # Certificado SSL auto-assinado
│   └── key.pem                 # Chave SSL RSA 2048
├── https-server.js             # Servidor HTTPS (porta 8443)
├── package.json
└── package-lock.json
```

---

## 5. Dependencias e Como Funcionam

### npm packages

| Pacote | Versao | O que faz |
|---|---|---|
| `three` | 0.160.0 | Motor 3D (WebGL, WebXR, loaders, math) |
| `node-forge` | 1.4.0 | Gera certificados SSL auto-assinados |

### CDNs (carregados no browser via importmap)

| Recurso | Modulo |
|---|---|
| Three.js | `three` (unpkg) |
| XRControllerModelFactory | `three/addons/webxr/XRControllerModelFactory.js` |
| FBXLoader | `three/addons/loaders/FBXLoader.js` |

### HTTPS Server (https-server.js)

- Usa `node-forge` para gerar certificados SSL
- Escuta na porta **8443** (HTTPS) e **8080** (HTTP redirect)
- Serve arquivos estaticos com MIME types corretos
- Suporta: `.html`, `.js`, `.css`, `.json`, `.png`, `.jpg`, `.fbx`, `.mp3`, `.m4a`, `.ogg`, `.wav`
- Redireciona HTTP para HTTPS automaticamente

---

## 6. Menu Horror

Tela cheia com efeitos visuais CSS e JS antes de entrar no jogo.

### Efeitos visuais

| Efeito | Descricao |
|---|---|
| Fundo | Preto com neblina animada SVG (25s loop) |
| Vinheta | Radial gradient escuro nas bordas |
| Goteiras de sangue | 6 divs com animation CSS (4s, delays aleatorios) |
| Particulas | 30 divs verdes flutuando (8-23s) |
| Titulo | "FLORESTA SOMBRIA" vermelho com glitch (8s) + flicker (5s) |
| Sangue no titulo | Clip-path irregular pulsando |
| Subtexto | "Voce nao esta sozinho" com flicker intermitente |
| Botao INICIAR | Gradiente sangue escuro com pulse vermelho (3s) |
| Botao VR | Laranja queimado quando Quest detectado |
| Aviso | Texto de terror no rodape com pulse |

### Como funciona no codigo

- `#blocker` — Container principal do menu
- `#menu-fog` — SVG filter com feTurbulence animado
- `#menu-particles` — Particulas criadas via JS (`createMenuParticles()`)
- `#menu-vignette` — Vignette CSS
- `#menu-blood-drips` — Goteiras CSS puro
- Menu some quando clica "INICIAR" → `blocker.style.display = 'none'`

---

## 7. Sistema de Audio

### Inicializacao

O AudioContext so e criado com **user gesture** (requisito do navegador):

```
Primeiro clique → ensureAudio() → cria AudioContext → carrega pistola .m4a + inicia musica menu
```

### Fluxo de musica

```
Pagina carrega
└── Menu aparece (silencioso)
    └── Usuario clica qualquer coisa
        └── ensureAudio() cria AudioContext
            └── startMenuMusic() → menu.mp3 toca (loop, 30%)
                └── Usuario clica "INICIAR"
                    └── stopMenuMusic() → para menu
                    └── startGameplayMusic() → Abandoned Echoes aleatoria (loop, 25%)
```

### Arquivos de audio

| Arquivo | Tipo | Volume | Loop | Quando toca |
|---|---|---|---|---|
| `menu.mp3` | HTMLAudioElement | 30% | Sim | Menu |
| `Abandoned Echoes.mp3` | HTMLAudioElement | 25% | Sim | Gameplay (50% chance) |
| `Abandoned Echoes (1).mp3` | HTMLAudioElement | 25% | Sim | Gameplay (50% chance) |
| `pistola-1.m4a` | Web Audio API Buffer | 50% | Nao | Tiro da pistola |

### Sons procedurais (Web Audio API)

| Som | Parametros | Quando toca |
|---|---|---|
| SMG | 1200Hz, 0.05s, 0.15vol | Tiro SMG |
| Shotgun | 300Hz, 0.15s, 0.4vol | Tiro Shotgun |
| Sniper | 150Hz, 0.2s, 0.5vol | Tiro Sniper |
| Pistola (fallback) | 800Hz, 0.08s, 0.25vol | Se .m4a nao carregar |
| Hit | 800->300Hz, 0.06s | Acertou inimigo |
| Kill | 600Hz, 0.15s | Matou inimigo |
| Reload | 400->800Hz, 0.3s | Recarregando |
| Empty | 200Hz, 0.1s | Sem municao |
| Hurt | 200->100Hz, 0.2s | Levou dano |
| Passos | 100Hz, 0.05s | Andando |
| Vento | 400Hz LP, 3s | Ambiente |
| Grilos | 4000->2000Hz, 0.05s | Ambiente |

---

## 8. Armas

| Arma | Municao | Dano | Cadencia | Recarga | Spread | Balas/Shot | Tipo |
|---|---|---|---|---|---|---|---|
| **Faca** | **∞** | 50 | 400ms | - | - | - | Corpo a corpo |
| Pistola | **12** | 25 | 300ms | 1.5s | 0.02 | 1 | Projetil |
| SMG | 30 | 15 | 80ms | 2.0s | 0.08 | 1 | Projetil |
| Shotgun | 8 | 40 | 800ms | 2.5s | 0.15 | 6 | Projetil |
| Sniper | 5 | 100 | 1500ms | 3.0s | 0.005 | 1 | Projetil |

### Faca (melee)

- **Dano**: 50 (2x pistola)
- **Alcance**: 2m (raycast)
- **Efeito visual**: Swing animado + anel de corte branco
- **VR**: Botao A/X (index 3) no controller esquerdo troca arma
- **Desktop**: Tecla `0`

### Modelo FBX da pistola

- **Arquivo**: `assets/arma/99-weapon-3-pack/pistol.fbx`
- **Textura**: `assets/arma/99-weapon-3-pack/glock.jpg`
- **Escala**: `0.20m` (tamanho real de pistola)
- **Posicao**: Centrada no `controller2` (input source)
- **Rotacao**: `(0, PI, 0)` — cano apontando -Z (frente do controller)
- **Barrel offset**: `(-0.03, 0, -0.12)` — 3cm esquerda, 12cm frente

### Muzzle flash

- Geometria: `SphereGeometry(0.06, 4, 4)`
- Cor: `0xffffaa` (amarelo quente)
- Posicao: `raycaster.origin + direction * 0.2` (ponta do cano)
- Luz pontual: `PointLight(0xffffaa, 2, 5)`
- Duracao: 25ms

### Recoil (VR)

```
Tiro → weaponModel.position.z -= 0.03 (kick para frente)
40ms depois → weaponModel.position.z += 0.03 (volta)
```

### Troca de armas

- Desktop: Scroll do mouse ou teclas 1-2-3-4
- VR: Nao implementada (fixa na pistola)

---

## 9. Inimigos

### Soldados Humanos

| Tipo | Vida | Velocidade | Dano | Cadencia | Escala |
|---|---|---|---|---|---|
| Soldado | 100 | 0.02 | 8 | 2.0s | 1.0 |
| Batedor | 60 | 0.05 | 5 | 1.5s | 0.9 |
| Pesado | 250 | 0.01 | 15 | 3.0s | 1.3 |
| Francotirador | 80 | 0.015 | 20 | 2.5s | 1.0 |
| Chefe | 600 | 0.012 | 25 | 1.8s | 1.5 |

### Monstros

| Tipo | Vida | Velocidade | Dano | Cadencia | Escala | Habilidade |
|---|---|---|---|---|---|---|
| **Zumbi** | 120 | 0.015 | 12 | - | 1.1 | Sempre avanca, bracos estendidos |
| **Lobisomem** | 150 | 0.045 | 18 | - | 1.2 | Rapido, corre em circulos, salta |
| **Demo** | 300 | 0.02 | 22 | 2.0s | 1.4 | Projeteis de fogo, chifres |
| **Fantasma** | 80 | 0.03 | 10 | 1.5s | 1.0 | Flutua, movimento erratico |

### Comportamento

- Perseguem o jogador quando proximos (raio de deteccao)
- Atiram com cadencia propria contra o jogador
- Morrem com animacao de particulas
- Drop de vida (20% chance, +20 HP) e municao (30% chance, +5 balas)
- Total: 12 inimigos por rodada
- Sons aleatorios de monstros no ambiente

---

## 10. VR (Meta Quest 2)

### Configuracao WebXR

- **Tipo**: `immersive-vr`
- **Reference space**: `local-floor`
- **Optional features**: `local-floor`, `bounded-floor`, `hand-tracking`
- **Session**: `navigator.xr.requestSession()`

### Controllers

| Controller | Funcao | Evento/Input |
|---|---|---|
| Direito (`getController(1)`) | Arma + tiro | `selectstart` → `shoot()` |
| Direito (`getController(1)`) | Recarga | `squeezestart` → `reload()` |
| Esquerdo (`getController(0)`) | Movimento | Polling `gamepad.axes` via `pollXRGamepad()` |
| Esquerdo (`getController(0)`) | Trocar arma | Botao A/X (index 3) → `switchWeapon()` |

### Arma em VR

- Posicionada em `controller2` (input source = mesmo lugar das balas)
- Escala: `0.20m` (tamanho real)
- Barrel offset para alinhar flash/bala com cano
- Grip models do Quest ocultos (filhos escondidos)
- Recoil visual no modelo da arma

### Movimento VR

- Polling direto de `session.inputSources[].gamepad.axes`
- Deadzone: 0.15
- Velocidade: 3.5 m/s
- Direcao: baseada em `camera.getWorldDirection()` com fallback

### Otimizacoes VR

- Sombras desabilitadas (`renderer.shadowMap.enabled = false`)
- Fog densidade reduzida (0.015)
- Particulas reduzidas
- Delta-time clampado a 0.1s

---

## 11. Desktop

| Acao | Tecla/Mouse |
|---|---|
| Mover | W A S D |
| Olhar | Mouse (pointer lock) |
| Atirar | Click esquerdo |
| Recarregar | R |
| Trocar arma | Scroll / 1 2 3 4 |

---

## 12. Correcoes Realizadas

### v1.0.1
| Correcao | Descricao |
|---|---|
| Faca melee | Nova arma corpo a corpo com swing animado |
| Arvores texturizadas | Copas com Leaves0120, troncos com BarkDecidious |
| Flash offset | Offset (-0.03, 0.04, 0) para alinhar com cano |
| Luz verde removida | PointLight(0x00ff88) removida da arma |
| VR weapon switch | Botao A/X no controller esquerdo troca armas |
| Flash dinamico | Usa matrix correta (controller VR / camera desktop) |
| Monstros | 4 novos tipos: Zumbi, Lobisomem, Demo, Fantasma |
| Sons monstros | Sons ambientais e de morte para cada tipo de monstro |

### v1.0.0

| Correcao | Descricao |
|---|---|
| HTTPS server | Servidor HTTPS com node-forge (certificados auto-assinados) |
| Pistol ammo | Alterado de 15 para **12** balas |
| Recoil direcao | Invertido para kick para frente (muzzle climb) |
| Muzzle flash posicao | Alinhado com cano via barrel offset `(-0.03, 0, -0.12)` |
| Arma alinhada | Posicionada em `controller2` (input source), nao grip |
| Arma escala | Aumentada para 0.20m (tamanho real) |
| Grip models | Ocultos em VR (filhos do controllerGrip escondidos) |
| Left hand | Removida (mao procedural cancelada) |
| AudioContext | Inicializado com user gesture, resume automatico |
| Menu music | menu.mp3 toca no menu, para ao entrar |
| Gameplay music | Abandoned Echoes aleatoria durante jogo |
| Sky texture | Cache-busting + error handling no carregamento |
| Thumbstick | Polling de session.inputSources sem filtro handedness |
| VR movement | Fallback direction (0,0,-1) quando getWorldDirection retorna zero |
| Menu horror | Neblina, sangue, particulas, glitch, flicker |
| Servidor reinicio | Script de reinicio preserva dados |

---

## 13. Solucao de Problemas

### VR nao inicia
- Verifique se esta usando HTTPS (porta 8443)
- Aceite o certificado auto-assinado no Quest Browser
- Verifique se PC e Quest estao na mesma rede WiFi

### Arma nao aparece em VR
- Modelo FBX carrega assincronamente, aguarde alguns segundos
- Verifique console do browser para erros

### Audio nao toca
- Verifique se AudioContext foi criado (user gesture necessario)
- Console deve mostrar: "Pistol .m4a loaded OK" ou "Menu music playing"
- Em VR, audio so inicia apos clique no "ENTRAR EM VR"

### Flash/Bala fora do cano
- Barrel offset calibrado para `(-0.03, 0, -0.12)`
- Ajuste na funcao `shoot()` se necessario

### Performance ruim
- Feche outros apps no Quest
- Sombras ja desabilitadas em VR
- Reduza inimigos no codigo se necessario

### Menu nao aparece
- Verifique se CSS carregou (style.css)
- Menu usa animacoes CSS (fog, blood, particles)

### Thumbstick nao funciona
- Verifique console: "Gamepad found: left axes: ..."
- Se nao aparecer, reconnect os controllers no Quest

---

## 14. Controles

### VR (Quest 2)

| Acao | Controller | Botao |
|---|---|---|
| Olhar | Tracking de cabeca | - |
| Andar | Esquerdo | Thumbstick |
| Atirar/Cortar | Direito | Trigger |
| Recarregar | Direito | Grip |
| Trocar arma | Esquerdo | A/X (index 3) |

### Desktop

| Acao | Tecla/Mouse |
|---|---|
| Mover | W A S D |
| Olhar | Mouse |
| Atirar/Cortar | Click esquerdo |
| Recarregar | R |
| Trocar arma | Scroll / 0 1 2 3 4 |

---

## 15. Licenca

Modelos 3D:
- Armas: 99-weapon-3-pack
- Arvores: TyroSmith
- Casa: Fantasy House (CC)
- Texturas: Poly Haven / ambientCG

Audio:
- Pistola: pistola-1.m4a (asset proprio)
- Menu: menu.mp3 (asset proprio)
- Gameplay: Abandoned Echoes (asset proprio)
