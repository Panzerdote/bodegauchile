# 🏥 CEHAQ - Sistema de Gestión de Bodega

> Sistema web para la gestión integral de insumos clínicos del **Centro de Entrenamiento en Habilidades Quirúrgicas (CEHAQ) - U. de Chile**.

Administra inventario, movimientos, control de stock crítico, vencimientos, códigos de barras y planillas de entrega desde una interfaz rápida, responsive y preparada para instalarse como aplicación (PWA).

<p align="center">

![Versión](https://img.shields.io/badge/Versión-5.0.0-blue?style=for-the-badge)
![Supabase](https://img.shields.io/badge/Backend-Supabase-3FCF8E?style=for-the-badge&logo=supabase&logoColor=white)
![Render](https://img.shields.io/badge/Deploy-Render-46E3B7?style=for-the-badge&logo=render&logoColor=white)
![PWA](https://img.shields.io/badge/PWA-Ready-purple?style=for-the-badge)

</p>

---

# 📑 Tabla de Contenidos

- [Características](#-características)
- [Tecnologías](#-tecnologías)
- [Estructura del Proyecto](#-estructura-del-proyecto)
- [Instalación](#-instalación)
- [Configuración de Supabase](#-configuración-de-supabase)
- [Despliegue](#-despliegue-en-render)
- [Credenciales Iniciales](#-credenciales-iniciales)
- [Instalación como PWA](#-instalación-como-pwa)
- [Flujo de Trabajo](#-flujo-de-trabajo)
- [Exportación](#-exportación-de-datos)
- [Seguridad](#-seguridad)
- [Limitaciones](#-limitaciones)
- [Contribución](#-contribución)
- [Licencia](#-licencia)

---

# ✨ Características

## 🔐 Autenticación

- Login seguro con **SHA-256**
- Roles:
  - 👑 Administrador
  - 👤 Usuario
- Registro de usuarios con aprobación del administrador
- Selección de área de trabajo:
  - 📦 Bodega
  - 💊 Botiquín

---

## 📦 Gestión de Inventario

- ✅ CRUD completo de insumos
- ✅ Organización por secciones y anaqueles
- ✅ Control de stock
- ✅ Alertas de stock crítico
- ✅ Control por lote
- ✅ Control de vencimientos
- ✅ Código de barras
- ✅ Escaneo mediante cámara
- ✅ Búsqueda avanzada

---

## 📊 Dashboard

### Bodega

- Total de insumos
- Stock total
- Secciones activas
- Stock crítico
- Productos próximos a vencer

### Botiquín

- Total de insumos
- Stock total
- Stock crítico
- Vencimientos

---

## 🔄 Movimientos

- Registro de ingresos
- Registro de salidas
- Salidas masivas
- Historial completo
- Exportación CSV
- Autocompletado por código de barras
- Selección automática de lotes existentes

---

## 📄 Planilla de Salida

*(Disponible solo en escritorio)*

- Datos del receptor
- Cargo
- Motivo
- Selección múltiple de insumos
- Impresión lista para firmas
- Procesamiento masivo

---

## 📱 Diseño Responsive

- Compatible con PC
- Tablets
- Teléfonos
- Sidebar adaptable
- Modales optimizados
- Escáner mediante cámara
- Aplicación PWA

---

# 🛠 Tecnologías

| Tecnología | Descripción |
|------------|-------------|
| HTML5 | Estructura |
| CSS3 | Estilos |
| JavaScript Vanilla | Frontend |
| Supabase | Base de datos PostgreSQL |
| Render | Hosting |
| html5-qrcode | Escaneo de códigos |
| Service Worker | PWA |
| CSS Grid / Flexbox | Responsive |

---

# 📁 Estructura del Proyecto

```text
/
│
├── index.html
├── login.html
├── seleccionar.html
├── inventario.html
├── movimientos.html
├── salida-planilla.html
├── manifest.json
│
├── css/
│   └── styles.css
│
├── js/
│   ├── app.js
│   ├── config.js
│   ├── dashboard.js
│   ├── database.js
│   ├── inventario.js
│   ├── modales.js
│   ├── movimientos.js
│   ├── scanner.js
│   ├── salida-planilla.js
│   ├── service-worker.js
│   └── ui.js
│
└── img/
    └── escudo.svg
```

---

# 🚀 Instalación

## Requisitos

- Cuenta en Supabase
- Cuenta en Render (o cualquier hosting estático)
- Navegador moderno

---

# ⚙ Configuración de Supabase

## 1. Crear un proyecto

Crear un nuevo proyecto desde Supabase.

---

## 2. Ejecutar el siguiente SQL

```sql
-- Tabla usuarios
CREATE TABLE usuarios (
    id SERIAL PRIMARY KEY,
    usuario VARCHAR(50) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    nombre VARCHAR(100),
    rol VARCHAR(20) DEFAULT 'pendiente',
    activo BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Tabla inventario
CREATE TABLE inventario (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(200) NOT NULL,
    seccion VARCHAR(10),
    anaquel VARCHAR(20),
    stock INTEGER DEFAULT 0,
    unidad VARCHAR(50),
    lote VARCHAR(100),
    vencimiento DATE,
    codigo_barras VARCHAR(100),
    comentarios TEXT,
    bodega VARCHAR(20) DEFAULT 'BODEGA',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Tabla movimientos
CREATE TABLE movimientos (
    id SERIAL PRIMARY KEY,
    fecha TIMESTAMP DEFAULT NOW(),
    tipo VARCHAR(30),
    insumo VARCHAR(200),
    cantidad INTEGER,
    stock_anterior INTEGER,
    stock_nuevo INTEGER,
    anaquel VARCHAR(20),
    comentarios TEXT,
    usuario VARCHAR(50),
    bodega VARCHAR(20) DEFAULT 'BODEGA'
);

-- Tabla secciones
CREATE TABLE secciones (
    id SERIAL PRIMARY KEY,
    seccion VARCHAR(10),
    descripcion VARCHAR(200),
    anaquel VARCHAR(10),
    bodega VARCHAR(20) DEFAULT 'BODEGA',
    UNIQUE(seccion, anaquel, bodega)
);

-- Tabla unidades
CREATE TABLE unidades_medida (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(50),
    bodega VARCHAR(20) DEFAULT 'BODEGA',
    UNIQUE(nombre, bodega)
);

-- Tabla configuración
CREATE TABLE configuracion (
    id SERIAL PRIMARY KEY,
    porcentaje_critico INTEGER DEFAULT 20,
    dias_vencimiento INTEGER DEFAULT 30,
    bodega VARCHAR(20)
);

INSERT INTO configuracion VALUES
(DEFAULT,20,30,'BODEGA'),
(DEFAULT,20,30,'BOTIQUIN');

INSERT INTO usuarios
(usuario,password,nombre,rol,activo)
VALUES
(
'admin',
'240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a9',
'Administrador',
'admin',
true
);
```

---

## 3. Configurar credenciales

Editar:

```javascript
// js/config.js

const SUPABASE_URL = "https://tu-proyecto.supabase.co";
const SUPABASE_ANON_KEY = "TU_ANON_KEY";
```

---

# ☁ Despliegue en Render

1. Subir el proyecto a GitHub.
2. Crear un **Static Site**.
3. Configurar:

| Opción | Valor |
|---------|------|
| Build Command | *(vacío)* |
| Publish Directory | `.` |

Deploy.

---

# 🔑 Credenciales Iniciales

| Usuario | Contraseña | Rol |
|----------|------------|-----|
| admin | admin123 | Administrador |

> ⚠️ Se recomienda cambiar la contraseña después del primer inicio de sesión.

---

# 📱 Instalación como PWA

## Android (Chrome)

```
Menú ⋮
↓
Instalar aplicación
```

## iPhone (Safari)

```
Compartir
↓
Agregar a inicio
```

---

# 🔄 Flujo de Trabajo

## 📦 Bodega

1. Configurar secciones
2. Configurar anaqueles
3. Configurar unidades
4. Registrar insumos
5. Gestionar ingresos
6. Gestionar salidas
7. Revisar Dashboard

---

## 💊 Botiquín

1. Configurar unidades
2. Registrar medicamentos
3. Gestionar entregas
4. Controlar vencimientos

---

# 🔍 Funcionalidades

## Código de Barras

### Escritorio

- Pistoleo directo

### Móvil

- Escaneo mediante cámara

Funciones:

- Autocompletado
- Detección de productos existentes
- Selección automática de lotes

---

## 🚨 Alertas

- 🔴 Stock crítico
- 🟡 Próximos a vencer
- ⚫ Productos vencidos

---

# 📊 Exportación de Datos

Se puede exportar:

- Inventario
- Movimientos

Formato:

- CSV
- Compatible con Excel
- Compatible con Google Sheets

---

# 🔒 Seguridad

- Contraseñas SHA-256
- Sesiones mediante LocalStorage
- Roles de usuario
- Registro de auditoría
- Activación de usuarios por administrador

---

# ⚠ Limitaciones

- La planilla de salida solo está disponible en escritorio.
- El modo offline solo almacena archivos estáticos.
- El escáner requiere permisos de cámara.

---

# 🤝 Contribución

```bash
# Fork

# Crear rama
git checkout -b feature/nueva-funcionalidad

# Commit
git commit -m "Nueva funcionalidad"

# Push
git push origin feature/nueva-funcionalidad
```

Luego abrir un Pull Request.

---

# 📄 Licencia

Proyecto de uso interno del

**Centro de Entrenamiento en Habilidades Quirúrgicas (CEHAQ) - U. de Chile.**

---

# ❤️ Desarrollo

Desarrollado para apoyar la gestión clínica y logística del CEHAQ.

**Versión 5.0.0**
