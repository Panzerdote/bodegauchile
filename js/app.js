const App = {
    state: {
        inventario: [],
        secciones: [],
        config: { porcentaje_critico: 20, dias_vencimiento: 30 }
    },

    async init() {
        try {
            UI.setConnectionStatus('🟡', 'Conectando...');
            if (typeof supabaseClient === 'undefined') throw new Error('Cliente de Supabase no inicializado');
            await this.loadAllData();
            this.setupEventListeners();
            this.showDashboard();
            UI.setConnectionStatus('🟢', 'Conectado');
        } catch (error) {
            console.error('Error al inicializar:', error);
            UI.setConnectionStatus('🔴', 'Error');
            UI.showToast('Error al conectar: ' + error.message, 'error');
        }
    },

    async loadAllData() {
        const [inventario, secciones, config] = await Promise.all([
            DB.getInventario(), DB.getSecciones(), DB.getConfig()
        ]);
        this.state.inventario = inventario || [];
        this.state.secciones = secciones || [];
        this.state.config = config || { porcentaje_critico: 20, dias_vencimiento: 30 };
    },

    setupEventListeners() {
        document.querySelectorAll('.sidebar-menu a[data-section]').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const section = link.dataset.section;
                if (section === 'dashboard') this.showDashboard();
                else if (section === 'inventario') this.showInventario();
                else if (section === 'movimientos') this.showMovimientos();
            });
        });

        document.getElementById('btn-ingreso').addEventListener('click', (e) => { e.preventDefault(); this.showIngresoModal(); });
        document.getElementById('btn-salida').addEventListener('click', (e) => { e.preventDefault(); this.showSalidaModal(); });
        document.getElementById('btn-buscar-anaquel').addEventListener('click', (e) => { e.preventDefault(); this.showBusquedaAnaquelModal(); });
        document.getElementById('btn-gestionar').addEventListener('click', (e) => { e.preventDefault(); this.showGestionSeccionesModal(); });
        document.getElementById('btn-exportar').addEventListener('click', (e) => { e.preventDefault(); this.exportarExcel(); });

        document.getElementById('header-actions').addEventListener('click', (e) => {
            if (e.target.closest('#header-btn-ingreso')) this.showIngresoModal();
            else if (e.target.closest('#header-btn-salida')) this.showSalidaModal();
            else if (e.target.closest('#header-btn-buscar')) this.showBusquedaAnaquelModal();
        });

        document.getElementById('busqueda-inventario').addEventListener('input', (e) => this.renderInventario(e.target.value));
        document.getElementById('busqueda-movimientos').addEventListener('input', (e) => this.renderMovimientos(e.target.value));

        document.getElementById('modal').addEventListener('click', (e) => { if (e.target === e.currentTarget) UI.closeModal(); });
        document.addEventListener('keydown', (e) => { if (e.key === 'Escape') UI.closeModal(); });
    },

    // ============================================
    // DASHBOARD
    // ============================================
    async showDashboard() {
        UI.setActiveSection('dashboard');
        await this.loadAllData();
        this.renderDashboard();
    },

    renderDashboard() {
        const { inventario, secciones, config } = this.state;
        
        document.getElementById('total-insumos').textContent = inventario.length;
        document.getElementById('total-badge').textContent = inventario.length;
        document.getElementById('stock-total').textContent = inventario.reduce((s, i) => s + (i.stock || 0), 0);
        document.getElementById('secciones-activas').textContent = [...new Set(secciones.map(s => s.seccion))].length;
        
        const criticos = inventario.filter(item => this.esStockCritico(item));
        document.getElementById('stock-critico').textContent = criticos.length;
        
        const hoy = new Date();
        const limite = new Date(hoy);
        limite.setDate(limite.getDate() + (config.dias_vencimiento || 30));
        document.getElementById('vencimientos-proximos').textContent = inventario.filter(item => {
            if (!item.vencimiento) return false;
            const v = new Date(item.vencimiento);
            return v >= hoy && v <= limite;
        }).length;

        this.renderAlertas(criticos);
        this.renderUltimosMovimientos();
        this.renderInventarioRapido();
    },

    esStockCritico(item) {
        if (!item.stock || item.stock === 0) return true;
        const stockMax = Math.max(item.stock, ...this.state.inventario
            .filter(i => i.nombre === item.nombre)
            .map(i => i.stock));
        if (stockMax === 0) return false;
        return (item.stock / stockMax) * 100 <= this.state.config.porcentaje_critico;
    },

    renderAlertas(criticos) {
        const container = document.getElementById('alertas-stock');
        if (criticos.length === 0) {
            container.innerHTML = '<div class="empty-state"><div class="icon">✅</div><p>No hay insumos con stock crítico.</p></div>';
            return;
        }
        let html = '<div class="table-container"><table><thead><tr><th>Insumo</th><th>Stock</th><th>Anaquel</th><th>Vencimiento</th><th>Estado</th></tr></thead><tbody>';
        criticos.forEach(item => {
            const venc = item.vencimiento ? new Date(item.vencimiento) : null;
            const vencido = venc && venc < new Date();
            html += `<tr class="${vencido ? 'stock-critical' : 'stock-warning'}">
                <td><strong>${item.nombre}</strong></td><td>${item.stock} ${item.unidad || ''}</td>
                <td>${item.anaquel}</td><td>${item.vencimiento || 'N/A'}</td>
                <td>${vencido ? '<span class="badge badge-danger">VENCIDO</span>' : '<span class="badge badge-warning">CRÍTICO</span>'}</td></tr>`;
        });
        html += '</tbody></table></div>';
        container.innerHTML = html;
    },

    async renderUltimosMovimientos() {
        const container = document.getElementById('ultimos-movimientos');
        UI.showLoading('ultimos-movimientos');
        try {
            const movimientos = await DB.getMovimientos(5);
            if (movimientos.length === 0) {
                container.innerHTML = '<div class="empty-state"><div class="icon">📋</div><p>Sin movimientos.</p></div>';
                return;
            }
            let html = '<div class="table-container"><table><thead><tr><th>Fecha</th><th>Tipo</th><th>Insumo</th><th>Cant.</th><th>Stock Ant.</th><th>Stock Nuevo</th><th>Anaquel</th></tr></thead><tbody>';
            movimientos.forEach(mov => {
                const fecha = new Date(mov.fecha);
                const color = mov.tipo === 'INGRESO' ? '#28a745' : '#dc3545';
                html += `<tr><td>${fecha.toLocaleString('es-CL')}</td>
                    <td><span class="badge" style="background:${color};">${mov.tipo}</span></td>
                    <td>${mov.insumo}</td><td>${mov.cantidad}</td>
                    <td>${mov.stock_anterior || '-'}</td><td>${mov.stock_nuevo || '-'}</td>
                    <td>${mov.anaquel || '-'}</td></tr>`;
            });
            html += '</tbody></table></div>';
            container.innerHTML = html;
        } catch (e) {
            container.innerHTML = '<div class="empty-state"><p>Error al cargar</p></div>';
        }
    },

    renderInventarioRapido() {
        const container = document.getElementById('inventario-rapido');
        const items = this.state.inventario.slice(0, 8);
        if (items.length === 0) {
            container.innerHTML = '<div class="empty-state"><div class="icon">📦</div><p>Sin insumos.</p></div>';
            return;
        }
        let html = '<div class="table-container"><table><thead><tr><th>Insumo</th><th>Sección</th><th>Anaquel</th><th>Stock</th><th>Und.</th><th>Lote</th><th>Venc.</th></tr></thead><tbody>';
        items.forEach(item => {
            const clase = this.esStockCritico(item) ? 'stock-critical' : '';
            html += `<tr class="${clase}"><td><strong>${item.nombre}</strong></td><td>${item.seccion}</td>
                <td>${item.anaquel}</td><td>${item.stock}</td><td>${item.unidad || ''}</td>
                <td>${item.lote || '-'}</td><td>${item.vencimiento || '-'}</td></tr>`;
        });
        html += '</tbody></table></div>';
        container.innerHTML = html;
    },

    // ============================================
    // INVENTARIO
    // ============================================
    async showInventario() {
        UI.setActiveSection('inventario');
        await this.loadAllData();
        this.renderInventario();
    },

    renderInventario(filtro = '') {
        let items = this.state.inventario;
        if (filtro) {
            const f = filtro.toLowerCase();
            items = items.filter(i => i.nombre?.toLowerCase().includes(f) || i.anaquel?.toLowerCase().includes(f) || i.seccion?.toLowerCase().includes(f));
        }
        const container = document.getElementById('tabla-inventario');
        if (items.length === 0) {
            container.innerHTML = '<div class="empty-state"><div class="icon">📦</div><p>Sin resultados.</p></div>';
            return;
        }
        let html = '<table><thead><tr><th>ID</th><th>Nombre</th><th>Sección</th><th>Anaquel</th><th>Stock</th><th>Und.</th><th>Lote</th><th>Venc.</th><th>Acc.</th></tr></thead><tbody>';
        items.forEach(item => {
            const critico = this.esStockCritico(item);
            const venc = item.vencimiento ? new Date(item.vencimiento) : null;
            const vencido = venc && venc < new Date();
            html += `<tr class="${critico ? 'stock-critical' : ''}">
                <td>${item.id}</td><td><strong>${item.nombre}</strong></td><td>${item.seccion}</td>
                <td>${item.anaquel}</td><td>${item.stock}</td><td>${item.unidad || ''}</td>
                <td>${item.lote || '-'}</td><td>${item.vencimiento || '-'} ${vencido ? '<span class="badge badge-danger">VENC</span>' : ''}</td>
                <td><button class="btn btn-warning btn-sm" onclick="App.editarInsumo(${item.id})">✏️</button>
                <button class="btn btn-danger btn-sm" onclick="App.eliminarInsumo(${item.id})">🗑️</button></td></tr>`;
        });
        html += '</tbody></table>';
        container.innerHTML = html;
    },

    // ============================================
    // MOVIMIENTOS
    // ============================================
    async showMovimientos() {
        UI.setActiveSection('movimientos');
        const container = document.getElementById('tabla-movimientos');
        UI.showLoading('tabla-movimientos');
        try {
            const movimientos = await DB.getMovimientos(100);
            this.renderMovimientos('', movimientos);
        } catch (e) {
            container.innerHTML = '<div class="empty-state"><p>Error al cargar.</p></div>';
        }
    },

    renderMovimientos(filtro = '', data = null) {
        let movs = data || [];
        if (filtro && data) {
            const f = filtro.toLowerCase();
            movs = movs.filter(m => m.insumo?.toLowerCase().includes(f) || m.tipo?.toLowerCase().includes(f));
        }
        const container = document.getElementById('tabla-movimientos');
        if (movs.length === 0) {
            container.innerHTML = '<div class="empty-state"><div class="icon">📋</div><p>Sin movimientos.</p></div>';
            return;
        }
        let html = '<table><thead><tr><th>Fecha</th><th>Tipo</th><th>Insumo</th><th>Cant.</th><th>Stock Ant.</th><th>Stock Nuevo</th><th>Anaquel</th></tr></thead><tbody>';
        movs.forEach(mov => {
            const fecha = new Date(mov.fecha);
            const color = mov.tipo === 'INGRESO' ? '#28a745' : '#dc3545';
            html += `<tr><td>${fecha.toLocaleString('es-CL')}</td>
                <td><span class="badge" style="background:${color};">${mov.tipo}</span></td>
                <td>${mov.insumo}</td><td>${mov.cantidad}</td>
                <td>${mov.stock_anterior || '-'}</td><td>${mov.stock_nuevo || '-'}</td>
                <td>${mov.anaquel || '-'}</td></tr>`;
        });
        html += '</tbody></table>';
        container.innerHTML = html;
    },

    // ============================================
    // MODALES
    // ============================================
    showIngresoModal() {
        const secciones = [...new Set(this.state.secciones.map(s => s.seccion))];
        // Para el ingreso, el usuario selecciona sección (letra) y anaquel (número)
        // pero necesitamos mostrar los anaqueles existentes para esa sección
        const html = `
            <h2>📥 Ingreso de Insumo</h2>
            <div class="form-group"><label>Nombre *</label><input type="text" id="ing-nombre" placeholder="Nombre del insumo"></div>
            <div class="form-row">
                <div class="form-group">
                    <label>Sección (Letra) *</label>
                    <select id="ing-seccion" onchange="App.actualizarAnaquelesIngreso()">
                        <option value="">Seleccione...</option>
                        ${secciones.map(s => `<option value="${s}">${s}</option>`).join('')}
                    </select>
                </div>
                <div class="form-group">
                    <label>Anaquel (Número) *</label>
                    <select id="ing-anaquel">
                        <option value="">Primero seleccione sección</option>
                    </select>
                </div>
            </div>
            <div class="form-row">
                <div class="form-group"><label>Cantidad *</label><input type="number" id="ing-cantidad" value="1" min="1"></div>
                <div class="form-group"><label>Unidad</label><input type="text" id="ing-unidad" placeholder="Caja, Unidad..."></div>
            </div>
            <div class="form-row">
                <div class="form-group"><label>Lote</label><input type="text" id="ing-lote"></div>
                <div class="form-group"><label>Vencimiento</label><input type="date" id="ing-vencimiento"></div>
            </div>
            <div class="form-group"><label>Comentarios</label><textarea id="ing-comentarios"></textarea></div>
            <div class="form-actions">
                <button class="btn btn-secondary" onclick="UI.closeModal()">Cancelar</button>
                <button class="btn btn-success" onclick="App.procesarIngreso()">✅ Registrar</button>
            </div>`;
        UI.openModal(html);
    },

    actualizarAnaquelesIngreso() {
        const seccion = document.getElementById('ing-seccion').value;
        const selectAnaquel = document.getElementById('ing-anaquel');
        
        if (!seccion) {
            selectAnaquel.innerHTML = '<option value="">Primero seleccione sección</option>';
            return;
        }
        
        // Obtener anaqueles existentes para esta sección
        const anaquelesExistentes = this.state.secciones
            .filter(s => s.seccion === seccion)
            .map(s => s.anaquel);
        
        // Si no hay anaqueles para esta sección, sugerir crear uno
        if (anaquelesExistentes.length === 0) {
            selectAnaquel.innerHTML = '<option value="">No hay anaqueles. Cree uno en ⚙ Anaqueles</option>';
            return;
        }
        
        selectAnaquel.innerHTML = '<option value="">Seleccione número...</option>' +
            anaquelesExistentes.map(a => `<option value="${a}">${a}</option>`).join('');
    },

    async procesarIngreso() {
        const nombre = document.getElementById('ing-nombre').value.trim();
        const seccion = document.getElementById('ing-seccion').value;
        const anaquel = document.getElementById('ing-anaquel').value;
        const cantidad = parseInt(document.getElementById('ing-cantidad').value);
        const unidad = document.getElementById('ing-unidad').value.trim();
        const lote = document.getElementById('ing-lote').value.trim();
        const vencimiento = document.getElementById('ing-vencimiento').value;
        const comentarios = document.getElementById('ing-comentarios').value.trim();
        
        if (!nombre || !seccion || !anaquel || !cantidad || cantidad <= 0) {
            UI.showToast('Complete los campos obligatorios (*)', 'error');
            return;
        }
        
        try {
            await DB.procesarIngreso(nombre, seccion, anaquel, cantidad, unidad, lote, vencimiento, comentarios);
            UI.closeModal();
            UI.showToast('✅ Ingreso registrado!', 'success');
            await this.loadAllData();
            this.renderDashboard();
        } catch (error) {
            UI.showToast('Error: ' + error.message, 'error');
        }
    },

    showSalidaModal() {
        const html = `
            <h2>📤 Salida de Insumo</h2>
            <div class="form-group"><label>Buscar Insumo</label>
            <input type="text" id="sal-busqueda" placeholder="Escriba el nombre..." onkeyup="App.buscarInsumoSalida()" autofocus></div>
            <div id="resultados-busqueda"></div>
            <div class="form-actions"><button class="btn btn-secondary" onclick="UI.closeModal()">Cancelar</button></div>`;
        UI.openModal(html);
    },

    buscarInsumoSalida() {
        const busqueda = document.getElementById('sal-busqueda').value.trim().toLowerCase();
        const resultados = this.state.inventario.filter(i => i.nombre?.toLowerCase().includes(busqueda) && i.stock > 0);
        const container = document.getElementById('resultados-busqueda');
        if (resultados.length === 0) {
            container.innerHTML = '<p style="padding:15px;color:#666;">Sin resultados.</p>';
            return;
        }
        let html = '';
        resultados.forEach(item => {
            html += `<div style="border:1px solid #ddd;padding:12px;margin:5px 0;border-radius:5px;display:flex;justify-content:space-between;align-items:center;">
                <div><strong>${item.nombre}</strong><br><small>Stock: ${item.stock} ${item.unidad||''} | Anaquel: ${item.anaquel}</small></div>
                <button class="btn btn-danger btn-sm" onclick="App.prepararSalida(${item.id})">Retirar</button></div>`;
        });
        container.innerHTML = html;
    },

    prepararSalida(id) {
        const item = this.state.inventario.find(i => i.id === id);
        if (!item) return;
        const html = `
            <h2>📤 Retirar Insumo</h2>
            <p><strong>${item.nombre}</strong></p><p>Stock: ${item.stock} ${item.unidad||''} | Anaquel: ${item.anaquel}</p>
            <div class="form-group"><label>Cantidad *</label><input type="number" id="sal-cantidad" value="1" min="1" max="${item.stock}" autofocus></div>
            <div class="form-group"><label>Motivo</label><textarea id="sal-comentarios"></textarea></div>
            <div class="form-actions">
                <button class="btn btn-secondary" onclick="App.showSalidaModal()">← Volver</button>
                <button class="btn btn-danger" onclick="App.procesarSalida(${id})">✅ Confirmar</button></div>`;
        UI.openModal(html);
    },

    async procesarSalida(id) {
        const cantidad = parseInt(document.getElementById('sal-cantidad').value);
        const comentarios = document.getElementById('sal-comentarios').value.trim();
        if (!cantidad || cantidad <= 0) { UI.showToast('Cantidad inválida', 'error'); return; }
        try {
            const result = await DB.procesarSalida(id, cantidad, comentarios);
            UI.closeModal();
            UI.showToast('✅ Salida registrada!', result.stockNuevo <= 5 ? 'warning' : 'success');
            await this.loadAllData();
            this.renderDashboard();
        } catch (error) {
            UI.showToast('Error: ' + error.message, 'error');
        }
    },

    showBusquedaAnaquelModal() {
        // Agrupar por sección
        const secciones = [...new Set(this.state.secciones.map(s => s.seccion))].sort();
        let options = '';
        secciones.forEach(sec => {
            const anaqueles = this.state.secciones.filter(s => s.seccion === sec).map(s => s.anaquel);
            options += `<optgroup label="Sección ${sec}">`;
            anaqueles.forEach(a => {
                options += `<option value="${sec}${a}">${sec}${a}</option>`;
            });
            options += '</optgroup>';
        });
        
        const html = `
            <h2>🔍 Buscar por Anaquel</h2>
            <div class="form-group"><label>Anaquel</label>
            <select id="bus-anaquel" onchange="App.buscarAnaquel()">
                <option value="">Seleccione...</option>${options}
            </select></div>
            <div id="resultado-anaquel"></div>
            <div class="form-actions"><button class="btn btn-secondary" onclick="UI.closeModal()">Cerrar</button></div>`;
        UI.openModal(html);
    },

    buscarAnaquel() {
        const anaquel = document.getElementById('bus-anaquel').value;
        if (!anaquel) return;
        const items = this.state.inventario.filter(i => i.anaquel === anaquel);
        const container = document.getElementById('resultado-anaquel');
        let html = `<h3>📦 Anaquel: ${anaquel}</h3>`;
        if (items.length === 0) {
            html += '<p style="padding:15px;">Vacío.</p>';
        } else {
            html += '<div class="table-container"><table><thead><tr><th>Insumo</th><th>Stock</th><th>Und.</th><th>Lote</th><th>Venc.</th><th>Estado</th></tr></thead><tbody>';
            items.forEach(item => {
                const venc = item.vencimiento ? new Date(item.vencimiento) : null;
                const hoy = new Date();
                const vencido = venc && venc < hoy;
                const critico = this.esStockCritico(item);
                html += `<tr class="${vencido || critico ? 'stock-critical' : ''}">
                    <td><strong>${item.nombre}</strong></td><td>${item.stock}</td><td>${item.unidad||''}</td>
                    <td>${item.lote||'-'}</td><td>${item.vencimiento||'-'}</td>
                    <td>${vencido?'<span class="badge badge-danger">VENC</span> ':''}${critico?'<span class="badge badge-danger">CRIT</span>':''}${!vencido&&!critico?'<span class="badge badge-success">OK</span>':''}</td></tr>`;
            });
            html += '</tbody></table></div>';
        }
        container.innerHTML = html;
    },

    // ============================================
    // GESTIÓN DE SECCIONES (CORREGIDO)
    // ============================================
    showGestionSeccionesModal() {
        let html = '<h2>⚙ Gestionar Secciones y Anaqueles</h2>';
        html += '<p style="font-size:12px;color:#666;margin-bottom:15px;">La <strong>Sección</strong> es la letra (A, B, C) y el <strong>Anaquel</strong> es el número (1, 2, 3). Juntos forman: <strong>A1, B3, etc.</strong></p>';
        
        if (this.state.secciones.length === 0) {
            html += '<div class="empty-state"><div class="icon">⚙</div><p>No hay anaqueles configurados.</p></div>';
        } else {
            // Agrupar por sección
            const agrupado = {};
            this.state.secciones.forEach(s => {
                if (!agrupado[s.seccion]) agrupado[s.seccion] = [];
                agrupado[s.seccion].push(s);
            });
            
            html += '<div class="table-container"><table><thead><tr><th>Sección</th><th>Anaquel</th><th>Código</th><th>Descripción</th><th>Acc.</th></tr></thead><tbody>';
            Object.keys(agrupado).sort().forEach(sec => {
                agrupado[sec].forEach(s => {
                    html += `<tr>
                        <td><strong>${s.seccion}</strong></td>
                        <td>${s.anaquel}</td>
                        <td><span class="badge badge-info">${s.seccion}${s.anaquel}</span></td>
                        <td>${s.descripcion || '-'}</td>
                        <td><button class="btn btn-danger btn-sm" onclick="App.eliminarSeccion(${s.id})">🗑️</button></td></tr>`;
                });
            });
            html += '</tbody></table></div>';
        }
        
        html += `
            <h3 style="margin-top:20px;">➕ Agregar Nuevo Anaquel</h3>
            <div class="form-row">
                <div class="form-group">
                    <label>Sección (Letra) *</label>
                    <input type="text" id="nueva-seccion" maxlength="1" placeholder="A, B, C..." style="text-transform:uppercase;">
                </div>
                <div class="form-group">
                    <label>N° Anaquel *</label>
                    <input type="text" id="nuevo-anaquel" placeholder="1, 2, 3...">
                </div>
                <div class="form-group">
                    <label>Descripción</label>
                    <input type="text" id="nueva-descripcion" placeholder="Opcional">
                </div>
            </div>
            <p style="font-size:11px;color:#666;margin-bottom:10px;">Ejemplo: Sección <strong>A</strong> + Anaquel <strong>1</strong> = Código <strong>A1</strong></p>
            <button class="btn btn-success" onclick="App.agregarSeccion()">➕ Agregar Anaquel</button>`;
        UI.openModal(html);
    },

    async agregarSeccion() {
        const seccion = document.getElementById('nueva-seccion').value.trim().toUpperCase();
        const anaquel = document.getElementById('nuevo-anaquel').value.trim();
        const descripcion = document.getElementById('nueva-descripcion').value.trim();
        
        if (!seccion || !anaquel) { UI.showToast('Complete sección y anaquel', 'error'); return; }
        
        const codigo = seccion + anaquel;
        if (this.state.secciones.find(s => s.seccion + s.anaquel === codigo)) {
            UI.showToast('El código ' + codigo + ' ya existe', 'error');
            return;
        }
        
        try {
            await DB.addSeccion(seccion, descripcion, anaquel);
            await this.loadAllData();
            this.showGestionSeccionesModal();
            this.renderDashboard();
            UI.showToast('✅ Anaquel ' + codigo + ' agregado!', 'success');
        } catch (error) {
            UI.showToast('Error: ' + error.message, 'error');
        }
    },

    async eliminarSeccion(id) {
        if (!confirm('¿Eliminar este anaquel?')) return;
        try {
            await DB.deleteSeccion(id);
            await this.loadAllData();
            this.showGestionSeccionesModal();
            this.renderDashboard();
        } catch (error) {
            UI.showToast('Error al eliminar', 'error');
        }
    },

    // ============================================
    // EDITAR / ELIMINAR INSUMO
    // ============================================
    editarInsumo(id) {
        const item = this.state.inventario.find(i => i.id === id);
        if (!item) return;
        const secs = [...new Set(this.state.secciones.map(s => s.seccion))];
        const anaqueles = this.state.secciones.filter(s => s.seccion === item.seccion).map(s => s.anaquel);
        
        const html = `
            <h2>✏️ Editar Insumo</h2>
            <div class="form-group"><label>Nombre *</label><input type="text" id="edit-nombre" value="${item.nombre||''}"></div>
            <div class="form-row">
                <div class="form-group"><label>Sección *</label>
                    <select id="edit-seccion" onchange="App.cambiarSeccionEdicion()">${secs.map(s => `<option value="${s}" ${s===item.seccion?'selected':''}>${s}</option>`).join('')}</select></div>
                <div class="form-group"><label>Anaquel *</label>
                    <select id="edit-anaquel">${anaqueles.map(a => `<option value="${a}" ${a===item.anaquel.replace(item.seccion,'')?'selected':''}>${a}</option>`).join('')}</select></div>
            </div>
            <div class="form-row">
                <div class="form-group"><label>Stock *</label><input type="number" id="edit-stock" value="${item.stock}" min="0"></div>
                <div class="form-group"><label>Unidad</label><input type="text" id="edit-unidad" value="${item.unidad||''}"></div>
            </div>
            <div class="form-row">
                <div class="form-group"><label>Lote</label><input type="text" id="edit-lote" value="${item.lote||''}"></div>
                <div class="form-group"><label>Vencimiento</label><input type="date" id="edit-vencimiento" value="${item.vencimiento||''}"></div>
            </div>
            <div class="form-group"><label>Comentarios</label><textarea id="edit-comentarios">${item.comentarios||''}</textarea></div>
            <div class="form-actions"><button class="btn btn-secondary" onclick="UI.closeModal()">Cancelar</button><button class="btn btn-success" onclick="App.procesarEdicion(${id})">💾 Guardar</button></div>`;
        UI.openModal(html);
    },

    cambiarSeccionEdicion() {
        const seccion = document.getElementById('edit-seccion').value;
        const anaqueles = this.state.secciones.filter(s => s.seccion === seccion).map(s => s.anaquel);
        const select = document.getElementById('edit-anaquel');
        select.innerHTML = anaqueles.map(a => `<option value="${a}">${a}</option>`).join('');
    },

    async procesarEdicion(id) {
        const seccion = document.getElementById('edit-seccion').value;
        const anaquelNum = document.getElementById('edit-anaquel').value;
        const updates = {
            nombre: document.getElementById('edit-nombre').value.trim(),
            seccion: seccion,
            anaquel: seccion + anaquelNum,
            stock: parseInt(document.getElementById('edit-stock').value),
            unidad: document.getElementById('edit-unidad').value.trim(),
            lote: document.getElementById('edit-lote').value.trim(),
            vencimiento: document.getElementById('edit-vencimiento').value || null,
            comentarios: document.getElementById('edit-comentarios').value.trim()
        };
        if (!updates.nombre || !updates.seccion || !anaquelNum || isNaN(updates.stock) || updates.stock < 0) {
            UI.showToast('Campos inválidos', 'error'); return;
        }
        try {
            await DB.updateInventarioItem(id, updates);
            UI.closeModal();
            UI.showToast('✅ Insumo actualizado!', 'success');
            await this.loadAllData();
            this.renderDashboard();
            this.renderInventario();
        } catch (error) {
            UI.showToast('Error: ' + error.message, 'error');
        }
    },

    async eliminarInsumo(id) {
        if (!confirm('¿Eliminar este insumo?')) return;
        try {
            await DB.deleteInventarioItem(id);
            UI.showToast('🗑️ Insumo eliminado', 'success');
            await this.loadAllData();
            this.renderDashboard();
            this.renderInventario();
        } catch (error) {
            UI.showToast('Error al eliminar', 'error');
        }
    },

    // ============================================
    // EXPORTAR A EXCEL
    // ============================================
    exportarExcel() {
        const { inventario } = this.state;
        
        if (inventario.length === 0) {
            UI.showToast('No hay datos para exportar', 'warning');
            return;
        }

        // Crear contenido CSV para Excel
        let csv = 'ID;Nombre;Sección;Anaquel;Stock;Unidad;Lote;Vencimiento;Comentarios\n';
        
        inventario.forEach(item => {
            csv += `${item.id};"${item.nombre}";${item.seccion};${item.anaquel};${item.stock};${item.unidad||''};${item.lote||''};${item.vencimiento||''};"${item.comentarios||''}"\n`;
        });

        // Agregar BOM para que Excel detecte UTF-8
        const BOM = '\uFEFF';
        const blob = new Blob([BOM + csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `inventario_bodega_${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        URL.revokeObjectURL(url);
        
        UI.showToast('✅ Exportado como CSV (compatible con Excel)!', 'success');
    }
};

// ============================================
// INICIAR APLICACIÓN
// ============================================
document.addEventListener('DOMContentLoaded', () => App.init());
