// ============================================
// CAPA DE INTERFAZ DE USUARIO
// ============================================

const UI = {
    toastTimeout: null,

    icons: {
        check: '<svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="#27ae60" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>',
        alert: '<svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="#c0392b" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
        box: '<svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="#999" stroke-width="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>',
        list: '<svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="#999" stroke-width="2"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>',
        settings: '<svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="#999" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>',
        plus: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>',
        minus: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="8" y1="12" x2="16" y2="12"/></svg>',
        search: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>',
        download: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>',
        trash: '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>',
        edit: '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>',
        close: '✕'
    },

    toggleSidebar() {
        const sidebar = document.getElementById('sidebar');
        const overlay = document.getElementById('sidebar-overlay');
        if (sidebar.classList.contains('active')) { this.closeSidebar(); }
        else { sidebar.classList.add('active'); overlay.classList.add('active'); document.body.style.overflow = 'hidden'; }
    },

    closeSidebar() {
        const sidebar = document.getElementById('sidebar');
        const overlay = document.getElementById('sidebar-overlay');
        sidebar.classList.remove('active'); overlay.classList.remove('active'); document.body.style.overflow = '';
    },

    setupMobileMenu() {
        document.querySelectorAll('.sidebar-menu a').forEach(link => {
            link.addEventListener('click', () => { if (window.innerWidth <= 768) this.closeSidebar(); });
        });
    },

    setActiveSection(sectionName) {
        document.querySelectorAll('[id^="section-"]').forEach(s => s.style.display = 'none');
        const section = document.getElementById(`section-${sectionName}`);
        if (section) section.style.display = 'block';
        document.querySelectorAll('.sidebar-menu a').forEach(a => a.classList.remove('active'));
        const menuLink = document.querySelector(`[data-section="${sectionName}"]`);
        if (menuLink) menuLink.classList.add('active');
        const titles = { dashboard: 'Dashboard', inventario: 'Inventario Completo', movimientos: 'Historial de Movimientos' };
        document.getElementById('page-title').textContent = titles[sectionName] || '';
        const headerActions = document.getElementById('header-actions');
        if (sectionName === 'dashboard') {
            headerActions.innerHTML = `<button class="btn btn-success" id="header-btn-ingreso">${this.icons.plus} Ingreso</button><button class="btn btn-danger" id="header-btn-salida">${this.icons.minus} Salida</button>`;
        } else if (sectionName === 'inventario') {
            headerActions.innerHTML = `<button class="btn btn-success" id="header-btn-ingreso">${this.icons.plus} Ingreso</button><button class="btn btn-info" id="header-btn-buscar">${this.icons.search} Anaquel</button>`;
        } else if (sectionName === 'movimientos') {
            headerActions.innerHTML = `<button class="btn btn-success" onclick="App.exportarMovimientosExcel()">${this.icons.download} Exportar Excel</button>`;
        } else {
            headerActions.innerHTML = '';
        }
    },

    showToast(mensaje, tipo = '') {
        const toast = document.getElementById('toast');
        toast.textContent = mensaje; toast.className = `toast ${tipo}`; toast.style.display = 'block';
        clearTimeout(this.toastTimeout); this.toastTimeout = setTimeout(() => { toast.style.display = 'none'; }, 3000);
    },

    openModal(content) {
        const contentWithClose = `<button class="modal-close" onclick="UI.closeModal()" title="Cerrar">${this.icons.close}</button>${content}`;
        document.getElementById('modal-content').innerHTML = contentWithClose;
        document.getElementById('modal').classList.add('active'); document.body.style.overflow = 'hidden';
    },

    closeModal() { document.getElementById('modal').classList.remove('active'); document.body.style.overflow = ''; },

    setConnectionStatus(estado, text) {
        const el = document.getElementById('connection-status');
        if (el) {
            const colores = { success: '#27ae60', warning: '#f39c12', error: '#c0392b' };
            el.innerHTML = `<svg viewBox="0 0 24 24" width="10" height="10" fill="${colores[estado] || '#f39c12'}" style="vertical-align:middle;"><circle cx="12" cy="12" r="6"/></svg> ${text}`;
        }
    },

    showLoading(containerId) {
        const container = document.getElementById(containerId);
        if (container) { container.innerHTML = `<div class="empty-state"><div class="spinner" style="margin:0 auto 15px;"></div><p>Cargando...</p></div>`; }
    }
};

function toggleSidebar() { UI.toggleSidebar(); }
function closeSidebar() { UI.closeSidebar(); }
