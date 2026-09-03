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

function stepKuramoto(dt) {
  // Armamos un arreglo homogéneo: índice 0 = cantante, 1..7 = calaveras
  const n = 1 + skulls.length;
  const theta = [singer.theta, ...skulls.map(s => s.theta)];
  const omega = [singer.omega, ...skulls.map(s => s.omega)];
  const pos = [scaledPoint(CONFIG.singer.pos), ...CONFIG.skulls.map(s => scaledPoint(s.pos))];

  const dtheta = new Array(n).fill(0);

  for (let i = 0; i < n; i++) {
    let sum = 0;
    for (let j = 0; j < n; j++) {
      if (j === i) continue;
      const d = dist(pos[i].x, pos[i].y, pos[j].x, pos[j].y);
      const w = couplingWeight(j === 0 /* fuente es la cantante */, d);
      sum += w * sin(theta[j] - theta[i]);
    }
    dtheta[i] = omega[i] + (CONFIG.kuramoto.K / (n - 1)) * sum;
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
  if (keyCode === UP_ARROW) {
    singer.omega = constrain(singer.omega + CONFIG.singer.omegaStep, CONFIG.singer.omegaMin, CONFIG.singer.omegaMax);
  } else if (keyCode === DOWN_ARROW) {
    singer.omega = constrain(singer.omega - CONFIG.singer.omegaStep, CONFIG.singer.omegaMin, CONFIG.singer.omegaMax);
  }
}

function mousePressed() {
  for (const s of skulls) {
    const c = scaledRect(CONFIG.skulls[s.id].collider);
    if (mouseX >= c.x && mouseX <= c.x + c.w && mouseY >= c.y && mouseY <= c.y + c.h) {
      scareSkull(s);
      return; // solo una calavera por clic
    }
  }
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
  noFill();
  strokeWeight(2);

  stroke(0, 200, 255);
  const sc = scaledRect(CONFIG.singer.collider);
  rect(sc.x, sc.y, sc.w, sc.h);
  fill(0, 200, 255);
  noStroke();
  text(`cantante  ω=${singer.omega.toFixed(2)}  θ=${(singer.theta % TWO_PI).toFixed(2)}  [${singer.phase}]`, sc.x, sc.y - 6);

  for (const s of skulls) {
    const c = scaledRect(CONFIG.skulls[s.id].collider);
    noFill();
    stroke(255, 80, 80);
    strokeWeight(2);
    rect(c.x, c.y, c.w, c.h);
    noStroke();
    fill(255, 80, 80);
    text(`#${s.id} θ=${(s.theta % TWO_PI).toFixed(2)} [${s.phase}]`, c.x, c.y - 6);
  }
}

function drawAssetWarning() {
  fill(255, 60, 60);
  noStroke();
  textSize(14);
  text('Faltan uno o más archivos en assets/ — revisa la consola y las rutas en config.js', 12, height - 16);
}
