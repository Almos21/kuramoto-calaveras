/*
  sketch.js
  ---------
  Simulación de sincronización basada en el modelo de Kuramoto:

      dθ_i/dt = ω_i + (K/N) * Σ_j w_ij * sin(θ_j - θ_i)

  Cada oscilador (la cantante + 7 calaveras) tiene una fase θ que avanza
  con el tiempo. Cuando la fase de un oscilador completa una vuelta
  (θ pasa por un múltiplo de 2π), eso ES el "picoteo": dispara la
  animación y el audio de ese personaje. Como en el modelo clásico de
  luciérnagas sincronizándose, θ es literalmente el reloj interno de
  cada personaje.

  w_ij (peso del acoplamiento) NO es uniforme:
    - Si la fuente j es la cantante, su influencia se multiplica por
      CONFIG.kuramoto.singerWeightMult -> "ella rige el tiempo".
    - Para cualquier par, el peso decae con la distancia real entre sus
      posiciones lógicas -> las calaveras cercanas se sincronizan más
      rápido entre sí que las lejanas.

  Un clic en una calavera no la sincroniza: espanta al ave (sin sprite,
  solo audio "ave") y perturba su fase de vuelta al caos, deshaciendo el
  progreso de sincronización que llevaba.
*/

let img = { skulls: [] };
let snd = { skulls: [] };

let singer;      // estado del oscilador de la cantante
let skulls = []; // estado de los 7 osciladores de calaveras

let showDebug = false;
let assetsOk = true;

// K dinámico: cuánto se le resta al K base ahora mismo. Sube de golpe con
// cada susto y decae solo con el tiempo (ver stepKuramoto).
let kDeficit = 0;

// Colliders "vivos" durante el modo de calibración (coordenadas de canvas,
// se inicializan desde config.js y se editan con el mouse). Se convierten
// de vuelta a coordenadas de 4K solo al exportar (tecla P).
let working = null;
let drag = null; // { target: 'singer'|skullId, mode: 'move'|'resize', ... }
const HANDLE = 16; // tamaño del cuadrito de redimensionar, en px de canvas

function preload() {
  // Si algún archivo no existe, p5 avisará en consola pero no debe romper
  // la simulación entera: seguimos igual, solo no se verá ese sprite.

  img.background = loadImage(CONFIG.background.image, () => {}, onAssetError);

  img.singerQuieta   = loadImage(CONFIG.singer.images.quieta,   () => {}, onAssetError);
  img.singerCantando = loadImage(CONFIG.singer.images.cantando, () => {}, onAssetError);
  snd.singer          = loadSound(CONFIG.singer.audio, () => {}, onAssetError);

  for (const s of CONFIG.skulls) {
    img.skulls[s.id] = {
      normal: loadImage(s.images.normal, () => {}, onAssetError),
      peck:   loadImage(s.images.peck,   () => {}, onAssetError),
      scream: loadImage(s.images.scream, () => {}, onAssetError),
    };
    snd.skulls[s.id] = loadSound(s.audio, () => {}, onAssetError);
  }

  snd.ave = loadSound(CONFIG.ave.audio, () => {}, onAssetError);
}

function onAssetError(err) {
  assetsOk = false;
  console.warn('No se pudo cargar un asset (revisa las rutas en config.js):', err);
}

// Convierte coordenadas escritas en config.js (resolución de 4K de tus
// sprites) al tamaño real del canvas, según CONFIG.canvas.scale.
function scaledPoint(p) {
  const S = CONFIG.canvas.scale;
  return { x: p.x * S, y: p.y * S };
}

function scaledRect(r) {
  const S = CONFIG.canvas.scale;
  return { x: r.x * S, y: r.y * S, w: r.w * S, h: r.h * S };
}

// Inversa de scaledRect: de coordenadas de canvas de vuelta a las
// coordenadas de 4K que se escriben en config.js.
function unscaledRect(r) {
  const S = CONFIG.canvas.scale;
  return { x: round(r.x / S), y: round(r.y / S), w: round(r.w / S), h: round(r.h / S) };
}

function getWorkingRect(target) {
  return target === 'singer' ? working.singer : working.skulls[target];
}

function setup() {
  const S = CONFIG.canvas.scale;
  createCanvas(CONFIG.canvas.sourceW * S, CONFIG.canvas.sourceH * S);
  angleMode(RADIANS);

  singer = {
    theta: random(TWO_PI),
    omega: CONFIG.singer.omegaBase,
    phase: 'quieta',      // 'quieta' | 'cantando'
    lapCount: 0,
  };

  skulls = CONFIG.skulls.map((s) => ({
    id: s.id,
    theta: random(TWO_PI),
    omega: s.omegaBase + random(-0.08, 0.08), // pequeño jitter para arrancar en caos, no en fase
    phase: 'normal',       // 'normal' | 'peck' | 'scream'
    timer: 0,
    lapCount: 0,
  }));

  // Copia editable de los colliders para el modo de calibración
  working = {
    singer: scaledRect(CONFIG.singer.collider),
    skulls: CONFIG.skulls.map(s => scaledRect(s.collider)),
  };
}

function draw() {
  background(8, 6, 14);

  const dt = min(deltaTime / 1000, 0.05); // clamp por si hay un frame lento
  stepKuramoto(dt);
  updateStateMachines(dt);

  drawBackground();
  drawSinger();
  drawSkulls();

  if (showDebug) drawDebug();
  if (!assetsOk) drawAssetWarning();
}

// ---------------------------------------------------------------------
// MODELO DE KURAMOTO
// ---------------------------------------------------------------------

function couplingWeight(sourceIsSinger, dist) {
  const base = sourceIsSinger ? CONFIG.kuramoto.singerWeightMult : 1.0;
  const falloff = exp(-dist / CONFIG.kuramoto.distanceFalloff);
  return base * falloff;
}

// K_efectivo(t) = max(scareKMin, K_base - kDeficit). kDeficit se alimenta
// en scareSkull() y decae solo cada frame (ver el final de stepKuramoto).
function currentK() {
  return max(CONFIG.kuramoto.scareKMin, CONFIG.kuramoto.K - kDeficit);
}

function stepKuramoto(dt) {
  // Armamos un arreglo homogéneo: índice 0 = cantante, 1..7 = calaveras
  const n = 1 + skulls.length;
  const theta = [singer.theta, ...skulls.map(s => s.theta)];
  const omega = [singer.omega, ...skulls.map(s => s.omega)];
  const pos = [scaledPoint(CONFIG.singer.pos), ...CONFIG.skulls.map(s => scaledPoint(s.pos))];
  const K = currentK();

  const dtheta = new Array(n).fill(0);

  for (let i = 0; i < n; i++) {
    let sum = 0;
    for (let j = 0; j < n; j++) {
      if (j === i) continue;
      const d = dist(pos[i].x, pos[i].y, pos[j].x, pos[j].y);
      const w = couplingWeight(j === 0 /* fuente es la cantante */, d);
      sum += w * sin(theta[j] - theta[i]);
    }
    dtheta[i] = omega[i] + (K / (n - 1)) * sum;
  }

  // Aplicamos y detectamos "vueltas" (laps) completas -> disparan eventos
  const prevSingerTheta = singer.theta;
  singer.theta += dtheta[0] * dt;
  if (floor(singer.theta / TWO_PI) > floor(prevSingerTheta / TWO_PI)) {
    onSingerLap();
  }

  skulls.forEach((s, idx) => {
    const prev = s.theta;
    s.theta += dtheta[idx + 1] * dt;
    if (floor(s.theta / TWO_PI) > floor(prev / TWO_PI)) {
      onSkullLap(s);
    }
  });

  // kDeficit decae exponencialmente hacia 0 -> K se va recuperando solo
  kDeficit *= exp(-dt / CONFIG.kuramoto.scareKRecoveryTau);
}

// ---------------------------------------------------------------------
// EVENTOS DE "VUELTA COMPLETA" (equivalen al picoteo / canto)
// ---------------------------------------------------------------------

function onSingerLap() {
  if (singer.phase !== 'quieta') return; // ya está cantando, no se re-dispara
  singer.phase = 'cantando';
  singer.lapCount++;
  if (snd.singer && snd.singer.isLoaded()) snd.singer.play();
}

function onSkullLap(s) {
  if (s.phase !== 'normal') return; // ya está en su ciclo de picoteo/grito
  s.phase = 'peck';
  s.timer = 0;
  s.lapCount++;
}

// ---------------------------------------------------------------------
// MÁQUINAS DE ESTADO (sprites + audio)
// ---------------------------------------------------------------------

function updateStateMachines(dt) {
  // Cantante: cuando termina su audio, vuelve a 'quieta'
  if (singer.phase === 'cantando') {
    if (snd.singer && snd.singer.isLoaded() && !snd.singer.isPlaying()) {
      singer.phase = 'quieta';
    }
  }

  for (const s of skulls) {
    if (s.phase === 'peck') {
      s.timer += dt;
      if (s.timer >= CONFIG.timing.peckDuration) {
        s.phase = 'scream';
        const sound = snd.skulls[s.id];
        if (sound && sound.isLoaded()) sound.play();
      }
    } else if (s.phase === 'scream') {
      const sound = snd.skulls[s.id];
      if (sound && sound.isLoaded() && !sound.isPlaying()) {
        s.phase = 'normal';
      }
    }
  }
}

// ---------------------------------------------------------------------
// INTERACCIÓN: teclado (velocidad de la cantante) y clic (espantar ave)
// ---------------------------------------------------------------------

function keyPressed() {
  if (key === 'd' || key === 'D') {
    showDebug = !showDebug;
    return;
  }
  if (showDebug && (key === 'p' || key === 'P')) {
    printCalibration();
    return;
  }
  if (keyCode === UP_ARROW) {
    singer.omega = constrain(singer.omega + CONFIG.singer.omegaStep, CONFIG.singer.omegaMin, CONFIG.singer.omegaMax);
  } else if (keyCode === DOWN_ARROW) {
    singer.omega = constrain(singer.omega - CONFIG.singer.omegaStep, CONFIG.singer.omegaMin, CONFIG.singer.omegaMax);
  }
}

// Imprime en la consola del navegador (F12) los valores de collider
// actuales, ya en coordenadas de 4K, listos para pegar en config.js.
function printCalibration() {
  const lines = [];
  lines.push('--- Valores de collider (pega esto en config.js) ---');
  const sc = unscaledRect(working.singer);
  lines.push(`singer.collider: { x: ${sc.x}, y: ${sc.y}, w: ${sc.w}, h: ${sc.h} }`);
  working.skulls.forEach((r, i) => {
    const c = unscaledRect(r);
    lines.push(`skulls[${i}].collider: { x: ${c.x}, y: ${c.y}, w: ${c.w}, h: ${c.h} }`);
  });
  console.log(lines.join('\n'));
}

function mousePressed() {
  if (showDebug) {
    startCalibrationDrag();
    return;
  }
  for (const s of skulls) {
    const c = scaledRect(CONFIG.skulls[s.id].collider);
    if (mouseX >= c.x && mouseX <= c.x + c.w && mouseY >= c.y && mouseY <= c.y + c.h) {
      scareSkull(s);
      return; // solo una calavera por clic
    }
  }
}

function startCalibrationDrag() {
  const targets = ['singer', ...skulls.map(s => s.id)];
  for (const target of targets) {
    const r = getWorkingRect(target);
    // Zona de la esquina inferior derecha -> redimensionar
    const hx = r.x + r.w, hy = r.y + r.h;
    if (mouseX >= hx - HANDLE && mouseX <= hx + HANDLE / 2 && mouseY >= hy - HANDLE && mouseY <= hy + HANDLE / 2) {
      drag = { target, mode: 'resize', startW: r.w, startH: r.h, startMouseX: mouseX, startMouseY: mouseY };
      return;
    }
    // Cuerpo del rectángulo -> mover
    if (mouseX >= r.x && mouseX <= r.x + r.w && mouseY >= r.y && mouseY <= r.y + r.h) {
      drag = { target, mode: 'move', offsetX: mouseX - r.x, offsetY: mouseY - r.y };
      return;
    }
  }
}

function mouseDragged() {
  if (!showDebug || !drag) return;
  const r = getWorkingRect(drag.target);
  if (drag.mode === 'move') {
    r.x = mouseX - drag.offsetX;
    r.y = mouseY - drag.offsetY;
  } else if (drag.mode === 'resize') {
    r.w = max(10, drag.startW + (mouseX - drag.startMouseX));
    r.h = max(10, drag.startH + (mouseY - drag.startMouseY));
  }
}

function mouseReleased() {
  drag = null;
}

function scareSkull(s) {
  // Cancela cualquier animación/audio en curso y vuelve a sprite normal
  const sound = snd.skulls[s.id];
  if (sound && sound.isPlaying()) sound.stop();
  s.phase = 'normal';
  s.timer = 0;

  // Suena el audio predeterminado del ave asustada
  if (snd.ave && snd.ave.isLoaded()) {
    if (snd.ave.isPlaying()) snd.ave.stop();
    snd.ave.play();
  }

  // Perturba su fase -> la empuja de vuelta a un estado caótico,
  // deshaciendo el progreso de sincronización que tenía con sus vecinas.
  const sign = random() < 0.5 ? -1 : 1;
  s.theta += sign * random(CONFIG.kuramoto.scarePerturbMin, CONFIG.kuramoto.scarePerturbMax);

  // Además, el susto le resta al K GLOBAL del sistema (no solo a esta
  // calavera): todo el sistema se sincroniza menos por un rato, y se va
  // recuperando solo (ver el decaimiento de kDeficit en stepKuramoto).
  const maxDeficit = CONFIG.kuramoto.K - CONFIG.kuramoto.scareKMin;
  kDeficit = min(kDeficit + CONFIG.kuramoto.scareKDrop, maxDeficit);
}

// ---------------------------------------------------------------------
// DIBUJO
// ---------------------------------------------------------------------

function drawBackground() {
  if (img.background) {
    image(img.background, 0, 0, width, height);
  }
}

function drawSinger() {
  const im = singer.phase === 'cantando' ? img.singerCantando : img.singerQuieta;
  if (im) image(im, 0, 0, width, height);
}

function drawSkulls() {
  for (const s of skulls) {
    const set = img.skulls[s.id];
    if (!set) continue;
    const im = set[s.phase]; // 'normal' | 'peck' | 'scream'
    if (im) image(im, 0, 0, width, height);
  }
}

function drawDebug() {
  textSize(13);

  fill(255, 220, 80);
  noStroke();
  text(`K_efectivo = ${currentK().toFixed(2)}  (base ${CONFIG.kuramoto.K.toFixed(2)}, déficit ${kDeficit.toFixed(2)})`, 12, 20);

  drawCalibBox(working.singer, [0, 200, 255], 'cantante');
  skulls.forEach((s, i) => {
    drawCalibBox(working.skulls[i], [255, 80, 80], `#${s.id}`);
  });

  fill(255);
  noStroke();
  textSize(13);
  text('Modo calibración: arrastra el cuerpo para mover, la esquina inferior-derecha para redimensionar. P = imprimir valores en consola.', 12, height - 16);
}

function drawCalibBox(r, col, label) {
  noFill();
  stroke(col[0], col[1], col[2]);
  strokeWeight(2);
  rect(r.x, r.y, r.w, r.h);

  // Handle de redimensionar (esquina inferior derecha)
  fill(col[0], col[1], col[2]);
  noStroke();
  rect(r.x + r.w - HANDLE / 2, r.y + r.h - HANDLE / 2, HANDLE, HANDLE);

  // Valores en coordenadas de 4K (las que van en config.js)
  const c = unscaledRect(r);
  fill(col[0], col[1], col[2]);
  noStroke();
  text(`${label}  x:${c.x} y:${c.y} w:${c.w} h:${c.h}`, r.x, r.y - 6);
}

function drawAssetWarning() {
  fill(255, 60, 60);
  noStroke();
  textSize(14);
  text('Faltan uno o más archivos en assets/ — revisa la consola y las rutas en config.js', 12, height - 16);
}
