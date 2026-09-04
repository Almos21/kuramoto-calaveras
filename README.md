# Kuramoto Calaveras — guía rápida

## Estructura de carpetas esperada

```
kuramoto-calaveras/
  index.html
  config.js
  sketch.js
  assets/
    singer_quieta.png
    singer_cantando.png
    singer.mp3
    skull0_normal.png  skull0_peck.png  skull0_scream.png  skull0.mp3
    skull1_normal.png  skull1_peck.png  skull1_scream.png  skull1.mp3
    ... hasta skull6 ...
    ave.mp3
```

Copia tus sprites y audios reales dentro de `assets/` con esos nombres,
o cambia las rutas en `config.js` si prefieres otros nombres.

e

Nota: pediste "ocho calaveras" en la descripción general pero luego
detallaste la interacción para 7, así que dejé el arreglo `CONFIG.skulls`
con 7 entradas (es lo que encaja con el resto de la mecánica que
describiste). Añadir una octava es copiar/pegar un bloque más dentro del
arreglo — todo el sistema (colliders, distancias, acoplamiento) es
completamente dinámico según cuántas entradas tenga `CONFIG.skulls`.

## Cómo correrlo

Los navegadores bloquean `loadImage`/`loadSound` si abres `index.html`
directamente como archivo (`file://`). Necesitas un servidor local:

```bash
# Python
python3 -m http.server 8000
# luego abre http://localhost:8000

# o con Node
npx serve .
```

## Resolución de tus sprites (4K) y escala del canvas

Tus sprites están en 3840x2160. El canvas real que se muestra en el
navegador se calcula como `sourceW*scale x sourceH*scale` (con
`scale: 0.5` → 1920x1080), definido en `CONFIG.canvas`. **Todas** las
posiciones y colliders de `config.js` se escriben en las coordenadas
originales de 4K (las mismas que ves en tu editor de imagen) — el
código las convierte solo, no tienes que hacer la cuenta tú.

Si quieres un canvas todavía más liviano en pantallas chicas, baja
`scale` (por ejemplo `0.35`). Ojo: esto reduce el tamaño de *render*,
no el peso de *descarga* — si te importa el tiempo de carga de la
página, exporta también versiones más comprimidas de los PNG/MP3
desde tu editor, ya que el navegador igual descarga el archivo
original completo aunque se dibuje más chico.

## Cómo calibrar los colliders (posiciones/tamaños)

1. Corre la simulación y presiona **D** — vas a ver rectángulos de
   depuración dibujados sobre cada personaje, con su ω y θ actuales.
2. Ajusta `collider: {x, y, w, h}` de cada calavera / de la cantante en
   `config.js` hasta que el rectángulo quede sobre la calavera real de
   tu sprite (todas las imágenes se dibujan a pantalla completa, así
   que el collider es lo único que define "dónde" está cada personaje
   para efectos de clic).
3. `pos: {x, y}` es distinto del collider: es el punto que se usa para
   calcular distancias en el acoplamiento de Kuramoto (qué tan cerca
   están dos calaveras entre sí). Puedes dejarlo aproximadamente en el
   centro del sprite — no necesita ser exacto, solo relativo.

## Cómo se mapea el modelo de Kuramoto a la escena

- Cada personaje (cantante + 7 calaveras) es un oscilador con fase `θ`
  y frecuencia natural `ω`, actualizados cada frame con:

  `dθ_i/dt = ω_i + (K/N) · Σ_j w_ij · sin(θ_j − θ_i)`

- **El picoteo/canto ocurre cuando `θ` completa una vuelta** (pasa por
  un múltiplo de 2π) — igual que el modelo clásico de luciérnagas
  sincronizándose por parpadeos. No hay un contador aparte: el propio
  ángulo de Kuramoto ES el reloj de cada personaje.
- `w_ij` (el peso de acoplamiento) no es uniforme:
  - Si la fuente `j` es la cantante, su influencia se multiplica por
    `singerWeightMult` → ella "rige el tiempo" con más peso que
    cualquier calavera.
  - Para cualquier par, el peso decae exponencialmente con la
    distancia real entre sus posiciones lógicas (`distanceFalloff`)
    → las calaveras cercanas se sincronizan más rápido entre sí que
    con las lejanas, y con la cantante según su propia distancia.
- Esto es exactamente lo que describiste como "las calaveras se van
  asustando entre sí y sincronizando de a poco": no es una mecánica
  aparte, es el acoplamiento del modelo funcionando — cráneos cercanos
  jalan sus fases entre sí en cada frame.
- **Clic en una calavera** = espantar al ave: cancela cualquier sprite
  o audio en curso, suena `ave.mp3`, y perturba `θ` con un salto
  aleatorio grande, empujando a esa calavera de vuelta al caos y
  deshaciendo el progreso de sincronización que llevaba con sus
  vecinas (que luego se reconstruye solo, por el acoplamiento).
- **Flechas ↑ / ↓** cambian `ω` de la cantante (su velocidad base),
  lo que desplaza el ritmo de todo el sistema porque su fase pesa más
  en las ecuaciones de las demás.

## Ajustes útiles en `config.js`

| Parámetro | Efecto |
|---|---|
| `kuramoto.K` | Fuerza global de sincronización. Más alto = todos convergen más rápido. |
| `kuramoto.singerWeightMult` | Cuánto manda la cantante sobre el resto. |
| `kuramoto.distanceFalloff` | Alcance del acoplamiento por distancia (más alto = influye más lejos). |
| `kuramoto.scarePerturbMin/Max` | Qué tan fuerte desincroniza el clic a una calavera. |
| `singer.omegaBase / omegaStep` | Velocidad inicial de la cantante y cuánto cambia por flecha. |
| `skulls[i].omegaBase` | Frecuencia natural de cada calavera antes de sincronizarse. |
| `timing.peckDuration` | Segundos que se ve el sprite de "ave picoteando" antes del grito. |
