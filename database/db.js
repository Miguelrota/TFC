/* ═══════════════════════════════════════════════════════════════
   DATABASE/DB.JS — Conexión SQL Server dinámica
   ═══════════════════════════════════════════════════════════════ */

const sql = require('mssql');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { app } = require('electron');

/* ─── Credenciales de servicio ──────────────────────────────── */
const SERVICE_USER = 'us_AccesoTotal';
const SERVICE_PASSWORD = 'us_Ilimitado';

/* ─── Ruta del archivo XML de configuración ─────────────────── */
function getConfigPath() {
  const userDataPath = app.getPath('userData');
  const userConfigPath = path.join(userDataPath, 'config', 'Config.xml');
  
  if (fs.existsSync(userConfigPath)) {
    return userConfigPath;
  }

  // If not in userData, try to get it from the resources folder (packaged) or root (dev)
  let defaultSource = '';
  if (app.isPackaged) {
    defaultSource = path.join(process.resourcesPath, 'Config.xml');
  } else {
    defaultSource = path.join(app.getAppPath(), 'Config.xml');
  }

  if (fs.existsSync(defaultSource)) {
    try {
      const configDir = path.join(userDataPath, 'config');
      if (!fs.existsSync(configDir)) {
        fs.mkdirSync(configDir, { recursive: true });
      }
      fs.copyFileSync(defaultSource, userConfigPath);
      console.log('[DB] Config.xml inicial copiado desde:', defaultSource);
    } catch (err) {
      console.error('[DB] Error al copiar Config.xml inicial:', err);
    }
  }
  
  return userConfigPath;
}

/* ─── Leer configuración desde XML ──────────────────────────── */
function readConfig() {
  const configPath = getConfigPath();
  if (!fs.existsSync(configPath)) {
    throw new Error('No hay configuración de conexión guardada. Configura la conexión primero.');
  }

  const raw = fs.readFileSync(configPath, 'utf-8');

  const getText = (tag) => {
    const match = raw.match(new RegExp(`<${tag}[^>]*>([^<]*)</${tag}>`));
    return match ? match[1].trim() : '';
  };

  const conexNodes = [...raw.matchAll(/<Conexion[^>]+Valor="([^"]+)"/g)];
  const conexiones = conexNodes.map(m => m[1]);

  const conexActualId = (() => {
    const m = raw.match(/<ConexionActual[^>]+Id="([^"]+)"/);
    return m ? m[1] : '1';
  })();

  const baseDatosMatch = raw.match(/<BaseDatos>\s*<Valor>([^<]*)<\/Valor>/);
  const database = baseDatosMatch ? baseDatosMatch[1].trim() : '';

  const idCuentaActualMatch = raw.match(/<IdCuentaActual>([^<]*)<\/IdCuentaActual>/);
  const idCuentaActual = idCuentaActualMatch ? idCuentaActualMatch[1].trim() : '';

  const idModelIDActualMatch = raw.match(/<IdModelIDActual>([^<]*)<\/IdModelIDActual>/);
  const idModelIDActual = idModelIDActualMatch ? idModelIDActualMatch[1].trim() : '';

  const idApiKeyActualMatch = raw.match(/<IdApiKeyActual>([^<]*)<\/IdApiKeyActual>/);
  const idApiKeyActual = idApiKeyActualMatch ? idApiKeyActualMatch[1].trim() : '';

  const idProcesoActualMatch = raw.match(/<IdProcesoActual>([^<]*)<\/IdProcesoActual>/);
  const idProcesoActual = idProcesoActualMatch ? idProcesoActualMatch[1].trim() : '';

  const mindeeApiKeyManualMatch = raw.match(/<MindeeApiKeyManual>([^<]*)<\/MindeeApiKeyManual>/);
  const mindeeApiKeyManual = mindeeApiKeyManualMatch ? mindeeApiKeyManualMatch[1].trim() : '';

  const mindeeModelIdManualMatch = raw.match(/<MindeeModelIdManual>([^<]*)<\/MindeeModelIdManual>/);
  const mindeeModelIdManual = mindeeModelIdManualMatch ? mindeeModelIdManualMatch[1].trim() : '';

  const mindeeEndpointManualMatch = raw.match(/<MindeeEndpointManual>([^<]*)<\/MindeeEndpointManual>/);
  const mindeeEndpointManual = mindeeEndpointManualMatch ? mindeeEndpointManualMatch[1].trim() : '';

  const mindeeAccountNameManualMatch = raw.match(/<MindeeAccountNameManual>([^<]*)<\/MindeeAccountNameManual>/);
  const mindeeAccountNameManual = mindeeAccountNameManualMatch ? mindeeAccountNameManualMatch[1].trim() : '';

  const offlineMatch = raw.match(/<ModoOffline>([^<]*)<\/ModoOffline>/);
  const isOffline = (offlineMatch ? offlineMatch[1].trim() === 'Si' : false) || conexiones.length === 0 || !database;

  return {
    conexiones,
    server: conexiones[parseInt(conexActualId) - 1] || conexiones[0],
    database,
    conexionActualId: conexActualId,
    idCuentaActual,
    idModelIDActual,
    idApiKeyActual,
    idProcesoActual,
    mindeeApiKeyManual,
    mindeeModelIdManual,
    mindeeEndpointManual,
    mindeeAccountNameManual,
    isOffline
  };
}

/* ─── Guardar configuración en XML ──────────────────────────── */
function saveConfig({
  server,
  database,
  conexiones,
  idCuentaActual = '',
  idModelIDActual = '',
  idApiKeyActual = '',
  idProcesoActual = '',
  mindeeApiKeyManual = '',
  mindeeModelIdManual = '',
  mindeeEndpointManual = '',
  mindeeAccountNameManual = '',
  isOffline = false
}) {
  const configPath = getConfigPath();

  let finalConexiones = conexiones
    ? [...new Set(conexiones.filter(Boolean))]
    : [];

  if (server && !finalConexiones.includes(server)) {
    finalConexiones.push(server);
  }

  let rutaFondo = '';
  if (fs.existsSync(configPath)) {
    try {
      const raw = fs.readFileSync(configPath, 'utf-8');
      const m = raw.match(/<RutaFondo>(.*?)<\/RutaFondo>/);
      if (m) rutaFondo = `\n  <RutaFondo>${m[1]}<\/RutaFondo>`;
    } catch { /* ignorar */ }
  }

  const idx = finalConexiones.indexOf(server) + 1;

  const conexLines = finalConexiones
    .map((c, i) => `  <Conexion Id="${i + 1}" Valor="${c}"/>`)
    .join('\n');

  const xml = `<?xml version="1.0" encoding="utf-8"?>
<Main>
${conexLines}
  <ConexionActual Id="${idx}"/>
  <BaseDatos>
    <Valor>${database || ''}</Valor>
  </BaseDatos>
  <ModoOffline>${isOffline ? 'Si' : 'No'}</ModoOffline>
  <IdCuentaActual>${idCuentaActual || ''}</IdCuentaActual>
  <IdModelIDActual>${idModelIDActual || ''}</IdModelIDActual>
  <IdApiKeyActual>${idApiKeyActual || ''}</IdApiKeyActual>
  <IdProcesoActual>${idProcesoActual || ''}</IdProcesoActual>
  <MindeeApiKeyManual>${mindeeApiKeyManual || ''}</MindeeApiKeyManual>
  <MindeeModelIdManual>${mindeeModelIdManual || ''}</MindeeModelIdManual>
  <MindeeEndpointManual>${mindeeEndpointManual || ''}</MindeeEndpointManual>
  <MindeeAccountNameManual>${mindeeAccountNameManual || ''}</MindeeAccountNameManual>${rutaFondo}
</Main>`;

  fs.writeFileSync(configPath, xml, 'utf-8');
}

/* ─── Parsear servidor y puerto ─────────────────────────────── */
function parseServer(raw) {
  let server = (raw || 'localhost').trim();
  let port = 1433;
  if (server.includes(',')) {
    const [s, p] = server.split(',');
    server = s.trim();
    port = parseInt(p.trim()) || 1433;
  }
  return { server, port };
}

/* ─── Singleton del pool de conexión ────────────────────────── */
let pool = null;

async function getPool() {
  if (pool && pool.connected) return pool;

  const config = readConfig();
  const { server, port } = parseServer(config.server);

  pool = await sql.connect({
    server,
    port,
    database: config.database || 'master',
    user: SERVICE_USER,
    password: SERVICE_PASSWORD,
    options: { encrypt: false, trustServerCertificate: true, enableArithAbort: true, useUTC: false },
    pool: { max: 10, min: 0, idleTimeoutMillis: 30000 }
  });

  console.log('[DB] Pool conectado →', server, '/', config.database);
  pool.on('error', (err) => { console.error('[DB] Pool error:', err); pool = null; });
  return pool;
}

async function closePool() {
  if (pool) { await pool.close(); pool = null; }
}

/* ─── Probar conexión desde pantalla de configuración ───────── */
const TEST_USER = 'us_limitado_tareasYpresencia';
const TEST_PASSWORD = 'uslimitado';

async function testConnectionWith({ server: rawServer, database }) {
  const { server, port } = parseServer(rawServer);

  const testPool = await sql.connect({
    server,
    port,
    database: database || 'master',
    user: TEST_USER,
    password: TEST_PASSWORD,
    options: { encrypt: false, trustServerCertificate: true, useUTC: false },
    pool: { max: 1, min: 0, idleTimeoutMillis: 5000 },
    connectionTimeout: 8000
  });

  const result = await testPool.request()
    .query('SELECT @@SERVERNAME AS servidor, DB_NAME() AS baseDatos, GETDATE() AS hora');

  await testPool.close();
  return result.recordset[0];
}

/* ─── Autenticación ─────────────────────────────────────────── */
async function checkIdentidad({ usuario, contrasena = null }) {
  let config;
  try {
    config = readConfig();
  } catch {
    throw new Error('NO_CONFIG');
  }

  const p = await getPool();
  const request = p.request()
    .input('Usuario', sql.NVarChar(200), usuario)
    .input('IdAplicacionConPermiso', sql.Int, 40);

  if (contrasena !== null) {
    request.input('Contrasena', sql.NVarChar(200), contrasena);
  }

  const result = await request.execute('SeguridadUnificada_Identidad_Select');

  if (!result.recordset || result.recordset.length === 0) {
    throw new Error('NO_PERMISO');
  }

  return result.recordset[0];
}

function getWindowsUser() {
  return os.userInfo().username;
}

async function authenticateUser({ user, password }) {
  return checkIdentidad({ usuario: user, contrasena: password });
}

async function checkWindowsUser() {
  const winUser = getWindowsUser();
  return checkIdentidad({ usuario: winUser });
}

/* ─── Guardar y leer fondo en Config.xml ────────────────────── */
function saveFondo(fondoPath) {
  const configPath = getConfigPath();
  let xmlContent = '';

  if (fs.existsSync(configPath)) {
    xmlContent = fs.readFileSync(configPath, 'utf-8');
    if (xmlContent.includes('<RutaFondo>')) {
      xmlContent = xmlContent.replace(/<RutaFondo>.*?<\/RutaFondo>/, `<RutaFondo>${fondoPath}</RutaFondo>`);
    } else {
      xmlContent = xmlContent.replace('</Main>', `  <RutaFondo>${fondoPath}</RutaFondo>\n</Main>`);
    }
  } else {
    xmlContent = `<?xml version="1.0" encoding="utf-8"?>
<Main>
  <RutaFondo>${fondoPath}</RutaFondo>
</Main>`;
  }

  fs.writeFileSync(configPath, xmlContent, 'utf-8');
}

function getFondo() {
  const configPath = getConfigPath();
  if (!fs.existsSync(configPath)) return null;
  const raw = fs.readFileSync(configPath, 'utf-8');
  const match = raw.match(/<RutaFondo>(.*?)<\/RutaFondo>/);
  const value = match ? String(match[1] || '').trim() : '';
  if (!value) return null;
  if (path.isAbsolute(value)) return value;
  return path.resolve(path.dirname(configPath), value);
}

/* ─── Obtener cuentas desde la base de datos ────────────────── */
async function getAccountsFromDb({ server: rawServer, database }) {
  const { server, port } = parseServer(rawServer);
  let tempPool = null;
  try {
    tempPool = await sql.connect({
      server,
      port,
      database: database || 'master',
      user: SERVICE_USER,
      password: SERVICE_PASSWORD,
      options: { encrypt: false, trustServerCertificate: true, useUTC: false },
      pool: { max: 1, min: 0, idleTimeoutMillis: 5000 },
      connectionTimeout: 8000
    });

    const result = await tempPool.request().query('SELECT IdCuenta, NombreCuenta, CorreoCuenta FROM MindeeCuentas');
    await tempPool.close();
    return result.recordset;
  } catch (err) {
    if (tempPool) {
      try { await tempPool.close(); } catch (_) {}
    }
    console.warn("[DB] No se pudieron obtener las cuentas de Mindee:", err.message);
    return [];
  }
}

/* ─── Obtener modelos desde la base de datos ────────────────── */
async function getModelsFromDb({ server: rawServer, database, idCuenta }) {
  const { server, port } = parseServer(rawServer);
  let tempPool = null;
  try {
    tempPool = await sql.connect({
      server,
      port,
      database: database || 'master',
      user: SERVICE_USER,
      password: SERVICE_PASSWORD,
      options: { encrypt: false, trustServerCertificate: true, useUTC: false },
      pool: { max: 1, min: 0, idleTimeoutMillis: 5000 },
      connectionTimeout: 8000
    });

    const columns = await tempPool.request().query(`
      SELECT COLUMN_NAME
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = 'dbo'
        AND TABLE_NAME = 'MindeeModelID'
    `);
    const columnNames = new Set(columns.recordset.map((row) => String(row.COLUMN_NAME || '').toLowerCase()));
    const nameExpression = columnNames.has('nombremodelid')
      ? 'NombreModelID'
      : "CONCAT('Modelo ', IdModelID)";

    const result = await tempPool.request()
      .input('idCuenta', sql.Int, parseInt(idCuenta))
      .query(`
        SELECT
          IdModelID,
          ModelID,
          ${nameExpression} AS NombreModelID
        FROM MindeeModelID
        WHERE IdCuenta = @idCuenta
        ORDER BY IdModelID
      `);
    
    await tempPool.close();
    return result.recordset;
  } catch (err) {
    if (tempPool) {
      try { await tempPool.close(); } catch (_) {}
    }
    console.warn("[DB] No se pudieron obtener los modelos de Mindee:", err.message);
    return [];
  }
}

/* ─── Recuperar credenciales de Mindee dinámicamente ────────── */
async function getMindeeProcessesFromDb({ server: rawServer, database, idCuenta = null }) {
  const { server, port } = parseServer(rawServer);
  let tempPool = null;
  try {
    tempPool = await sql.connect({
      server,
      port,
      database: database || 'master',
      user: SERVICE_USER,
      password: SERVICE_PASSWORD,
      options: { encrypt: false, trustServerCertificate: true, useUTC: false },
      pool: { max: 1, min: 0, idleTimeoutMillis: 5000 },
      connectionTimeout: 8000
    });

    const exists = await tempPool.request().query(`
      SELECT CASE WHEN OBJECT_ID('dbo.MindeeProcesos', 'U') IS NULL THEN 0 ELSE 1 END AS hasTable
    `);

    if (!exists.recordset[0]?.hasTable) {
      await tempPool.close();
      return [];
    }

    const request = tempPool.request();
    let whereClause = '';
    if (idCuenta) {
      request.input('idCuenta', sql.Int, parseInt(idCuenta));
      whereClause = 'WHERE c.IdCuenta = @idCuenta';
    }

    const result = await request.query(`
      SELECT
        pr.IdProceso,
        pr.NombreProceso,
        pr.IdApiKey,
        pr.IdModelID,
        c.IdCuenta,
        c.NombreCuenta,
        c.CorreoCuenta,
        m.ModelID
      FROM dbo.MindeeProcesos pr
      INNER JOIN dbo.MindeeAPIKey k ON k.IdApiKey = pr.IdApiKey
      INNER JOIN dbo.MindeeCuentas c ON c.IdCuenta = k.IdCuenta
      INNER JOIN dbo.MindeeModelID m ON m.IdModelID = pr.IdModelID
      ${whereClause}
      ORDER BY c.NombreCuenta, pr.NombreProceso, pr.IdProceso
    `);
    
    await tempPool.close();
    return result.recordset;
  } catch (err) {
    if (tempPool) {
      try { await tempPool.close(); } catch (_) {}
    }
    console.warn("[DB] No se pudieron obtener los procesos de Mindee:", err.message);
    return [];
  }
}

async function getMindeeCredentials() {
  let config;
  try {
    config = readConfig();
  } catch (e) {
    return {
      apiKey: process.env.MINDEE_API_KEY,
      modelId: process.env.MINDEE_MODEL_ID
    };
  }

  if (config.mindeeApiKeyManual && config.mindeeModelIdManual) {
    return {
      apiKey: config.mindeeApiKeyManual,
      modelId: config.mindeeModelIdManual,
      endpoint: config.mindeeEndpointManual || '',
      source: 'manual'
    };
  }

  if (config.isOffline) {
    return {
      apiKey: process.env.MINDEE_API_KEY,
      modelId: process.env.MINDEE_MODEL_ID
    };
  }

  try {
    const p = await getPool();
    
    let apiKey = process.env.MINDEE_API_KEY;
    if (config.idApiKeyActual) {
      const keyByIdRes = await p.request()
        .input('idApiKey', sql.Int, parseInt(config.idApiKeyActual))
        .query('SELECT TOP 1 ApiKey FROM MindeeAPIKey WHERE IdApiKey = @idApiKey');
      apiKey = keyByIdRes.recordset[0]?.ApiKey || apiKey;
    } else {
      const keyRes = await p.request()
        .input('idCuenta', sql.Int, parseInt(config.idCuentaActual || '1'))
        .query('SELECT TOP 1 ApiKey FROM MindeeAPIKey WHERE IdCuenta = @idCuenta ORDER BY IdApiKey DESC');
      apiKey = keyRes.recordset[0]?.ApiKey || apiKey;
    }
      
    const modelRes = await p.request()
      .input('idModelID', sql.Int, parseInt(config.idModelIDActual || '1'))
      .query('SELECT TOP 1 ModelID FROM MindeeModelID WHERE IdModelID = @idModelID');
      
    const modelId = modelRes.recordset[0]?.ModelID || process.env.MINDEE_MODEL_ID;
    
    return { apiKey, modelId };
  } catch (err) {
    console.error('[DB] Error al recuperar credenciales dinámicas de Mindee:', err);
    return {
      apiKey: process.env.MINDEE_API_KEY,
      modelId: process.env.MINDEE_MODEL_ID
    };
  }
}

module.exports = {
  getPool, closePool,
  testConnectionWith,
  authenticateUser,
  checkWindowsUser,
  getWindowsUser,
  saveConfig, readConfig,
  saveFondo, getFondo,
  getAccountsFromDb,
  getModelsFromDb,
  getMindeeProcessesFromDb,
  getMindeeCredentials,
  sql
};
