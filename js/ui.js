// ============================================
// CAPA DE INTERFAZ DE USUARIO
// ============================================

const UI = {
    // ============================================
    // NAVEGACIÓN
    // ============================================
    setActiveSection(sectionName) {
        // Ocultar todas las secciones
        document.querySelectorAll('[id^="section-"]').forEach(s => s.style.display = 'none');
        
        // Mostrar la sección activa
        const section = document.getElementById(`section-${sectionName}`);
        if (section) section.style.display = 'block';
        
        // Actualizar menú
        document.querySelectorAll('.sidebar-menu a').forEach(a => a.classList.remove('active'));
        const menuLink = document.querySelector(`[data-section="${sectionName}"]`);
        if (menuLink) menuLink.classList.add('active');
        
        // Actualizar título
        const titles = {
            dashboard: '📊 Dashboard',
            inventario: '📦 Inventario Completo',
            movimientos: '📋 Historial de Movimientos'
        };
        document.getElementById('page-title').textContent = titles[sectionName] || '';
        
        // Actualizar botones del header
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
    // MODAL
    // ============================================
    openModal(content) {
        document.getElementById('modal-content').innerHTML = content;
        document.getElementById('modal').classList.add('active');
    },

    closeModal() {
        document.getElementById('modal').classList.remove('active');
    },

    // ============================================
    // TABLAS
    // ============================================
    renderTable(containerId, columns, data, options = {}) {
        const container = document.getElementById(containerId);
        if (!container) return;
        
        if (!data || data.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="icon">${options.emptyIcon || '📭'}</div>
                    <p>${options.emptyMessage || 'No hay datos disponibles.'}</p>
                </div>`;
            return;
        }
        
        let html = '<table><thead><tr>';
        columns.forEach(col => {
            html += `<th>${col.label}</th>`;
        });
        html += '</tr></thead><tbody>';
        
        data.forEach(row => {
            const rowClass = options.rowClass ? options.rowClass(row) : '';
            html += `<tr class="${rowClass}">`;
            columns.forEach(col => {
                html += `<td>${col.render ? col.render(row) : (row[col.field] || '')}</td>`;
            });
            html += '</tr>';
        });
        
        html += '</tbody></table>';
        container.innerHTML = html;
    },

    // ============================================
    // ESTADO DE CONEXIÓN
    // ============================================
    setConnectionStatus(status, text) {
        const el = document.getElementById('connection-status');
        if (el) {
            el.textContent = `${status} ${text}`;
        }
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
