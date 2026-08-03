# 🏥 CEHAQ - Sistema de Gestión de Bodega

Sistema web para la gestión integral de insumos clínicos del Centro de Especialidades Hospitalarias de Alta Quilpué (CEHAQ). Permite administrar inventario, movimientos de entrada/salida, control de stock crítico, vencimientos y generación de planillas de entrega.

![Versión](https://img.shields.io/badge/versión-5.0.0-blue)
![Supabase](https://img.shields.io/badge/backend-Supabase-green)
![Render](https://img.shields.io/badge/deploy-Render-46e3b7)
![PWA](https://img.shields.io/badge/PWA-ready-purple)

---

## 📋 Características

### 🔐 Autenticación y Roles
- Sistema de login con encriptación SHA-256
- Roles de usuario: **Admin** y **Usuario**
- Registro de nuevos usuarios con activación por administrador
- Selección de área de trabajo: **Bodega** o **Botiquín**

### 📦 Gestión de Inventario
- CRUD completo de insumos
- Organización por secciones y anaqueles (solo Bodega)
- Control de stock con alertas de nivel crítico
- Seguimiento de lotes y fechas de vencimiento
- Soporte para códigos de barras (escaneo y pistoleo)
- Búsqueda avanzada con filtros combinados

### 📊 Dashboard
- Tarjetas resumen: total insumos, stock total, secciones activas
- Alertas de stock crítico
- Próximos a vencer y vencidos
- Visualización adaptable para Bodega (5 cards) y Botiquín (4 cards)

### 🔄 Movimientos
- Registro de ingresos con autocompletado por código de barras
- Selector de lotes existentes al ingresar
- Salidas individuales y masivas
- Historial completo de movimientos con filtros
- Exportación a Excel (CSV)

### 📄 Planilla de Salida (Escritorio)
- Formulario de entrega masiva
- Datos del receptor (nombre, cargo, motivo)
- Lista de insumos con cantidades
- Formato imprimible con sección de firmas
- Procesamiento de salida en lote

### 📱 Diseño Responsive
- Interfaz adaptada para escritorio y dispositivos móviles
- Sidebar colapsable en móvil
- Escaneo de códigos de barras con cámara en móvil
- Modales optimizados para pantallas táctiles
- PWA instalable con soporte offline básico

---

## 🛠️ Tecnologías

| Tecnología | Uso |
|------------|-----|
| **HTML5 / CSS3** | Estructura y estilos |
| **JavaScript (Vanilla)** | Lógica del frontend |
| **Supabase** | Backend como servicio (PostgreSQL) |
| **Render** | Hosting y despliegue |
| **html5-qrcode** | Escaneo de códigos de barras |
| **Service Worker** | Soporte PWA y offline |
| **CSS Grid / Flexbox** | Layout responsive |

---

## 📁 Estructura del Proyecto
/
├── index.html # Dashboard principal
├── login.html # Inicio de sesión
├── seleccionar.html # Selección de bodega/botiquín
├── inventario.html # Página de inventario
├── movimientos.html # Historial de movimientos
├── salida-planilla.html # Planilla de salida (escritorio)
├── manifest.json # Configuración PWA
├── css/
│ └── styles.css # Estilos globales
├── js/
│ ├── config.js # Configuración y autenticación
│ ├── database.js # Operaciones con Supabase
│ ├── ui.js # Utilidades de interfaz
│ ├── app.js # Lógica core compartida
│ ├── dashboard.js # Módulo del dashboard
│ ├── inventario.js # Módulo de inventario
│ ├── movimientos.js # Módulo de movimientos
│ ├── modales.js # Gestión de modales
│ ├── scanner.js # Módulo de escáner
│ ├── salida-planilla.js # Módulo de planilla
│ └── service-worker.js # Service Worker PWA
└── img/
└── escudo.svg # Logo CEHAQ


---

## 🚀 Instalación y Configuración

### Requisitos Previos
- Cuenta en [Supabase](https://supabase.com)
- Cuenta en [Render](https://render.com) (o cualquier hosting estático)
- Navegador moderno con soporte JavaScript

### Configuración de Supabase

1. Crea un proyecto en Supabase
2. Ejecuta el siguiente SQL en el editor:

```sql
-- Tabla de usuarios
CREATE TABLE usuarios (
    id SERIAL PRIMARY KEY,
    usuario VARCHAR(50) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    nombre VARCHAR(100),
    rol VARCHAR(20) DEFAULT 'pendiente',
    activo BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Tabla de inventario
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

-- Tabla de movimientos
CREATE TABLE movimientos (
    id SERIAL PRIMARY KEY,
    fecha TIMESTAMP DEFAULT NOW(),
    tipo VARCHAR(30) NOT NULL,
    insumo VARCHAR(200),
    cantidad INTEGER DEFAULT 0,
    stock_anterior INTEGER,
    stock_nuevo INTEGER,
    anaquel VARCHAR(20),
    comentarios TEXT,
    usuario VARCHAR(50),
    bodega VARCHAR(20) DEFAULT 'BODEGA'
);

-- Tabla de secciones
CREATE TABLE secciones (
    id SERIAL PRIMARY KEY,
    seccion VARCHAR(10) NOT NULL,
    descripcion VARCHAR(200),
    anaquel VARCHAR(10) NOT NULL,
    bodega VARCHAR(20) DEFAULT 'BODEGA',
    UNIQUE(seccion, anaquel, bodega)
);

-- Tabla de unidades de medida
CREATE TABLE unidades_medida (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(50) NOT NULL,
    bodega VARCHAR(20) DEFAULT 'BODEGA',
    UNIQUE(nombre, bodega)
);

-- Tabla de configuración
CREATE TABLE configuracion (
    id SERIAL PRIMARY KEY,
    porcentaje_critico INTEGER DEFAULT 20,
    dias_vencimiento INTEGER DEFAULT 30,
    bodega VARCHAR(20) DEFAULT 'BODEGA'
);

-- Insertar configuración por defecto
INSERT INTO configuracion (porcentaje_critico, dias_vencimiento, bodega) VALUES (20, 30, 'BODEGA');
INSERT INTO configuracion (porcentaje_critico, dias_vencimiento, bodega) VALUES (20, 30, 'BOTIQUIN');

-- Crear usuario admin por defecto
-- Contraseña: admin123 (encriptada con SHA-256)
INSERT INTO usuarios (usuario, password, nombre, rol, activo) 
VALUES ('admin', '240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a9', 'Administrador', 'admin', true);

Obtén las credenciales de tu proyecto Supabase (URL y ANON_KEY)

Actualiza el archivo js/config.js:

const SUPABASE_URL = 'https://tu-proyecto.supabase.co';
const SUPABASE_ANON_KEY = 'tu-anon-key';

Despliegue en Render
Conecta tu repositorio de GitHub con Render

Crea un nuevo Static Site

Configura:

Build Command: (dejar vacío)

Publish Directory: . (raíz)

¡Desplegar!

🔑 Credenciales por Defecto
Usuario	Contraseña	Rol
admin	admin123	Admin
⚠️ Importante: Cambia la contraseña del admin después del primer inicio de sesión.

📱 Instalación como PWA
El sistema puede instalarse como aplicación en dispositivos móviles:

Accede a la URL desde Chrome/Safari en tu dispositivo

Chrome: Toca el menú ⋮ → "Instalar aplicación"

Safari (iOS): Toca el botón Compartir → "Agregar a inicio"

🎯 Flujo de Trabajo
Bodega
Configurar secciones y anaqueles → Crear estructura organizativa

Configurar unidades de medida → Definir unidades disponibles

Ingresar insumos → Registrar con código de barras, lote y vencimiento

Gestionar salidas → Individuales o mediante planilla

Monitorear dashboard → Revisar alertas y stock crítico

Botiquín
Configurar unidades de medida → Solo unidades (sin secciones)

Ingresar fármacos → Control por lote y vencimiento

Gestionar salidas → Registro de medicamentos entregados

Monitorear vencimientos → Alertas de productos próximos a vencer

🔍 Funcionalidades Específicas
Código de Barras
Escritorio: Pistoleo directo al campo de código

Móvil: Botón de escaneo con cámara

Autocompletado de datos al detectar código existente

Selector de lotes al ingresar productos ya registrados

Planilla de Salida (Solo Escritorio)
Búsqueda y selección múltiple de insumos

Datos del receptor para registro

Formato imprimible con firmas

Procesamiento masivo de salidas

Alertas
Stock crítico: Productos bajo el porcentaje configurado

Por vencer: Productos que vencen dentro de los días configurados

Vencidos: Productos con fecha de vencimiento pasada

📊 Exportación de Datos
Inventario: Exportación CSV con todos los campos

Movimientos: Exportación CSV con filtros aplicados

Compatible con Excel y Google Sheets

🛡️ Seguridad
Contraseñas encriptadas con SHA-256

Autenticación por sesión (localStorage)

Roles de usuario con permisos diferenciados

Registro de auditoría en movimientos

Activación de usuarios por administrador

📝 Notas de Desarrollo
Navegador Recomendado
Google Chrome (última versión)

Microsoft Edge (última versión)

Safari (iOS 14+)

Limitaciones
La versión móvil no incluye la funcionalidad de planilla de salida

El modo offline solo cachea archivos estáticos (requiere conexión para operaciones CRUD)

El escáner de códigos de barras requiere permisos de cámara en móvil

🤝 Contribución
Para contribuir al proyecto:

Fork del repositorio

Crea una rama para tu feature (git checkout -b feature/nueva-funcionalidad)

Commit de cambios (git commit -m 'Agrega nueva funcionalidad')

Push a la rama (git push origin feature/nueva-funcionalidad)

Abre un Pull Request

📄 Licencia
Este proyecto es de uso interno del Centro de Especialidades Hospitalarias de Alta Quilpué (CEHAQ).

📞 Soporte
Para consultas o soporte técnico, contactar al equipo de desarrollo.

CEHAQ - Sistema de Bodega v5.0.0
Desarrollado con ❤️ para el sector salud
