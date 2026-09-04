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
    image: 'assets/background.PNG', // se dibuja primero, detrás de la cantante y las calaveras
  },

  // ---------- MODELO DE KURAMOTO ----------
  kuramoto: {
    K: 1.1,                // fuerza de acoplamiento global BASE — bajado de 1.6 para que tarde más en sincronizar
    singerWeightMult: 2.2,  // cuánto más pesa el valor de la cantante θ_j cuando aparece en la ecuación de OTROS — bajado de 4.0
    distanceFalloff: 700,   // px (en el canvas ya escalado). Bajado de 700: el acoplamiento llega a menos distancia,
                             // así que el contagio entre calaveras lejanas es más lento.
    scarePerturbMin: Math.PI * 0.9,  // al asustar un cráneo (clic), cuánto se perturba su fase como mínimo
    scarePerturbMax: Math.PI * 2.0,  // y como máximo (empuja al cráneo de vuelta a un estado caótico)

    // K dinámico: cada susto resta de golpe al K global (no solo perturba
    // la fase de esa calavera), y se recupera solo con el tiempo.
    // K_efectivo(t) = max(scareKMin, K - kDeficit(t)), donde kDeficit decae
    // exponencialmente: kDeficit(t+dt) = kDeficit(t) * e^(-dt/scareKRecoveryTau)
    scareKDrop: 0.6,          // cuánto le resta a K cada vez que asustas una calavera
    scareKRecoveryTau: 3.0,   // segundos que tarda en recuperarse (más alto = recuperación más lenta)
    scareKMin: 0.2,           // piso mínimo, K nunca cae más abajo de esto
  },

  // ---------- CANTANTE (rige el tiempo) ----------
  singer: {
    omegaBase: 1.0,     // frecuencia natural (rad/s) inicial
    omegaStep: 0.15,    // cuánto cambia con cada pulsación de flecha ↑ / ↓
    omegaMin: 0.15,
    omegaMax: 4.0,
    pos: { x: 1920, y: 1080 }, // posición lógica (para distancias), EN COORDENADAS DE 4K
    collider: { x: 1680, y: 510, w: 758, h: 1264 }, // EDITA esto para calzar tu sprite, EN COORDENADAS DE 4K
    images: {
      quieta:   'assets/singer_quieta.PNG',
      cantando: 'assets/singer_cantando.PNG',
    },
    audio: 'assets/singer.mp3',
  },

  // ---------- LAS 7 CALAVERAS ----------
  // "pos" = posición lógica aproximada del cráneo en el frame, usada SOLO
  // para calcular distancias (acoplamiento más fuerte entre vecinos cercanos).
  // "collider" = caja de detección de clic, EDITA x/y/w/h para calzar tu arte.
  // Todos los valores están en coordenadas de 4K (3840x2160), igual que tus sprites.
  skulls: [
    { id: 0, pos: { x: 360, y: 900 }, collider: { x: 2726, y: 46, w: 402, h: 408 },
      omegaBase: 0.55,
      images: { normal: 'assets/skull0_normal.PNG', peck: 'assets/skull0_peck.PNG', scream: 'assets/skull0_scream.PNG' },
      audio: 'assets/skull0.mp3' },

    { id: 1, pos: { x: 810, y: 1260 }, collider: { x: 3366, y: 528, w: 440, h: 496 },
      omegaBase: 1.35,
      images: { normal: 'assets/skull1_normal.PNG', peck: 'assets/skull1_peck.PNG', scream: 'assets/skull1_scream.PNG' },
      audio: 'assets/skull1.mp3' },

    { id: 2, pos: { x: 1260, y: 1560 }, collider: { x: 2028, y: 18, w: 494, h: 422 } ,
      omegaBase: 0.45,
      images: { normal: 'assets/skull2_normal.PNG', peck: 'assets/skull2_peck.PNG', scream: 'assets/skull2_scream.PNG' },
      audio: 'assets/skull2.mp3' },

    { id: 3, pos: { x: 2580, y: 1560 }, collider: { x: 2944, y: 1454, w: 752, h: 434 } ,
      omegaBase: 1.55,
      images: { normal: 'assets/skull3_normal.PNG', peck: 'assets/skull3_peck.PNG', scream: 'assets/skull3_scream.PNG' },
      audio: 'assets/skull3.mp3' },

    { id: 4, pos: { x: 3030, y: 1260 }, collider: { x: 742, y: 1088, w: 372, h: 450 },
      omegaBase: 0.65,
      images: { normal: 'assets/skull4_normal.PNG', peck: 'assets/skull4_peck.PNG', scream: 'assets/skull4_scream.PNG' },
      audio: 'assets/skull4.mp3' },

    { id: 5, pos: { x: 3480, y: 900 }, collider: { x: 344, y: 690, w: 386, h: 400 },
      omegaBase: 1.45,
      images: { normal: 'assets/skull5_normal.PNG', peck: 'assets/skull5_peck.PNG', scream: 'assets/skull5_scream.PNG' },
      audio: 'assets/skull5.mp3' },

    { id: 6, pos: { x: 1920, y: 1860 }, collider: { x: 948, y: 12, w: 816, h: 428 },
      omegaBase: 1.75,
      images: { normal: 'assets/skull6_normal.PNG', peck: 'assets/skull6_peck.PNG', scream: 'assets/skull6_scream.PNG' },
      audio: 'assets/skull6.mp3' },
  ],

  // Sonido fijo del "ave asustada" al hacer clic en cualquier cráneo
  ave: { audio: 'assets/ave.mp3' },

  timing: {
    peckDuration: 0.35, // segundos que se ve el sprite "ave picoteando" antes de pasar al grito + audio
  },
};
