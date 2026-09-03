/*
  CONFIG.js
  ---------
  Todo lo que necesitas editar para calzar tus sprites está aquí.
  No toques sketch.js a menos que quieras cambiar la lógica del modelo.

  IMPORTANTE sobre los sprites:
  Como cada imagen es del tamaño completo de la ventana (con transparencia
  alrededor del personaje dibujado), cada sprite se dibuja SIEMPRE en
  (0,0) cubriendo todo el canvas — nunca se recorta ni se reposiciona.
  Lo único que cambia entre personajes es el "collider" (la caja/círculo
  invisible que usamos para detectar el mouse) y la posición lógica
  "pos" que se usa solo para calcular distancias en el acoplamiento
  de Kuramoto (qué tan cerca están un cráneo de otro / de la cantante).

  Presiona la tecla "D" en la simulación para ver los colliders dibujados
  encima y calibrarlos visualmente.

  SOBRE RESOLUCIÓN Y ESCALA:
  Tus sprites están hechos en 3840x2160 (4K). Dibujarlos así de grandes en
  el navegador es innecesariamente pesado, así que el canvas real se
  calcula como sourceW*scale x sourceH*scale (con scale=0.5 -> 1920x1080).
  TODAS las posiciones y colliders de abajo se escriben en las coordenadas
  ORIGINALES de 4K (las mismas que ves en tu editor de imagen/Photoshop) —
  el código las reescala automáticamente, no tienes que hacer la cuenta tú.
  Si quieres un canvas aún más liviano, baja "scale" (ej. 0.35).
  Nota: escalar aquí reduce el tamaño de RENDER, no el peso de descarga de
  los PNG — si el peso de la página (tiempo de carga) te importa, exporta
  también versiones más livianas de los PNG/MP3 del lado de tu editor.
*/

const CONFIG = {

  canvas: {
    sourceW: 3840,   // ancho con el que exportaste tus sprites
    sourceH: 2160,   // alto con el que exportaste tus sprites
    scale: 0.5,      // factor de escala para el canvas real (0.5 -> 1920x1080)
  },

  background: {
    image: 'assets/background.png', // se dibuja primero, detrás de la cantante y las calaveras
  },

  // ---------- MODELO DE KURAMOTO ----------
  kuramoto: {
    K: 1.6,                 // fuerza de acoplamiento global (K en la fórmula dθ/dt = ω + (K/N)Σsin(θj-θi))
    singerWeightMult: 4.0,  // cuánto más pesa el valor de la cantante θ_j cuando aparece en la ecuación de OTROS
    distanceFalloff: 700,   // px (en el canvas ya escalado). Mayor = el acoplamiento por distancia decae más lento.
                             // Nota: al cambiar "scale" cambia el tamaño real del canvas, así que si el efecto
                             // de "cercanía" se siente muy fuerte o muy débil, ajusta este valor.
    scarePerturbMin: PI * 0.9,  // al asustar un cráneo (clic), cuánto se perturba su fase como mínimo
    scarePerturbMax: PI * 2.0,  // y como máximo (empuja al cráneo de vuelta a un estado caótico)
  },

  // ---------- CANTANTE (rige el tiempo) ----------
  singer: {
    omegaBase: 1.0,     // frecuencia natural (rad/s) inicial
    omegaStep: 0.15,    // cuánto cambia con cada pulsación de flecha ↑ / ↓
    omegaMin: 0.15,
    omegaMax: 4.0,
    pos: { x: 1920, y: 1080 }, // posición lógica (para distancias), EN COORDENADAS DE 4K
    collider: { x: 1680, y: 630, w: 480, h: 1260 }, // EDITA esto para calzar tu sprite, EN COORDENADAS DE 4K
    images: {
      quieta:   'assets/singer_quieta.png',
      cantando: 'assets/singer_cantando.png',
    },
    audio: 'assets/singer.mp3',
  },

  // ---------- LAS 7 CALAVERAS ----------
  // "pos" = posición lógica aproximada del cráneo en el frame, usada SOLO
  // para calcular distancias (acoplamiento más fuerte entre vecinos cercanos).
  // "collider" = caja de detección de clic, EDITA x/y/w/h para calzar tu arte.
  // Todos los valores están en coordenadas de 4K (3840x2160), igual que tus sprites.
  skulls: [
    { id: 0, pos: { x: 360, y: 900 }, collider: { x: 180, y: 690, w: 390, h: 480 },
      omegaBase: 0.75,
      images: { normal: 'assets/skull0_normal.png', peck: 'assets/skull0_peck.png', scream: 'assets/skull0_scream.png' },
      audio: 'assets/skull0.mp3' },

    { id: 1, pos: { x: 810, y: 1260 }, collider: { x: 630, y: 1050, w: 390, h: 480 },
      omegaBase: 0.85,
      images: { normal: 'assets/skull1_normal.png', peck: 'assets/skull1_peck.png', scream: 'assets/skull1_scream.png' },
      audio: 'assets/skull1.mp3' },

    { id: 2, pos: { x: 1260, y: 1560 }, collider: { x: 1080, y: 1350, w: 390, h: 480 },
      omegaBase: 0.70,
      images: { normal: 'assets/skull2_normal.png', peck: 'assets/skull2_peck.png', scream: 'assets/skull2_scream.png' },
      audio: 'assets/skull2.mp3' },

    { id: 3, pos: { x: 2580, y: 1560 }, collider: { x: 2400, y: 1350, w: 390, h: 480 },
      omegaBase: 0.95,
      images: { normal: 'assets/skull3_normal.png', peck: 'assets/skull3_peck.png', scream: 'assets/skull3_scream.png' },
      audio: 'assets/skull3.mp3' },

    { id: 4, pos: { x: 3030, y: 1260 }, collider: { x: 2850, y: 1050, w: 390, h: 480 },
      omegaBase: 0.80,
      images: { normal: 'assets/skull4_normal.png', peck: 'assets/skull4_peck.png', scream: 'assets/skull4_scream.png' },
      audio: 'assets/skull4.mp3' },

    { id: 5, pos: { x: 3480, y: 900 }, collider: { x: 3300, y: 690, w: 390, h: 480 },
      omegaBase: 0.90,
      images: { normal: 'assets/skull5_normal.png', peck: 'assets/skull5_peck.png', scream: 'assets/skull5_scream.png' },
      audio: 'assets/skull5.mp3' },

    { id: 6, pos: { x: 1920, y: 1860 }, collider: { x: 1740, y: 1650, w: 390, h: 480 },
      omegaBase: 1.05,
      images: { normal: 'assets/skull6_normal.png', peck: 'assets/skull6_peck.png', scream: 'assets/skull6_scream.png' },
      audio: 'assets/skull6.mp3' },
  ],

  // Sonido fijo del "ave asustada" al hacer clic en cualquier cráneo
  ave: { audio: 'assets/ave.mp3' },

  timing: {
    peckDuration: 0.35, // segundos que se ve el sprite "ave picoteando" antes de pasar al grito + audio
  },
};
