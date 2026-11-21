# Modelo y animaciones (no incluidos)

El personaje y sus animaciones vienen de [Mixamo](https://www.mixamo.com) (Adobe).
Son gratis, pero su licencia no permite redistribuir los archivos, así que cada
persona los descarga con su propia cuenta de Adobe (gratuita).

## Qué descargar

| Qué buscar en Mixamo | Opciones de descarga | Guardar aquí como |
|---|---|---|
| Personaje **Y Bot** | FBX Binary · T-pose | `character.fbx` |
| Animación **Idle** | FBX Binary · *Without Skin* | `idle.fbx` |
| Animación **Waving** | FBX Binary · *Without Skin* | `wave.fbx` |
| Animación **Walking** | FBX Binary · *Without Skin* | `walk.fbx` |
| Animación **Running** | FBX Binary · *Without Skin* | `run.fbx` |
| Animación **Jump** | FBX Binary · *Without Skin* | `jump.fbx` |
| Animación **Punching** | FBX Binary · *Without Skin* | `punch.fbx` |

Para las animaciones, selecciona primero el Y Bot como personaje y luego busca cada animación.
No hace falta marcar *In Place*: el código quita el desplazamiento de la cadera
(`#stripRootMotion` en `js/character.js`) para mover al personaje por su cuenta.

Cuando termines, esta carpeta debe tener los 7 archivos `.fbx` con esos nombres exactos.
