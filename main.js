const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const mindeeService = require('./services/mindee-service');
const sqlService = require('./services/sql-service');
const xmlService = require('./services/xml-service');
const {
    authenticateUser,
    checkWindowsUser,
    testConnectionWith,
    saveConfig,
    readConfig,
    saveFondo,
    getFondo,
    closePool,
    getAccountsFromDb,
    getModelsFromDb,
    getMindeeProcessesFromDb
} = require('./database/db');

// Load environment variables correctly for packaged apps
function getEnvPath() {
    if (app.isPackaged) {
        return path.join(process.resourcesPath, '.env');
    }
    return path.join(__dirname, '.env');
}

require('dotenv').config({ path: getEnvPath() });

let mainWindow = null;
let loginWindow = null;
let conexionWindow = null;
let currentSession = null;
let localAuditLog = [];
let statusPollTimer = null;
const instanceId = `${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
let currentPresenceUser = null;

const ROLE_BY_USER = {
    mrodriguez: 'Administrador',
    mdbarca: 'Contable'
};

function getLocalDataPath(fileName) {
    try {
        return path.join(app.getPath('userData'), fileName);
    } catch (_) {
        return path.join(__dirname, fileName);
    }
}

function readJsonFile(filePath, fallback) {
    try {
        if (!fs.existsSync(filePath)) return fallback;
        return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    } catch (_) {
        return fallback;
    }
}

function writeJsonFile(filePath, data) {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
}

function loadRoleOverrides() {
    return readJsonFile(getLocalDataPath('role-overrides.json'), {});
}

function saveRoleOverrides(overrides) {
    writeJsonFile(getLocalDataPath('role-overrides.json'), overrides || {});
}

function loadAccountStatusOverrides() {
    return readJsonFile(getLocalDataPath('account-status.json'), {});
}

function saveAccountStatusOverrides(overrides) {
    writeJsonFile(getLocalDataPath('account-status.json'), overrides || {});
}

function loadPresenceRegistry() {
    return readJsonFile(getLocalDataPath('presence.json'), { sessions: [] });
}

function savePresenceRegistry(registry) {
    writeJsonFile(getLocalDataPath('presence.json'), registry || { sessions: [] });
}

function upsertPresence(username) {
    const normalized = String(username || '').trim().toLowerCase();
    if (!normalized) return;

    const registry = loadPresenceRegistry();
    const sessions = Array.isArray(registry.sessions) ? registry.sessions : [];
    const now = new Date().toISOString();
    const filtered = sessions.filter((entry) => String(entry.instanceId || '') !== instanceId);
    filtered.push({
        username: normalized,
        instanceId,
        lastSeen: now
    });
    savePresenceRegistry({ sessions: filtered });
    currentPresenceUser = normalized;
}

function clearPresence(username = null) {
    const registry = loadPresenceRegistry();
    const sessions = Array.isArray(registry.sessions) ? registry.sessions : [];
    const normalized = username ? String(username).trim().toLowerCase() : '';
    const filtered = sessions.filter((entry) => {
        const matchesInstance = String(entry.instanceId || '') === instanceId;
        const matchesUser = normalized ? String(entry.username || '').trim().toLowerCase() === normalized : true;
        return !(matchesInstance || matchesUser);
    });
    savePresenceRegistry({ sessions: filtered });
    currentPresenceUser = null;
}

function pulsePresence() {
    if (currentPresenceUser) {
        upsertPresence(currentPresenceUser);

        // Comprobar si nos han desactivado la cuenta o cambiado el rol en otra instancia
        const activo = isAccountEnabled(currentPresenceUser);
        const nuevoRol = resolveRoleForUser(currentPresenceUser);

        if (!activo) {
            BrowserWindow.getAllWindows().forEach(win => {
                if (!win || win.isDestroyed()) return;
                win.webContents.send('auth:user-updated', {
                    usuario: currentPresenceUser,
                    rol: nuevoRol,
                    activo: false
                });
            });
            setTimeout(() => {
                stopPresenceHeartbeat();
                currentSession = null;
                if (mainWindow) mainWindow.close();
                if (typeof createLoginWindow === 'function') {
                    if (!loginWindow) createLoginWindow();
                    else loginWindow.focus();
                }
            }, 500);
            return;
        }

        if (currentSession && currentSession.role !== nuevoRol) {
            currentSession.role = nuevoRol;
            BrowserWindow.getAllWindows().forEach(win => {
                if (!win || win.isDestroyed()) return;
                win.webContents.send('auth:user-updated', {
                    usuario: currentPresenceUser,
                    rol: nuevoRol,
                    activo: true
                });
            });
        }
    }
}

function startPresenceHeartbeat(username) {
    currentPresenceUser = String(username || '').trim().toLowerCase() || null;
    pulsePresence();
    if (statusPollTimer) clearInterval(statusPollTimer);
    statusPollTimer = setInterval(pulsePresence, 5000);
}

function stopPresenceHeartbeat() {
    if (statusPollTimer) {
        clearInterval(statusPollTimer);
        statusPollTimer = null;
    }
    clearPresence(currentPresenceUser || currentSession?.loginUser || currentSession?.Usuario);
}

function isUserOnline(username) {
    const normalized = String(username || '').trim().toLowerCase();
    if (!normalized) return false;
    const registry = loadPresenceRegistry();
    const now = Date.now();
    const timeoutMs = 15000;
    return (registry.sessions || []).some((entry) => {
        if (String(entry.username || '').trim().toLowerCase() !== normalized) return false;
        const lastSeen = Date.parse(entry.lastSeen || '');
        return !Number.isNaN(lastSeen) && (now - lastSeen) <= timeoutMs;
    });
}

function isAccountEnabled(username) {
    const normalized = String(username || '').trim().toLowerCase();
    const overrides = loadAccountStatusOverrides();
    if (Object.prototype.hasOwnProperty.call(overrides, normalized)) {
        return !!overrides[normalized];
    }
    return true;
}

function appendLocalAudit(action, detail, extra = {}) {
    if (localAuditLog.length === 0) {
        loadLocalAuditLog();
    }
    const entry = {
        id: Date.now(),
        fechaHora: new Date().toISOString(),
        usuario: extra.usuario || currentSession?.loginUser || currentSession?.Usuario || 'sistema',
        rol: extra.rol || currentSession?.role || resolveRoleForUser(currentSession?.loginUser || currentSession?.Usuario || extra.usuario || ''),
        accion: action,
        entidad: extra.entidad || null,
        detalle: detail || '',
        resultado: extra.resultado || 'OK'
    };

    localAuditLog.unshift(entry);
    localAuditLog = localAuditLog.slice(0, 500);
    writeJsonFile(getLocalDataPath('audit-log.json'), localAuditLog);
    return entry;
}

function getConnectionStateForUser(username) {
    return isUserOnline(username) ? 'En linea' : 'No conectado';
}

function loadLocalAuditLog() {
    const loaded = readJsonFile(getLocalDataPath('audit-log.json'), []);
    localAuditLog = Array.isArray(loaded) ? loaded : [];
    return localAuditLog;
}

function resolveRoleForUser(username, session = {}) {
    const normalized = String(username || session.Usuario || session.Login || session.user || '').trim().toLowerCase();
    const overrides = loadRoleOverrides();
    if (overrides[normalized]) {
        return String(overrides[normalized]).trim() === 'Administrador' ? 'Administrador' : 'Contable';
    }
    if (ROLE_BY_USER[normalized]) return ROLE_BY_USER[normalized];

    if (session.IdTipoIdentidad === 1 || session.isAdmin === true) return 'Administrador';
    return 'Contable';
}

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false,
            nodeIntegrationInSubFrames: true
        },
        title: "Facturas GForma",
        show: false
    });

    mainWindow.loadFile('index.html');
    mainWindow.maximize();
    mainWindow.setMenu(null);

    mainWindow.once('ready-to-show', () => {
        mainWindow.show();
    });

    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}

function notifyFacturasChanged(_sender, payload = {}) {
    BrowserWindow.getAllWindows().forEach((win) => {
        if (!win || win.isDestroyed()) return;
        win.webContents.send('facturas:changed', {
            sociedadId: payload.sociedadId ? parseInt(payload.sociedadId) : null,
            invoiceId: payload.invoiceId ? parseInt(payload.invoiceId) : null,
            operation: payload.operation || 'changed',
            at: new Date().toISOString()
        });
    });
}

function createLoginWindow() {
    loginWindow = new BrowserWindow({
        width: 460,
        height: 650,
        frame: false,
        transparent: true,
        resizable: false,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false
        }
    });

    loginWindow.loadFile('views/inteco-login.html');

    loginWindow.on('closed', () => {
        loginWindow = null;
    });
}

function createConexionWindow() {
    if (conexionWindow) {
        conexionWindow.focus();
        return;
    }

    conexionWindow = new BrowserWindow({
        width: 500,
        height: 780,
        frame: false,
        transparent: true,
        resizable: false,
        parent: loginWindow || mainWindow,
        modal: true,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false
        }
    });

    conexionWindow.loadFile('views/inteco-conexion.html');

    conexionWindow.on('closed', () => {
        conexionWindow = null;
    });
}

app.whenReady().then(() => {
    createLoginWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            if (!currentSession) createLoginWindow();
            else createWindow();
        }
    });
});

app.on('window-all-closed', () => {
    stopPresenceHeartbeat();
    if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => {
    stopPresenceHeartbeat();
});

// --- IPC Handlers for Auth and Config ---

ipcMain.on('window-move', (event, { deltaX, deltaY }) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (win) {
        const [x, y] = win.getPosition();
        win.setPosition(x + deltaX, y + deltaY);
    }
});

ipcMain.on('login-close', () => {
    app.quit();
});

ipcMain.on('login-success', () => {
    if (loginWindow) loginWindow.close();
    createWindow();
});

ipcMain.on('auth:logout', async () => {
    try {
        if (currentSession) {
            stopPresenceHeartbeat();
            appendLocalAudit('LOGOUT', `Cierre de sesión de ${currentSession.loginUser || currentSession.Usuario || 'usuario'}`, {
                entidad: 'Seguridad_Usuarios'
            });
        }
    } catch (err) {
        console.warn('[Auth] No se pudo registrar el logout:', err.message);
    }

    currentSession = null;

    if (!loginWindow) {
        createLoginWindow();
    } else {
        loginWindow.focus();
    }

    if (conexionWindow) {
        conexionWindow.close();
    }

    if (mainWindow) {
        mainWindow.close();
    }
});

ipcMain.on('open-conexion', () => {
    createConexionWindow();
});

ipcMain.on('close-conexion', () => {
    if (conexionWindow) conexionWindow.close();
});

ipcMain.handle('auth:login', async (_event, { user, password }) => {
    try {
        const info = await authenticateUser({ user, password });
        if (!isAccountEnabled(user)) {
            throw new Error('CUENTA_INACTIVA');
        }
        const role = resolveRoleForUser(user, info);
        currentSession = { ...info, loginUser: user, role };
        startPresenceHeartbeat(user);
        appendLocalAudit('LOGIN', `Inicio de sesión correcto para ${user}`, { entidad: 'Seguridad_Usuarios', usuario: user, rol: role });
        return { ok: true, data: info };
    } catch (err) {
        let msg;
        if (err.message === 'NO_CONFIG') {
            msg = 'No hay configuración de conexión. Configura el servidor primero.';
        } else if (err.message === 'CUENTA_INACTIVA') {
            msg = 'La cuenta está deshabilitada.';
        } else if (err.message === 'NO_PERMISO') {
            msg = 'Usuario o contraseña incorrectos.';
        } else if (err.message.includes('network') || err.message.includes('connect') || err.message.includes('ECONNREFUSED')) {
            msg = 'No se pudo conectar al servidor. Revisa la configuración de conexión.';
        } else {
            msg = 'Error al iniciar sesión: ' + err.message;
        }
        return { ok: false, error: msg };
    }
});

ipcMain.handle('auth:getSession', async () => {
    if (!currentSession) return { ok: false, data: null };
    const role = resolveRoleForUser(currentSession.loginUser || currentSession.Usuario, currentSession);
    currentSession.role = role;
    return {
        ok: true,
        data: {
            id: currentSession.Id || currentSession.IdIdentidad || null,
            nombre: currentSession.Nombre || currentSession.NombreCompleto || '',
            usuario: currentSession.Usuario || currentSession.loginUser || '',
            rol: role,
        }
    };
});

ipcMain.handle('auth:checkWindows', async () => {
    try {
        const data = await checkWindowsUser();
        const loginUser = getWindowsUser();
        if (!isAccountEnabled(loginUser)) {
            throw new Error('CUENTA_INACTIVA');
        }
        const role = resolveRoleForUser(loginUser, data);
        currentSession = { ...data, loginUser, role };
        startPresenceHeartbeat(loginUser);
        appendLocalAudit('LOGIN_WINDOWS', `Inicio de sesión Windows para ${loginUser}`, { entidad: 'Seguridad_Usuarios', usuario: loginUser, rol: role });
        return { ok: true, data };
    } catch (err) {
        return { ok: false, error: err.message === 'CUENTA_INACTIVA' ? 'La cuenta está deshabilitada.' : err.message };
    }
});

ipcMain.handle('db:testConnection', async (_event, params) => {
    try {
        const info = await testConnectionWith(params);
        return { ok: true, data: info };
    } catch (err) {
        return { ok: false, error: err.message };
    }
});

ipcMain.handle('db:saveConfig', async (_event, {
    server,
    database,
    conexiones,
    idCuentaActual,
    idModelIDActual,
    idApiKeyActual,
    idProcesoActual,
    mindeeApiKeyManual,
    mindeeModelIdManual,
    mindeeEndpointManual,
    mindeeAccountNameManual,
    isOffline
}) => {
    try {
        await closePool();
        saveConfig({
            server,
            database,
            conexiones,
            idCuentaActual,
            idModelIDActual,
            idApiKeyActual,
            idProcesoActual,
            mindeeApiKeyManual,
            mindeeModelIdManual,
            mindeeEndpointManual,
            mindeeAccountNameManual,
            isOffline
        });
        return { ok: true };
    } catch (err) {
        return { ok: false, error: err.message };
    }
});

ipcMain.handle('db:getAccounts', async (event, { server, database }) => {
    try {
        const accounts = await getAccountsFromDb({ server, database });
        return { ok: true, accounts };
    } catch (error) {
        return { ok: false, error: error.message };
    }
});

ipcMain.handle('db:getModels', async (event, { server, database, idCuenta }) => {
    try {
        const models = await getModelsFromDb({ server, database, idCuenta });
        return { ok: true, models };
    } catch (error) {
        return { ok: false, error: error.message };
    }
});

ipcMain.handle('db:getMindeeProcesses', async (event, { server, database, idCuenta } = {}) => {
    try {
        const processes = await getMindeeProcessesFromDb({ server, database, idCuenta });
        return { ok: true, processes };
    } catch (error) {
        return { ok: false, error: error.message };
    }
});

ipcMain.handle('db:setOffline', async () => {
    try {
        await closePool();
        let current = { server: "", database: "", conexiones: [], isOffline: true, idCuentaActual: "", idModelIDActual: "", idApiKeyActual: "", idProcesoActual: "", mindeeApiKeyManual: "", mindeeModelIdManual: "", mindeeEndpointManual: "", mindeeAccountNameManual: "" };
        try {
            current = readConfig();
        } catch (_) {}
        saveConfig({
            ...current,
            isOffline: true
        });
        return { ok: true };
    } catch (error) {
        return { ok: false, error: error.message };
    }
});

ipcMain.handle('db:getConfig', async () => {
    try {
        const config = readConfig();
        return {
            ok: true, data: {
                server: config.server,
                database: config.database,
                conexiones: config.conexiones,
                idCuentaActual: config.idCuentaActual,
                idModelIDActual: config.idModelIDActual,
                idApiKeyActual: config.idApiKeyActual,
                idProcesoActual: config.idProcesoActual,
                mindeeApiKeyManual: config.mindeeApiKeyManual,
                mindeeModelIdManual: config.mindeeModelIdManual,
                mindeeEndpointManual: config.mindeeEndpointManual,
                mindeeAccountNameManual: config.mindeeAccountNameManual,
                isOffline: config.isOffline
            }
        };
    } catch {
        return { ok: false, data: null };
    }
});

ipcMain.handle('config:setFondo', async (_e, { fondo }) => {
    try {
        saveFondo(fondo);
        return { ok: true };
    } catch (err) {
        return { ok: false, error: err.message };
    }
});

ipcMain.handle('config:getFondo', async () => {
    try {
        const fondo = getFondo();
        return { fondo };
    } catch {
        return { fondo: null };
    }
});

ipcMain.handle('dialog:openFondo', async () => {
    const defaultPath = app.isPackaged
        ? path.join(process.resourcesPath, 'Fondos')
        : path.join(__dirname, 'Fondos');

    const { canceled, filePaths } = await dialog.showOpenDialog({
        defaultPath: fs.existsSync(defaultPath) ? defaultPath : undefined,
        properties: ['openFile'],
        filters: [{ name: 'Imágenes', extensions: ['jpg', 'png', 'jpeg'] }]
    });
    if (canceled) return null;
    return { filePath: filePaths[0] };
});

// --- Original IPC Handlers ---

ipcMain.handle('open-file-dialog', async () => {
    const defaultPath = path.join(os.homedir(), 'Downloads');
    const { canceled, filePaths } = await dialog.showOpenDialog({
        defaultPath: fs.existsSync(defaultPath) ? defaultPath : undefined,
        properties: ['openFile', 'multiSelections'],
        filters: [
            { name: 'Facturas', extensions: ['pdf', 'jpg', 'jpeg', 'png', 'tiff'] }
        ]
    });
    if (canceled) return null;
    return filePaths;
});

// Deduplication map for ongoing extractions
const pendingInvoices = new Map();

ipcMain.handle('process-invoice', async (event, filePath) => {
    // If this file is already being processed, return the existing promise
    if (pendingInvoices.has(filePath)) {
        console.log(`Already processing ${filePath}, deduplicating request...`);
        return pendingInvoices.get(filePath);
    }

    try {
        const processPromise = mindeeService.extractData(filePath);
        pendingInvoices.set(filePath, processPromise);

        const result = await processPromise;
        return result;
    } catch (err) {
        throw new Error(`Error al procesar la factura: ${err.message}`);
    } finally {
        // Remove from map when finished (success or error)
        pendingInvoices.delete(filePath);
    }
});

ipcMain.handle('read-file', async (event, filePath) => {
    try {
        return fs.readFileSync(filePath);
    } catch (err) {
        throw new Error(`Error al leer el archivo: ${err.message}`);
    }
});

ipcMain.handle('save-invoice', async (event, { invoiceData, originalFileName }) => {
    try {
        const xmlPath = await xmlService.generateXML(invoiceData);
        return {
            success: true,
            message: "Factura guardada exitosamente y XML generado",
            xmlFilePath: xmlPath
        };
    } catch (err) {
        throw new Error(`Error al guardar la factura: ${err.message}`);
    }
});

ipcMain.handle('load-invoice', async (event, xmlPath) => {
    try {
        return await xmlService.parseXML(xmlPath);
    } catch (err) {
        throw new Error(`Error al cargar la factura desde XML: ${err.message}`);
    }
});

ipcMain.handle('list-sociedades', async () => {
    try {
        return await sqlService.listSociedades();
    } catch (err) {
        throw new Error(`Error al listar sociedades: ${err.message}`);
    }
});

ipcMain.handle('get-upcoming-expirations', async (_e, { sociedadId }) => {
    return await sqlService.getUpcomingExpirations(sociedadId);
});

ipcMain.handle('list-facturas', async (event, { sociedadId, limit }) => {
    try {
        return await sqlService.listFacturas(sociedadId, limit);
    } catch (err) {
        throw new Error(`Error al listar facturas: ${err.message}`);
    }
});

ipcMain.handle('get-facturas-change-stamp', async (_event, { sociedadId } = {}) => {
    try {
        return await sqlService.getFacturasChangeStamp(sociedadId);
    } catch (err) {
        console.warn('[Realtime] No se pudo consultar la huella de cambios de facturas:', err.message);
        return null;
    }
});

ipcMain.handle('get-provincias', async () => {
    try {
        return await sqlService.getProvincias();
    } catch (err) {
        throw new Error(`Error al obtener provincias: ${err.message}`);
    }
});

ipcMain.handle('check-proveedor', async (event, documento) => {
    try {
        return await sqlService.checkProveedorExists(documento);
    } catch (err) {
        throw new Error(`Error al comprobar proveedor: ${err.message}`);
    }
});

ipcMain.handle('save-proveedor', async (event, proveedorData) => {
    try {
        return await sqlService.saveProveedor(proveedorData);
    } catch (err) {
        throw new Error(`Error al guardar proveedor: ${err.message}`);
    }
});

ipcMain.handle('save-invoice-db', async (event, invoiceData) => {
    try {
        const result = await sqlService.saveInvoiceDB(invoiceData);
        notifyFacturasChanged(event.sender, {
            sociedadId: invoiceData?.idSociedad,
            invoiceId: result?.id,
            operation: 'created'
        });
        return result;
    } catch (err) {
        throw new Error(`Error al guardar factura en BD: ${err.message}`);
    }
});

ipcMain.handle('check-invoice-exists', async (event, { idSociedad, idProveedor, numFactura, proveedorNombre }) => {
    try {
        return await sqlService.checkInvoiceExists(idSociedad, idProveedor, numFactura, proveedorNombre);
    } catch (err) {
        throw new Error(`Error al comprobar existencia de factura: ${err.message}`);
    }
});

ipcMain.handle('get-poblacion-by-cp', async (event, cp) => {
    try {
        return await sqlService.getPoblacionByCP(cp);
    } catch (err) {
        console.error('Error fetching poblacion:', err);
        return null;
    }
});

ipcMain.handle('get-invoice-details', async (_e, { invoiceId }) => {
    try {
        return await sqlService.getInvoiceDetails(invoiceId);
    } catch (err) {
        throw new Error(`Error al obtener detalles de la factura: ${err.message}`);
    }
});

ipcMain.handle('toggle-invoice-paid', async (event, { invoiceId, isPaid }) => {
    try {
        const result = await sqlService.toggleInvoicePaid(invoiceId, isPaid);
        notifyFacturasChanged(event.sender, { invoiceId, operation: 'paid-status' });
        return result;
    } catch (err) {
        throw new Error(`Error al actualizar estado de pago: ${err.message}`);
    }
});

ipcMain.handle('add-invoice-payment', async (event, { invoiceId, paymentData }) => {
    try {
        const result = await sqlService.addInvoicePayment(invoiceId, paymentData);
        notifyFacturasChanged(event.sender, { invoiceId, operation: 'payment-added' });
        return result;
    } catch (err) {
        throw new Error(`Error al añadir pago: ${err.message}`);
    }
});

ipcMain.handle('delete-invoice-payment', async (event, { vencimientoId }) => {
    try {
        const result = await sqlService.deleteInvoicePayment(vencimientoId);
        notifyFacturasChanged(event.sender, { operation: 'payment-deleted' });
        return result;
    } catch (err) {
        throw new Error(`Error al eliminar pago: ${err.message}`);
    }
});

ipcMain.handle('get-next-num-factura', async (_e, { sociedadId, fecha }) => {
    try {
        return await sqlService.getNextNumFactura(sociedadId, fecha);
    } catch (err) {
        throw new Error(`Error al obtener siguiente número de factura: ${err.message}`);
    }
});

ipcMain.handle('delete-invoice', async (event, { invoiceId }) => {
    try {
        const result = await sqlService.deleteInvoice(invoiceId);
        notifyFacturasChanged(event.sender, { invoiceId, operation: 'deleted' });
        return result;
    } catch (err) {
        throw new Error(`Error al eliminar factura: ${err.message}`);
    }
});

// --- Handlers de Estadísticas y Roles ---

ipcMain.handle('get-ranking-proveedores', async (_e, { sociedadId, topN } = {}) => {
    try {
        return await sqlService.getRankingProveedores(sociedadId, topN);
    } catch (err) {
        throw new Error(`Error al obtener ranking de proveedores: ${err.message}`);
    }
});

ipcMain.handle('get-estadisticas-mensuales', async (_e, { sociedadId, anio } = {}) => {
    try {
        return await sqlService.getEstadisticasMensuales(sociedadId, anio);
    } catch (err) {
        throw new Error(`Error al obtener estadísticas mensuales: ${err.message}`);
    }
});

ipcMain.handle('auth:getRole', async () => {
    if (!currentSession) return { ok: false, rol: null };
    const rol = resolveRoleForUser(currentSession.loginUser || currentSession.Usuario, currentSession);
    currentSession.role = rol;
    return {
        ok: true,
        rol,
        nombre: currentSession.Nombre || currentSession.NombreCompleto || '',
        usuario: currentSession.Usuario || currentSession.loginUser || ''
    };
});

async function ensureAdminSession() {
    if (!currentSession) {
        throw new Error('NO_SESION');
    }
    const rol = resolveRoleForUser(currentSession.loginUser || currentSession.Usuario, currentSession);
    currentSession.role = rol;
    if (rol !== 'Administrador') {
        throw new Error('NO_PERMISO');
    }
    return rol;
}

ipcMain.handle('admin:listUsers', async () => {
    try {
        await ensureAdminSession();
        const overrides = loadRoleOverrides();
        const statusOverrides = loadAccountStatusOverrides();
        const users = Object.keys(ROLE_BY_USER).map((usuario) => ({
            usuario,
            nombreCompleto: usuario === 'mrodriguez' ? 'Miguel Rodriguez Taboas' : 'Mdbarca',
            rol: overrides[usuario] || ROLE_BY_USER[usuario],
            activo: Object.prototype.hasOwnProperty.call(statusOverrides, usuario) ? !!statusOverrides[usuario] : true,
            estadoConexion: getConnectionStateForUser(usuario),
            origen: 'local'
        }));
        return { ok: true, users };
    } catch (err) {
        return { ok: false, error: err.message };
    }
});

ipcMain.handle('admin:saveUser', async (_event, userData) => {
    try {
        await ensureAdminSession();
        const usuario = String(userData?.usuario || '').trim().toLowerCase();
        if (!usuario) throw new Error('USUARIO_REQUERIDO');
        if (!ROLE_BY_USER[usuario]) throw new Error('USUARIO_NO_PERMITIDO');

        const rol = String(userData?.rol || 'Contable').trim() === 'Administrador' ? 'Administrador' : 'Contable';
        const activo = !!userData?.activo;
        const overrides = loadRoleOverrides();
        const statusOverrides = loadAccountStatusOverrides();
        overrides[usuario] = rol;
        statusOverrides[usuario] = activo;
        saveRoleOverrides(overrides);
        saveAccountStatusOverrides(statusOverrides);

        appendLocalAudit('ROL_ACTUALIZADO', `Rol de ${usuario} cambiado a ${rol}.`, {
            entidad: 'gf_Personal',
            usuario: currentSession.loginUser || currentSession.Usuario || 'admin',
            rol: currentSession.role || 'Administrador'
        });

        if (!activo && String(currentSession?.loginUser || '').trim().toLowerCase() === usuario) {
            appendLocalAudit('CUENTA_DESHABILITADA', `La cuenta en uso (${usuario}) fue deshabilitada.`, {
                entidad: 'gf_Personal',
                usuario,
                rol
            });
            setTimeout(() => {
                if (currentSession && String(currentSession.loginUser || '').trim().toLowerCase() === usuario) {
                    stopPresenceHeartbeat();
                    currentSession = null;
                    if (mainWindow) mainWindow.close();
                    if (!loginWindow) createLoginWindow();
                    else loginWindow.focus();
                }
            }, 100);
        }

        // Notificar a todas las ventanas abiertas del cambio de rol/estado
        BrowserWindow.getAllWindows().forEach((win) => {
            if (!win || win.isDestroyed()) return;
            win.webContents.send('auth:user-updated', {
                usuario,
                rol,
                activo
            });
        });

        return {
            ok: true,
            data: {
                success: true,
                user: {
                    usuario,
                    nombreCompleto: userData?.nombreCompleto || usuario,
                    rol,
                    activo,
                    creado: false
                }
            }
        };
    } catch (err) {
        return { ok: false, error: err.message };
    }
});

ipcMain.handle('admin:getAuditLog', async (_event, { limit } = {}) => {
    try {
        await ensureAdminSession();
        const safeLimit = Math.max(1, Math.min(parseInt(limit, 10) || 50, 250));
        const data = loadLocalAuditLog().slice(0, safeLimit);
        return { ok: true, logs: data };
    } catch (err) {
        return { ok: false, error: err.message };
    }
});
