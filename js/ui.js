// ============================================
// CAPA DE INTERFAZ DE USUARIO
// ============================================

const UI = {
    toastTimeout: null,

    // ============================================
    // NAVEGACIÓN
    // ============================================
    setActiveSection(sectionName) {
        document.querySelectorAll('[id^="section-"]').forEach(s => s.style.display = 'none');
        const section = document.getElementById(`section-${sectionName}`);
        if (section) section.style.display = 'block';
        
        document.querySelectorAll('.sidebar-menu a').forEach(a => a.classList.remove('active'));
        const menuLink = document.querySelector(`[data-section="${sectionName}"]`);
        if (menuLink) menuLink.classList.add('active');
        
        const titles = {
            dashboard: '📊 Dashboard',
            inventario: '📦 Inventario Completo',
            movimientos: '📋 Historial de Movimientos'
        };
        document.getElementById('page-title').textContent = titles[sectionName] || '';
        
        const headerActions = document.getElementById('header-actions');
        if (sectionName === 'dashboard') {
            headerActions.innerHTML = `
                <button class="btn btn-success" id="header-btn-ingreso">➕ Ingreso</button>
                <button class="btn btn-danger" id="header-btn-salida">➖ Salida</button>
            `;
        } else if (sectionName === 'inventario') {
            headerActions.innerHTML = `
                <button class="btn btn-success" id="header-btn-ingreso">➕ Ingreso</button>
                <button class="btn btn-info" id="header-btn-buscar">🔍 Anaquel</button>
            `;
        } else {
            headerActions.innerHTML = '';
        }
    },

    // ============================================
    // TOAST
    // ============================================
    showToast(mensaje, tipo = '') {
        const toast = document.getElementById('toast');
        toast.textContent = mensaje;
        toast.className = `toast ${tipo}`;
        toast.style.display = 'block';
        
        clearTimeout(this.toastTimeout);
        this.toastTimeout = setTimeout(() => {
            toast.style.display = 'none';
        }, 3000);
    },

    // ============================================
    // MODAL CON BOTÓN X
    // ============================================
    openModal(content) {
        const contentWithClose = `
            <button class="modal-close" onclick="UI.closeModal()" title="Cerrar">✕</button>
            ${content}
        `;
        document.getElementById('modal-content').innerHTML = contentWithClose;
        document.getElementById('modal').classList.add('active');
    },

    closeModal() {
        document.getElementById('modal').classList.remove('active');
    },

    // ============================================
    // ESTADO DE CONEXIÓN
    // ============================================
    setConnectionStatus(emoji, text) {
        const el = document.getElementById('connection-status');
        if (el) el.textContent = `${emoji} ${text}`;
    },

    // ============================================
    // LOADING
    // ============================================
    showLoading(containerId) {
        const container = document.getElementById(containerId);
        if (container) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="spinner" style="margin:0 auto 15px;"></div>
                    <p>Cargando...</p>
                </div>`;
        }
    }
};
