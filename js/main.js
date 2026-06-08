/**
 * MainInterface Component
 * 
 * Manages the main interface and modal interactions for the AI Invoice Extraction system.
 * Provides methods to initialize the interface, open and close the extraction view modal.
 * 
 * Requirements: 1.1, 1.2
 */
function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatAuditDate(value) {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? String(value)
    : date.toLocaleString('es-ES', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
}

class MainInterface {
  constructor() {
    this.modal = null;
    this.btnOpen = null;
    this.btnClose = null;
    this.extractionFrame = null;
    this.adminModal = null;
    this.mindeeConfigModal = null;
    this.adminRefreshTimer = null;
    this.adminState = {
      users: [],
      audit: []
    };
  }

  /**
   * Initializes the main interface
   * Sets up event listeners for buttons and modal interactions
   */
  initialize() {
    // Get DOM elements
    this.modal = document.getElementById('extractionModal');
    this.btnOpen = document.getElementById('btnAltaFacturasIA');
    this.btnClose = document.getElementById('btnCloseModal');
    this.extractionFrame = document.getElementById('extractionFrame');

    // Verify all required elements exist
    if (!this.modal || !this.btnOpen || !this.btnClose) {
      console.error('MainInterface: Required DOM elements not found');
      return;
    }

    // Set up event listeners
    this.setupEventListeners();
    this.setupThemeToggle();
    this.setupMindeeConfig();
    this.setupAdminPanel();

    // Update connection status bar
    this.updateDbStatusBar();
    window.addEventListener('focus', () => {
      this.updateDbStatusBar();
    });

    console.log('MainInterface initialized successfully');
  }

  /**
   * Sets up all event listeners for the interface
   * @private
   */
  setupEventListeners() {
    // Open modal when "Alta Facturas IA" button is clicked
    this.btnOpen.addEventListener('click', () => {
      this.openExtractionView();
    });

    // Close modal when close button (×) is clicked
    this.btnClose.addEventListener('click', () => {
      this.closeExtractionView();
    });

    // Close modal when clicking outside the modal content
    this.modal.addEventListener('click', (event) => {
      if (event.target === this.modal) {
        this.closeExtractionView();
      }
    });

    // Close modal when ESC key is pressed
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        if (this.mindeeConfigModal && this.mindeeConfigModal.style.display === 'flex') {
          this.closeMindeeConfig();
          return;
        }
        if (this.adminModal && this.adminModal.style.display === 'flex') {
          this.closeAdminPanel();
          return;
        }
        if (this.isModalOpen()) {
          this.closeExtractionView();
        }
      }
    });

    // Listen for invoice-saved message from iframe and refresh the list
    window.addEventListener('message', (event) => {
      if (event.data === 'invoice-saved') {
        console.log('Invoice saved in iframe — refreshing list...');
        // Call loadFacturas if available (defined in facturas-proveedor.js scope)
        if (typeof window.reloadFacturas === 'function') {
          window.reloadFacturas();
        }
      }
    });
    
    // Setup Drag & Drop for the whole window
    this.setupDragAndDrop();

    // Listen for role/status updates from admin
    const api = window.electronAPI || window.api;
    if (api && api.on) {
      api.on('auth:user-updated', (data) => {
        if (window.currentUserLogin && window.currentUserLogin.toLowerCase() === data.usuario) {
            if (!data.activo) {
                alert('Tu cuenta ha sido deshabilitada por un administrador. Se cerrará la sesión.');
                api.send('auth:logout');
            } else if (window.currentUserRole !== data.rol) {
                alert(`Tu rol ha sido actualizado a ${data.rol} por un administrador.`);
                this.applyRolePermissions();
            }
        }
      });
    }
  }

  setupThemeToggle() {
    const btnTheme = document.getElementById('btn-theme-toggle');
    if (!btnTheme) return;

    const applyTheme = (theme) => {
      const selectedTheme = theme === 'dark' ? 'dark' : 'light';
      document.documentElement.dataset.theme = selectedTheme;
      localStorage.setItem('app-theme', selectedTheme);
      btnTheme.setAttribute('title', selectedTheme === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro');
      btnTheme.setAttribute('aria-label', selectedTheme === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro');
      btnTheme.setAttribute('aria-pressed', selectedTheme === 'dark' ? 'true' : 'false');
      if (this.extractionFrame && this.extractionFrame.contentWindow) {
        this.extractionFrame.contentWindow.postMessage({ type: 'theme-change', theme: selectedTheme }, '*');
      }
      window.dispatchEvent(new CustomEvent('app:themechange', { detail: { theme: selectedTheme } }));
    };

    applyTheme(localStorage.getItem('app-theme') || 'light');

    btnTheme.addEventListener('click', () => {
      const nextTheme = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
      applyTheme(nextTheme);
    });
  }

  /**
   * Sets up drag and drop listeners for the main window
   * @private
   */
  setupDragAndDrop() {
    window.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.stopPropagation();
    });

    window.addEventListener('drop', (e) => {
      e.preventDefault();
      e.stopPropagation();

      const files = Array.from(e.dataTransfer.files);
      const pdfs = files.filter(f => f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf'));
      
      if (pdfs.length > 0) {
        console.log(`Dropped ${pdfs.length} PDFs. Opening extraction view...`);
        this.openExtractionViewWithFiles(pdfs);
      }
    });
  }

  /**
   * Opens the extraction view and sends the dropped files to it
   * @param {File[]} files - Array of File objects
   */
  openExtractionViewWithFiles(files) {
    // Show the modal
    this.modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';

    // Prepare file data (using paths for Electron)
    const api = window.electronAPI || window.api;
    const fileData = files.map(f => ({
      name: f.name,
      path: api && api.getPathForFile ? api.getPathForFile(f) : f.path
    }));

    // Send to iframe
    const sendFiles = () => {
      if (this.extractionFrame && this.extractionFrame.contentWindow) {
        this.extractionFrame.contentWindow.postMessage({
          type: 'bulk-files-dropped',
          files: fileData
        }, '*');
      }
    };

    // If iframe is already loaded, send immediately. Otherwise wait.
    if (this.extractionFrame.contentDocument && this.extractionFrame.contentDocument.readyState === 'complete') {
        sendFiles();
    } else {
        this.extractionFrame.onload = () => {
            sendFiles();
            this.extractionFrame.onload = null; // Reset onload
        };
    }
  }

  /**
   * Opens the extraction view modal
   * Shows the modal with the extraction view loaded in an iframe
   */
  openExtractionView() {
    if (!this.modal) {
      console.error('MainInterface: Modal element not found');
      return;
    }

    // Show the modal
    this.modal.style.display = 'flex';

    // Prevent body scroll when modal is open
    document.body.style.overflow = 'hidden';

    // Trigger file selection in the iframe
    if (this.extractionFrame && this.extractionFrame.contentWindow) {
      // Small delay to ensure the iframe is ready to receive messages
      setTimeout(() => {
        this.extractionFrame.contentWindow.postMessage('open-file-dialog', '*');
      }, 500);
    }

    console.log('Extraction view opened and file dialog triggered');
  }

  /**
   * Closes the extraction view modal
   * Hides the modal and restores normal page behavior
   */
  closeExtractionView() {
    if (!this.modal) {
      console.error('MainInterface: Modal element not found');
      return;
    }

    // Hide the modal
    this.modal.style.display = 'none';

    // Restore body scroll
    document.body.style.overflow = '';

    // Reset the iframe so it starts clean next time
    if (this.extractionFrame) {
      const src = this.extractionFrame.src;
      this.extractionFrame.src = '';
      this.extractionFrame.src = src;
    }

    console.log('Extraction view closed and reset');
  }

  /**
   * Checks if the modal is currently open
   * @private
   * @returns {boolean} True if modal is open, false otherwise
   */
  isModalOpen() {
    return this.modal && this.modal.style.display === 'flex';
  }

  setupMindeeConfig() {
    this.mindeeConfigModal = document.getElementById('mindeeConfigModal');
    this.btnMindeeConfig = document.getElementById('btnMindeeConfig');
    this.btnCloseMindeeConfig = document.getElementById('btnCloseMindeeConfig');
    this.mindeeConfigForm = document.getElementById('mindeeConfigForm');
    this.mindeeConfigStatus = document.getElementById('mindeeConfigStatus');

    if (!this.mindeeConfigModal || !this.btnMindeeConfig || !this.mindeeConfigForm) return;

    this.btnMindeeConfig.addEventListener('click', () => this.openMindeeConfig());

    if (this.btnCloseMindeeConfig) {
      this.btnCloseMindeeConfig.addEventListener('click', () => this.closeMindeeConfig());
    }

    this.mindeeConfigModal.addEventListener('click', (event) => {
      if (event.target === this.mindeeConfigModal) {
        this.closeMindeeConfig();
      }
    });

    this.mindeeConfigForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      await this.saveMindeeConfig();
    });
  }

  async openMindeeConfig() {
    await this.loadMindeeConfig();
    this.mindeeConfigModal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
  }

  closeMindeeConfig() {
    if (!this.mindeeConfigModal) return;
    this.mindeeConfigModal.style.display = 'none';
    document.body.style.overflow = '';
  }

  setMindeeStatus(message, isError = false) {
    if (!this.mindeeConfigStatus) return;
    this.mindeeConfigStatus.textContent = message || '';
    this.mindeeConfigStatus.style.color = isError ? 'var(--danger, #ef4444)' : 'var(--text-muted)';
  }

  async getCurrentDbConfig() {
    const api = window.electronAPI || window.api;
    const res = await api.dbGetConfig();
    return res && res.ok && res.data ? res.data : {};
  }

  async loadMindeeConfig() {
    try {
      const config = await this.getCurrentDbConfig();
      document.getElementById('mindeeAccountName').value = config.mindeeAccountNameManual || '';
      document.getElementById('mindeeApiKey').value = config.mindeeApiKeyManual || '';
      document.getElementById('mindeeModelId').value = config.mindeeModelIdManual || '';
      document.getElementById('mindeeEndpoint').value = config.mindeeEndpointManual || '';

      if (config.mindeeApiKeyManual && config.mindeeModelIdManual) {
        this.setMindeeStatus('Cuenta Mindee manual activa. La extracción usará estos datos.');
      } else {
        this.setMindeeStatus('No hay cuenta manual guardada. Se usará la configuración de la base de datos.');
      }
    } catch (err) {
      console.error('No se pudo cargar la configuración de Mindee:', err);
      this.setMindeeStatus('No se pudo cargar la configuración actual.', true);
    }
  }

  async saveMindeeConfig() {
    const api = window.electronAPI || window.api;
    if (!api) return;

    const accountName = document.getElementById('mindeeAccountName').value.trim();
    const apiKey = document.getElementById('mindeeApiKey').value.trim();
    const modelId = document.getElementById('mindeeModelId').value.trim();
    const endpoint = document.getElementById('mindeeEndpoint').value.trim();

    if (!apiKey || !modelId) {
      this.setMindeeStatus('La API Key y el Model ID son obligatorios.', true);
      return;
    }

    try {
      const current = await this.getCurrentDbConfig();
      const res = await api.dbSaveConfig({
        ...current,
        mindeeApiKeyManual: apiKey,
        mindeeModelIdManual: modelId,
        mindeeEndpointManual: endpoint,
        mindeeAccountNameManual: accountName,
        idCuentaActual: '',
        idModelIDActual: '',
        idApiKeyActual: '',
        idProcesoActual: ''
      });

      if (!res || !res.ok) {
        this.setMindeeStatus(res?.error || 'No se pudo guardar la cuenta Mindee.', true);
        return;
      }

      this.setMindeeStatus('Cuenta Mindee guardada. La próxima extracción usará esta API Key.');
      setTimeout(() => this.closeMindeeConfig(), 900);
    } catch (err) {
      console.error('Error guardando Mindee:', err);
      this.setMindeeStatus('Error guardando la cuenta Mindee.', true);
    }
  }

  async clearMindeeConfig() {
    const api = window.electronAPI || window.api;
    if (!api) return;

    try {
      const current = await this.getCurrentDbConfig();
      const res = await api.dbSaveConfig({
        ...current,
        mindeeApiKeyManual: '',
        mindeeModelIdManual: '',
        mindeeEndpointManual: '',
        mindeeAccountNameManual: ''
      });

      if (!res || !res.ok) {
        this.setMindeeStatus(res?.error || 'No se pudo borrar la configuración manual.', true);
        return;
      }

      document.getElementById('mindeeAccountName').value = '';
      document.getElementById('mindeeApiKey').value = '';
      document.getElementById('mindeeModelId').value = '';
      document.getElementById('mindeeEndpoint').value = '';
      this.setMindeeStatus('Configuración manual borrada. Se usará la configuración de la base de datos.');
    } catch (err) {
      console.error('Error borrando Mindee:', err);
      this.setMindeeStatus('Error borrando la configuración manual.', true);
    }
  }

  /**
   * Updates the database connection status bar in the footer
   */
  async updateDbStatusBar() {
    const dbIndicator = document.getElementById("db-status-indicator");
    const dbText      = document.getElementById("db-status-text");
    const dbServer    = document.getElementById("db-status-server");
    const btnChangeDb = document.getElementById("btn-change-db");

    if (!dbIndicator || !dbText || !dbServer || !btnChangeDb) return;

    try {
      const api = window.electronAPI || window.api;
      if (!api) return;

      const res = await api.dbGetConfig();
      
      if (res && res.ok && res.data) {
        const { server, database, isOffline } = res.data;
        
        if (isOffline) {
          dbIndicator.className = "db-status-indicator disconnected";
          dbText.innerHTML = "BD: <strong>Trabajo Local (Offline)</strong>";
          dbText.title = "Trabajando en modo sin conexión centralizada.";
          dbServer.textContent = "Sin conexión activa";
          dbServer.title = "Las extracciones usarán las credenciales locales.";
        } else {
          dbIndicator.className = "db-status-indicator connected";
          dbText.innerHTML = `BD: <strong>${database || 'Sin base de datos'}</strong>`;
          dbText.title = `Conectado a ${database} (${server})`;
          dbServer.textContent = `${server || 'Sin servidor'}`;
          dbServer.title = `Servidor SQL Server: ${server}`;
        }
      } else {
        dbIndicator.className = "db-status-indicator disconnected";
        dbText.innerHTML = "BD: <strong>Sin Configurar</strong>";
        dbServer.textContent = "Configura la conexión";
      }

      // Show and setup click handler for the "Cambiar" button
      btnChangeDb.style.display = "inline-block";
      
      // Clean previous listeners
      const newBtn = btnChangeDb.cloneNode(true);
      btnChangeDb.parentNode.replaceChild(newBtn, btnChangeDb);
      
      newBtn.addEventListener("click", () => {
        if (api && api.send) {
          api.send('open-conexion');
        }
      });

    } catch (error) {
      console.error("Error al actualizar la barra de estado de BD:", error);
      dbIndicator.className = "db-status-indicator disconnected";
      dbText.innerHTML = "BD: <strong>Error</strong>";
      dbServer.textContent = "Error de red";
      btnChangeDb.style.display = "inline-block";
    }
  }
}

// Initialize the MainInterface when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  const mainInterface = new MainInterface();
  mainInterface.initialize();
  mainInterface.applyRolePermissions();
});

/**
 * Obtiene el rol del usuario desde el proceso main y adapta la UI.
 * - Administrador: acceso total (puede eliminar facturas, ver estadísticas, configurar conexión).
 * - Contable: acceso de lectura + alta de facturas (botones destructivos ocultos).
 */
MainInterface.prototype.applyRolePermissions = async function () {
  const api = window.electronAPI || window.api;
  if (!api) return;

  try {
    const res = await api.invoke('auth:getRole');
    if (!res || !res.ok) return;

    const { rol, nombre, usuario } = res;

    // 1. Mostrar nombre de usuario y rol real en la topbar
    const topbar = document.querySelector('.topbar');
    if (topbar && !document.getElementById('user-role-badge')) {
      const userBadge = document.createElement('div');
      userBadge.id = 'user-role-badge';
      userBadge.style.cssText = `
        display: inline-flex; align-items: center; gap: 8px;
        background: var(--surface2); border: 1px solid var(--border-med); border-radius: 20px;
        padding: 4px 12px; margin-right: 12px; font-size: 0.85rem; color: var(--text);
      `;
      
      const rolColor = rol === 'Administrador' ? '#3b82f6' : '#10b981';
      userBadge.innerHTML = `
        <span id="role-dot" style="width:8px;height:8px;border-radius:50%;background:${rolColor};display:inline-block;"></span>
        <strong>${nombre || usuario || 'Usuario'}</strong>
        <span id="role-label" style="font-size:0.85rem; color:var(--text-muted); white-space:nowrap;">${rol}</span>
        <button id="btn-logout" type="button" title="Cerrar sesion y cambiar de cuenta" style="border:none; background:var(--accent-bg); color:var(--accent-text); border-radius:14px; padding:4px 9px; cursor:pointer; font-size:0.78rem; font-weight:600;">
          Cambiar cuenta
        </button>
      `;
      // Insertar antes del primer botón de la topbar-right
      const topbarRight = document.querySelector('.topbar-right');
      if (topbarRight) topbarRight.insertBefore(userBadge, topbarRight.firstChild);

      document.getElementById('btn-logout').addEventListener('click', () => {
        if (confirm('Quieres cerrar la sesion actual y cambiar de cuenta?')) {
          api.send('auth:logout');
        }
      });
    }

    // 2. Aplicar restricciones según el rol inicial
    window.currentUserRole = rol;
    window.currentUserName = nombre;
    window.currentUserLogin = usuario;
    this.applyRestrictions(rol);

  } catch (err) {
    console.warn('[Roles] No se pudo obtener el rol del usuario:', err.message);
  }
};

/**
 * Aplica las restricciones visuales en base al rol (Administrador o Contable)
 */
MainInterface.prototype.applyRestrictions = function(rol) {
  const btnDelete = document.getElementById('btnDeleteInvoice');
  const btnChangeDb = document.getElementById('btn-change-db');
  const btnAdmin = document.getElementById('btnAdminPanel');
  
  if (rol === 'Contable') {
    if (btnDelete) {
      btnDelete.style.display = 'none';
      btnDelete.title = 'No tienes permisos para eliminar facturas (Rol: Contable)';
    }
    if (btnChangeDb) btnChangeDb.style.display = 'none';
    if (btnAdmin) btnAdmin.style.display = 'none';
    console.log('[Roles] Permisos aplicados: Contable — acciones destructivas deshabilitadas.');
  } else {
    if (btnDelete) {
      btnDelete.style.display = 'inline-block';
      btnDelete.title = 'Eliminar factura seleccionada';
    }
    if (btnChangeDb) btnChangeDb.style.display = 'inline-block';
    if (btnAdmin) btnAdmin.style.display = 'inline-flex';
    console.log('[Roles] Permisos aplicados: Administrador — acceso total.');
  }

};

MainInterface.prototype.setupAdminPanel = function () {
  this.adminModal = document.getElementById('adminModal');
  this.btnAdmin = document.getElementById('btnAdminPanel');
  this.btnCloseAdmin = document.getElementById('btnCloseAdmin');
  this.adminUsersPanel = document.getElementById('adminUsersPanel');
  this.adminAuditPanel = document.getElementById('adminAuditPanel');
  this.adminUsersList = document.getElementById('adminUsersList');
  this.adminAuditList = document.getElementById('adminAuditList');
  this.adminUserForm = document.getElementById('adminUserForm');
  this.adminUserOriginal = document.getElementById('adminUserOriginal');
  this.adminUserName = document.getElementById('adminUserName');
  this.adminFullName = document.getElementById('adminFullName');
  this.adminUserRole = document.getElementById('adminUserRole');
  this.adminUserActive = document.getElementById('adminUserActive');
  this.adminUserReset = document.getElementById('adminUserReset');
  this.adminUserSave = document.getElementById('adminUserSave');
  this.adminAuditLimit = document.getElementById('adminAuditLimit');
  this.adminAuditRefresh = document.getElementById('adminAuditRefresh');

  if (!this.adminModal) return;

  if (this.btnAdmin) {
    this.btnAdmin.addEventListener('click', () => this.openAdminPanel());
  }

  if (this.btnCloseAdmin) {
    this.btnCloseAdmin.addEventListener('click', () => this.closeAdminPanel());
  }

  this.adminModal.addEventListener('click', (event) => {
    if (event.target === this.adminModal) {
      this.closeAdminPanel();
    }
  });

  document.querySelectorAll('[data-admin-tab]').forEach((btn) => {
    btn.addEventListener('click', () => this.switchAdminTab(btn.dataset.adminTab));
  });

  if (this.adminAuditRefresh) {
    this.adminAuditRefresh.addEventListener('click', () => this.loadAuditLog());
  }

  if (this.adminAuditLimit) {
    this.adminAuditLimit.addEventListener('change', () => this.loadAuditLog());
  }

  if (this.adminUserReset) {
    this.adminUserReset.addEventListener('click', () => this.clearAdminForm());
  }

  if (this.adminUserForm) {
    this.adminUserForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      await this.saveAdminUser();
    });
  }
};

MainInterface.prototype.openAdminPanel = async function () {
  const api = window.electronAPI || window.api;
  if (!api || !this.adminModal) return;

  try {
    const res = await api.invoke('auth:getRole');
    if (!res || !res.ok || res.rol !== 'Administrador') {
      alert('No tienes permisos para abrir la administración.');
      return;
    }

    this.adminModal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
    this.switchAdminTab('users');
    this.clearAdminForm();
    await this.loadAdminUsers();
    await this.loadAuditLog();
    if (this.adminRefreshTimer) clearInterval(this.adminRefreshTimer);
    this.adminRefreshTimer = setInterval(() => {
      if (this.adminModal && this.adminModal.style.display === 'flex') {
        this.loadAdminUsers();
      }
    }, 3000);
  } catch (err) {
    console.error('No se pudo abrir el panel de administración:', err);
    alert('No se pudo abrir el panel de administración.');
  }
};

MainInterface.prototype.closeAdminPanel = function () {
  if (!this.adminModal) return;
  this.adminModal.style.display = 'none';
  document.body.style.overflow = '';
  if (this.adminRefreshTimer) {
    clearInterval(this.adminRefreshTimer);
    this.adminRefreshTimer = null;
  }
};

MainInterface.prototype.switchAdminTab = function (tabName) {
  const tabs = document.querySelectorAll('[data-admin-tab]');
  tabs.forEach((btn) => btn.classList.toggle('active', btn.dataset.adminTab === tabName));

  if (this.adminUsersPanel) {
    this.adminUsersPanel.classList.toggle('active', tabName === 'users');
  }
  if (this.adminAuditPanel) {
    this.adminAuditPanel.classList.toggle('active', tabName === 'audit');
  }
};

MainInterface.prototype.clearAdminForm = function () {
  if (!this.adminUserForm) return;
  this.adminUserForm.reset();
  if (this.adminUserOriginal) this.adminUserOriginal.value = '';
  if (this.adminUserName) {
    this.adminUserName.value = '';
    this.adminUserName.readOnly = false;
  }
  if (this.adminFullName) this.adminFullName.value = '';
  if (this.adminUserRole) this.adminUserRole.value = 'Contable';
  if (this.adminUserActive) this.adminUserActive.checked = true;
};

MainInterface.prototype.fillAdminForm = function (user) {
  if (!user) return;
  if (this.adminUserOriginal) this.adminUserOriginal.value = user.usuario || '';
  if (this.adminUserName) {
    this.adminUserName.value = user.usuario || '';
    this.adminUserName.readOnly = true;
  }
  if (this.adminFullName) this.adminFullName.value = user.nombreCompleto || '';
  if (this.adminUserRole) this.adminUserRole.value = user.rol || 'Contable';
  if (this.adminUserActive) this.adminUserActive.checked = !!user.activo;
};

MainInterface.prototype.loadAdminUsers = async function () {
  const api = window.electronAPI || window.api;
  if (!api || !this.adminUsersList) return;

  const res = await api.invoke('admin:listUsers');
  if (!res || !res.ok) {
    this.adminUsersList.innerHTML = `<div style="padding:14px;color:var(--text-muted);">No se pudieron cargar los usuarios.</div>`;
    return;
  }

  this.adminState.users = res.users || [];
  this.renderAdminUsers();
};

MainInterface.prototype.renderAdminUsers = function () {
  if (!this.adminUsersList) return;

  const rows = (this.adminState.users || []).map((user) => {
    const activeLabel = user.activo ? 'Habilitada' : 'Inutilizada';
    const connectionLabel = user.estadoConexion || 'No conectado';
    const connectionColor = connectionLabel === 'En linea' ? 'var(--success)' : 'var(--text-muted)';
    return `
      <tr>
        <td title="${escapeHtml(user.usuario)}">${escapeHtml(user.usuario)}</td>
        <td title="${escapeHtml(user.nombreCompleto)}">${escapeHtml(user.nombreCompleto)}</td>
        <td>${escapeHtml(user.rol)}</td>
        <td>
          <span style="display:inline-flex;align-items:center;gap:6px;color:${connectionColor};">
            <span style="width:8px;height:8px;border-radius:50%;background:${connectionLabel === 'En linea' ? 'var(--success)' : 'var(--text-hint)'};display:inline-block;"></span>
            ${escapeHtml(connectionLabel)}
          </span>
        </td>
        <td>
          <span style="display:inline-flex;align-items:center;gap:6px;color:${user.activo ? 'var(--success)' : 'var(--danger)'};">
            <span style="width:8px;height:8px;border-radius:50%;background:${user.activo ? 'var(--success)' : 'var(--danger)'};display:inline-block;"></span>
            ${activeLabel}
          </span>
        </td>
        <td>
          <div class="admin-user-actions">
            <button type="button" class="admin-mini-btn" data-admin-edit="${escapeHtml(user.usuario)}">Editar</button>
          </div>
        </td>
      </tr>
    `;
  }).join('');

  this.adminUsersList.innerHTML = `
    <table>
      <colgroup>
        <col style="width: 22%">
        <col style="width: 34%">
        <col style="width: 16%">
        <col style="width: 14%">
        <col style="width: 14%">
        <col style="width: 14%">
      </colgroup>
      <thead>
        <tr>
          <th>Usuario</th>
          <th>Nombre</th>
          <th>Rol</th>
          <th>Conexión</th>
          <th>Estado</th>
          <th>Acciones</th>
        </tr>
      </thead>
      <tbody>
        ${rows || '<tr><td colspan="6" style="padding:14px;color:var(--text-muted);">No hay usuarios.</td></tr>'}
      </tbody>
    </table>
  `;

  this.adminUsersList.querySelectorAll('[data-admin-edit]').forEach((button) => {
    button.addEventListener('click', () => {
      const usuario = button.dataset.adminEdit;
      const user = (this.adminState.users || []).find((item) => item.usuario === usuario);
      if (user) {
        this.fillAdminForm(user);
        this.switchAdminTab('users');
      }
    });
  });
};

MainInterface.prototype.loadAuditLog = async function () {
  const api = window.electronAPI || window.api;
  if (!api || !this.adminAuditList) return;

  const limit = parseInt(this.adminAuditLimit ? this.adminAuditLimit.value : '50', 10) || 50;
  const res = await api.invoke('admin:getAuditLog', { limit });
  if (!res || !res.ok) {
    this.adminAuditList.innerHTML = `<div style="padding:14px;color:var(--text-muted);">No se pudo cargar la auditoría.</div>`;
    return;
  }

  this.adminState.audit = res.logs || [];
  const rows = this.adminState.audit.map((item) => `
    <tr>
      <td>${escapeHtml(formatAuditDate(item.fechaHora))}</td>
      <td>${escapeHtml(item.usuario)}</td>
      <td>${escapeHtml(item.rol)}</td>
      <td>${escapeHtml(item.accion)}</td>
      <td>${escapeHtml(item.entidad || '')}</td>
      <td title="${escapeHtml(item.detalle || '')}">${escapeHtml(item.detalle || '')}</td>
      <td>${escapeHtml(item.resultado || '')}</td>
    </tr>
  `).join('');

  this.adminAuditList.innerHTML = `
    <table>
      <colgroup>
        <col style="width: 16%">
        <col style="width: 12%">
        <col style="width: 11%">
        <col style="width: 15%">
        <col style="width: 12%">
        <col style="width: 28%">
        <col style="width: 6%">
      </colgroup>
      <thead>
        <tr>
          <th>Fecha</th>
          <th>Usuario</th>
          <th>Rol</th>
          <th>Acción</th>
          <th>Entidad</th>
          <th>Detalle</th>
          <th>Res.</th>
        </tr>
      </thead>
      <tbody>
        ${rows || '<tr><td colspan="7" style="padding:14px;color:var(--text-muted);">No hay registros de auditoría.</td></tr>'}
      </tbody>
    </table>
  `;
};

MainInterface.prototype.saveAdminUser = async function () {
  const api = window.electronAPI || window.api;
  if (!api || !this.adminUserForm) return;

  const usuario = (this.adminUserName?.value || '').trim();
  const nombreCompleto = (this.adminFullName?.value || '').trim();
  const rol = this.adminUserRole?.value || 'Contable';
  const activo = !!(this.adminUserActive && this.adminUserActive.checked);

  if (!usuario) {
    alert('El usuario es obligatorio.');
    return;
  }

  try {
    const res = await api.invoke('admin:saveUser', {
      usuario,
      nombreCompleto,
      rol,
      activo
    });

    if (!res || !res.ok) {
      alert(res?.error || 'No se pudo guardar el usuario.');
      return;
    }

    const sessionRes = await api.invoke('auth:getSession');
    if (sessionRes && sessionRes.ok && sessionRes.data && sessionRes.data.rol !== 'Administrador') {
      this.closeAdminPanel();
      await this.applyRolePermissions();
      alert('Tu rol ha cambiado y la administración ya no está disponible para esta sesión.');
      return;
    }

    this.clearAdminForm();
    await this.loadAdminUsers();
    await this.loadAuditLog();
  } catch (err) {
    console.error('Error guardando usuario:', err);
    alert('No se pudo guardar el usuario.');
  }
};
