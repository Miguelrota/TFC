# Facturas GForma

Sistema de extraccion automatica de datos de facturas mediante inteligencia artificial usando Mindee y persistencia en SQL Server.

## Tecnologias

- Backend / entorno: Node.js + Electron
- IA: Mindee API
- Frontend: HTML, CSS y JavaScript
- Base de datos: Microsoft SQL Server
- Build: Electron Builder

## Requisitos previos

- Node.js v14 o superior
- Microsoft SQL Server con una base de datos creada
- Cuenta en Mindee con API key para extraccion de facturas

## Configuracion y seguridad

> [!IMPORTANT]
> No subas contrasenas ni tokens reales al repositorio.

1. Clona el repositorio.
2. Copia el archivo `.env.example` y renombralo a `.env`.
3. Edita `.env` con tus credenciales reales.

```env
DB_USER=tu_usuario
DB_PASSWORD=tu_contrasena
DB_SERVER=localhost
DB_NAME=GestionFormacion
DB_PORT=1433
DB_TRUST_SERVER_CERTIFICATE=true
MINDEE_API_KEY=tu_api_key_de_mindee
```

## Instalacion y ejecucion

```bash
npm install
npm start
```

## Base de datos

El esquema principal de la base de datos esta en `database/schema.sql`.

Para crear la estructura inicial:

1. Abre tu gestor de base de datos, por ejemplo SQL Server Management Studio.
2. Conectate a la base de datos `GestionFormacion`.
3. Ejecuta el script `database/schema.sql`.

## Estructura del proyecto

```text
Facturas GForma/
├── config/          # Archivos XML y configuraciones
├── database/        # Scripts SQL y gestion de DB
├── docs/            # Memoria del proyecto en PDF
├── js/              # Logica de la interfaz
├── services/        # Logica de servidor
├── views/           # Vistas HTML
├── main.js          # Punto de entrada de Electron
└── index.html       # Interfaz principal
```

## Licencia

Propiedad y uso restringido para el proyecto formativo.
