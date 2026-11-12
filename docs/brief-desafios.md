# Brief para la versión en primera persona: falta desafío

Comentario de Francisco (12-nov): «siento que no hay desafíos, es como solo avanzar, no
tiene ninguna dificultad. En el otro juego hay tiempo, chocas a los pacos; aquí no hay
nada, es solo avanzar, no tiene sentido».

Diagnóstico: el jugador nunca tiene algo que **perder o ganar en los próximos 5 segundos**.
Avanzar no cuesta, saltar no cuesta, y lo que ya existe (pacos, monedas, mar) no se siente
porque no hay un objetivo claro ni una presión visible todo el tiempo.

## 1. Un objetivo claro y visible siempre (lo más importante)

- **Recorrido con meta: ADUANA → REÑACA, 8 hitos** (ver `ruta-lugares-iconicos.md`). Arriba,
  una barra de progreso con los 8 nombres y la micro avanzando por ella. Saber «me faltan 3
  paraderos» convierte avanzar en progreso.
- **Reloj regresivo por tramo**: 20–30 segundos para llegar al siguiente hito. Al pasar un
  hito se suma tiempo (+15 s). Si llega a cero, **se acaba la partida** («llegaste tarde al
  turno»). Este es el mecanismo que Francisco echa de menos del otro juego: tiempo.
- Partida objetivo: 90–120 segundos para llegar a Reñaca. Si llega, fuegos artificiales y
  puntaje; si no, GAME OVER con «llegaste hasta: Caleta Portales».

## 2. Presión constante, no solo al final

- **Los pacos tienen que verse en pantalla y acercarse de verdad**: espejo retrovisor
  grande con la patrulla creciendo, sirena que sube de volumen. Cada vez que frenas o
  chocas, se acerca un tramo. Cuando está a 1 segundo, la pantalla parpadea rojo-azul.
- **Los pasajeros son la vida**: barra de pasajeros = vida. Si llegas a 0 pasajeros, se
  acaba la partida («nadie te paga, te echan de la empresa»). Hoy perder pasajeros no
  tiene costo real.
- **Combustible/plata**: la bencina baja y solo se recarga con la plata que ganas. Si no
  recoges pasajeros ni monedas, te quedas en pana.

## 3. Que saltar sea una decisión, no algo que pasa solo

- **Botón para saltar / acelerar fuerte antes de la cima** (B1): saltar bien = llegar
  lejos y agarrar monedas aéreas; saltar mal = aterrizar chueco y botar pasajeros. Hoy el
  salto es automático, así que no hay habilidad.
- **Aterrizaje con timing**: si aprietas el botón al tocar el suelo, aterrizaje perfecto
  (no cae nadie, +$). Como el «perfect landing» de los juegos de moto.
- Los saltos sobre el mar y sobre la Quinta Vergara tienen premio grande solo si vas a
  velocidad; si vas lento, caes. Hoy eso ya existe pero el jugador no sabe que viene:
  **avisar con un letrero 2 segundos antes**: «¡MIRADOR! acelera o caes al mar».

## 4. Obstáculos que obliguen a hacer algo, con identidad por hito

Hoy perros y curaos se esquivan sin pensar. Cada hito trae un obstáculo propio que pide
una acción distinta:

| Hito | Obstáculo | Qué obliga a hacer |
|---|---|---|
| Aduana | Camiones del puerto cruzando | Frenar o esquivar |
| Congreso | Políticos en fila cruzando lento | Esquivar o atropellar (bonus sucio, pero se acercan los pacos) |
| Caleta Portales | Lobos marinos de 300 kg echados en la calle | Esquivar: si chocas, frenas a 0 y los pacos te alcanzan |
| Santa María | Montón de estudiantes en el paradero | Parar y abrir puerta (pagan poco, pero son muchos) |
| Caleta Abarca | Bañistas con flotador, Reloj de Flores | Pasar por el lado correcto; aterrizar sobre el reloj castiga |
| Sheraton | Artista del Festival pide subir | Frenar, abrir puerta, paga $5.000 |
| Quinta Vergara | De noche, reflectores, fans corriendo | Saltar sobre la Quinta = gaviota de plata |
| Reñaca | Cuicos jugando paleta cruzan sin mirar | Esquivar: si les pegas te demandan (-$1.000) |

## 5. Riesgo/recompensa en la puerta y el timbre

- Puerta abierta en un salto = los pasajeros salen volando por la puerta (más que por
  las ventanas). Cerrar la puerta a tiempo es una decisión.
- Timbre: si no paras, el pasajero se tira y los pacos se acercan (te denuncian).
- Paradero: parar cuesta tiempo del reloj; no parar cuesta plata. Elegir.

## 6. Dificultad creciente y partida corta

- Cada hito aumenta la velocidad base un 8 % y el número de obstáculos.
- Partida ideal 90–120 s para arcade con cola de gente. Que la mayoría muera en Caleta
  Abarca o el Sheraton la primera vez y quiera volver a jugar para ver Reñaca.
- Tabla de puntaje al final con el hito al que llegaste: «Llegaste a: QUINTA VERGARA».

## 7. Que se note en pantalla (feedback)

- Números grandes al ganar/perder plata (+$700, -3 pasajeros) saliendo del punto donde
  pasó.
- Sacudida de cámara y flash al chocar; pantalla roja breve al perder pasajeros.
- Sonidos distintos por evento: moneda, pasajero sube, pasajero vuela, sirena, paleta.

## Orden sugerido para implementar

1. Hitos + barra de progreso + reloj regresivo por tramo (da sentido a todo).
2. Pasajeros = vida, pacos visibles acercándose.
3. Salto con botón y aterrizaje con timing.
4. Obstáculos por hito (empezar por políticos, lobos y cuicos).
5. Fuegos artificiales al llegar a Reñaca.
