# Aethero — Termux Edition

<p align="left">
  <img src="https://img.shields.io/badge/branch-termux-blue.svg" alt="Branch" />
  <img src="https://img.shields.io/badge/platform-Android%20%7C%20Termux-brightgreen.svg" alt="Platform" />
  <img src="https://img.shields.io/badge/node-%3E%3D18.0.0-informational.svg" alt="Node" />
  <img src="https://img.shields.io/badge/engine-Zero--Native%20V8-orange.svg" alt="Engine" />
  <img src="https://img.shields.io/badge/license-MIT-green.svg" alt="License" />
</p>

Esta rama contiene la adaptación de **Aethero** configurada para ejecutarse en **Termux (Android ARM64 / Bionic libc)** y entornos donde las dependencias nativas compiladas en C++ presentan incompatibilidad.

Para la guía completa de arquitectura, ciclo de vida, builders, handlers y desarrollo de plugins, consulta la [Documentación en la rama main](https://github.com/Syllkom/Aethero/tree/main).

---

## Modificaciones de esta rama

| Componente | Implementación en esta rama |
|---|---|
| **Base de datos** | `@syllkom/hyper-db` en modo V8 Atomic FS (sin dependencias C++ ni enlaces nativos a LMDB). |
| **Multimedia** | `ffmpegResolver` dinámico con detección del binario en el `$PATH` del sistema (`pkg install ffmpeg`). |
| **Gráficos** | Soporte para `@napi-rs/canvas` preservado para la compatibilidad con plugins visuales. |
| **Conectividad** | Control de reconexión centralizado para evitar sockets duplicados y doble respuesta a comandos. |

---

## Instalación y Arranque en Termux

### 1. Dependencias del sistema

```bash
pkg update -y
pkg install -y git nodejs-lts ffmpeg
```

### 2. Despliegue del repositorio

```bash
git clone -b termux https://github.com/Syllkom/Aethero.git
cd Aethero
npm install
npm start
```

---

## Referencias

- [Documentación Principal de Aethero](https://github.com/Syllkom/Aethero/blob/main/README.md)
- [Repositorio de HyperDB (Edición Zero-Native)](https://github.com/Syllkom/hyper-db)