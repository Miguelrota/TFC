# Facturas GForma

Sistema de extracción automática de datos de facturas mediante inteligencia artificial usando la API de Mindee y persistencia en SQL Server. Proyecto final.

## Tecnologías

- **Backend / Entorno**: Node.js + Electron
- **IA**: Mindee API (Procesamiento de facturas)
- **Frontend**: HTML/CSS/JavaScript puro
- **Base de datos**: Microsoft SQL Server
- **Build**: Electron Builder

## Requisitos Previos

- **Node.js** (v14 o superior)
- **Microsoft SQL Server** con una base de datos creada.
- Cuenta en [Mindee](https://mindee.com/) con API key para extracción de facturas.

## Configuración y Seguridad

> [!IMPORTANT]
> **Seguridad básica:** No se deben subir contraseñas ni tokens reales al repositorio.

1. Clona el repositorio.
2. Copia el archivo `.env.example` y renómbralo a `.env`.
3. Edita el archivo `.env` para incluir tus credenciales reales:

```env
DB_USER=tu_usuario
DB_PASSWORD=tu_contraseña
DB_SERVER=localhost
DB_NAME=GestionFormacion
DB_PORT=1433
DB_TRUST_SERVER_CERTIFICATE=true
MINDEE_API_KEY=tu_api_key_de_mindee
```

## Instalación y Ejecución

```bash
# Instalar dependencias
npm install

# Iniciar la aplicación en modo desarrollo
npm start
```

## Carga de Datos de Ejemplo

Para poblar la base de datos con información inicial necesaria para el funcionamiento (como sociedades o tipos de proveedores):
1. Abre tu gestor de base de datos (SQL Server Management Studio u otro).
2. Conéctate a la base de datos `GestionFormacion`.
3. Ejecuta el script `/database/seed.sql`.

## Estructura del Proyecto

```
Facturas GForma/
├── config/          # Archivos XML y configuraciones
├── css/             # Estilos de la aplicación
├── database/        # Scripts SQL y gestión de DB
├── docs/            # Memoria del proyecto en PDF/MD
├── js/              # Lógica del cliente UI
├── services/        # Lógica de servidor (Mindee, SQL, XML)
├── views/           # Vistas en HTML
├── main.js          # Punto de entrada de Electron
└── index.html       # Interfaz principal
```

## Licencia

Propiedad y uso restringido para el proyecto formativo.
