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

        document.addEventListener('keydown', (e) => { 
            if (e.key === 'Escape') UI.closeModal(); 
        });
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
        let html = '<div class="table-container"><table><thead><tr><th>Insumo</th><th>Anaquel</th><th>Stock</th><th>Und.</th><th>Lote</th><th>Venc.</th></tr></thead><tbody>';
        items.forEach(item => {
            const clase = this.esStockCritico(item) ? 'stock-critical' : '';
            html += `<tr class="${clase}"><td><strong>${item.nombre}</strong></td>
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
        let html = '<table><thead><tr><th>ID</th><th>Nombre</th><th>Anaquel</th><th>Stock</th><th>Und.</th><th>Lote</th><th>Venc.</th><th>Acc.</th></tr></thead><tbody>';
        items.forEach(item => {
            const critico = this.esStockCritico(item);
            const venc = item.vencimiento ? new Date(item.vencimiento) : null;
            const vencido = venc && venc < new Date();
            html += `<tr class="${critico ? 'stock-critical' : ''}">
                <td>${item.id}</td><td><strong>${item.nombre}</strong></td>
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
    // MODAL DE INGRESO
    // ============================================
    showIngresoModal() {
        const anaqueles = this.state.secciones
            .map(s => s.seccion + s.anaquel)
            .sort();
        
        const html = `
            <h2>📥 Ingreso de Insumo</h2>
            <div class="form-group">
                <label>Nombre del Insumo *</label>
                <input type="text" id="ing-nombre" placeholder="Nombre del insumo" autofocus>
            </div>
            <div class="form-group">
                <label>Anaquel *</label>
                <select id="ing-anaquel">
                    <option value="">Seleccione anaquel...</option>
                    ${anaqueles.map(a => `<option value="${a}">${a}</option>`).join('')}
                </select>
                ${anaqueles.length === 0 ? '<small style="color:#dc3545;">No hay anaqueles configurados. Vaya a ⚙ Anaqueles para crear uno.</small>' : ''}
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label>Cantidad *</label>
                    <input type="number" id="ing-cantidad" value="1" min="1">
                </div>
                <div class="form-group">
                    <label>Unidad de Medida</label>
                    <input type="text" id="ing-unidad" placeholder="Caja, Unidad, Botella...">
                </div>
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label>N° Lote</label>
                    <input type="text" id="ing-lote" placeholder="LOTE-2024-001">
                </div>
                <div class="form-group">
                    <label>Fecha Vencimiento</label>
                    <input type="date" id="ing-vencimiento">
                </div>
            </div>
            <div class="form-group">
                <label>Comentarios</label>
                <textarea id="ing-comentarios" placeholder="Información adicional..."></textarea>
            </div>
            <div class="form-actions">
                <button class="btn btn-secondary" onclick="UI.closeModal()">Cancelar</button>
                <button class="btn btn-success" onclick="App.procesarIngreso()">✅ Registrar Ingreso</button>
            </div>`;
        UI.openModal(html);
    },

    async procesarIngreso() {
        const nombre = document.getElementById('ing-nombre').value.trim();
        const anaquel = document.getElementById('ing-anaquel').value;
        const cantidad = parseInt(document.getElementById('ing-cantidad').value);
        const unidad = document.getElementById('ing-unidad').value.trim();
        const lote = document.getElementById('ing-lote').value.trim();
        const vencimiento = document.getElementById('ing-vencimiento').value;
        const comentarios = document.getElementById('ing-comentarios').value.trim();
        
        if (!nombre || !anaquel || !cantidad || cantidad <= 0) {
            UI.showToast('Complete los campos obligatorios (*)', 'error');
            return;
        }
        
        const seccion = anaquel.charAt(0);
        
        try {
            await DB.procesarIngreso(nombre, seccion, anaquel, cantidad, unidad, lote, vencimiento, comentarios);
            UI.closeModal();
            UI.showToast('✅ Ingreso registrado en ' + anaquel + '!', 'success');
            await this.loadAllData();
            this.renderDashboard();
        } catch (error) {
            UI.showToast('Error: ' + error.message, 'error');
        }
    },

    // ============================================
    // MODAL DE SALIDA
    // ============================================
    showSalidaModal() {
        const anaqueles = this.state.secciones
            .map(s => s.seccion + s.anaquel)
            .sort();
        
        const html = `
            <h2>📤 Salida de Insumo</h2>
            
            <div class="form-group">
                <label>Filtrar por Anaquel</label>
                <select id="sal-anaquel-filtro" onchange="App.filtrarPorAnaquelSalida()">
                    <option value="">Todos los anaqueles</option>
                    ${anaqueles.map(a => `<option value="${a}">${a}</option>`).join('')}
                </select>
            </div>
            
            <div class="form-group">
                <label>Buscar por Nombre</label>
                <input type="text" id="sal-busqueda" placeholder="Escriba el nombre del insumo..." onkeyup="App.buscarInsumoSalida()">
            </div>
            
            <div id="resultados-busqueda">
                <p style="color:#666; padding:15px;">Seleccione un anaquel o escriba un nombre para buscar insumos.</p>
            </div>
            <div class="form-actions">
                <button class="btn btn-secondary" onclick="UI.closeModal()">Cancelar</button>
            </div>`;
        UI.openModal(html);
    },

    filtrarPorAnaquelSalida() {
        const anaquel = document.getElementById('sal-anaquel-filtro').value;
        const busqueda = document.getElementById('sal-busqueda');
        if (anaquel) busqueda.value = '';
        this.buscarInsumoSalida();
    },

    buscarInsumoSalida() {
        const anaquelFiltro = document.getElementById('sal-anaquel-filtro').value;
        const busqueda = document.getElementById('sal-busqueda').value.trim().toLowerCase();
        
        let resultados = this.state.inventario.filter(item => item.stock > 0);
        if (anaquelFiltro) resultados = resultados.filter(item => item.anaquel === anaquelFiltro);
        if (busqueda) resultados = resultados.filter(item => item.nombre.toLowerCase().includes(busqueda));
        
        const container = document.getElementById('resultados-busqueda');
        
        if (resultados.length === 0) {
            container.innerHTML = '<p style="padding:15px;color:#666;">No se encontraron insumos con stock disponible.</p>';
            return;
        }
        
        let html = '<div style="max-height:400px; overflow-y:auto;">';
        resultados.forEach(item => {
            html += `
                <div style="border:1px solid #ddd; padding:12px; margin:5px 0; border-radius:5px; display:flex; justify-content:space-between; align-items:center;">
                    <div>
                        <strong>${item.nombre}</strong><br>
                        <small>Stock: ${item.stock} ${item.unidad || ''} | Anaquel: <span class="badge badge-info">${item.anaquel}</span></small>
                        ${item.lote ? `<br><small>Lote: ${item.lote}</small>` : ''}
                    </div>
                    <button class="btn btn-danger btn-sm" onclick="App.prepararSalida(${item.id})">Retirar</button>
                </div>`;
        });
        html += '</div>';
        container.innerHTML = html;
    },

    prepararSalida(id) {
        const item = this.state.inventario.find(i => i.id === id);
        if (!item) return;
        
        const html = `
            <h2>📤 Retirar Insumo</h2>
            <div style="background:#f8f9fa; padding:15px; border-radius:8px; margin-bottom:15px;">
                <p><strong>Insumo:</strong> ${item.nombre}</p>
                <p><strong>Anaquel:</strong> <span class="badge badge-info">${item.anaquel}</span></p>
                <p><strong>Stock Actual:</strong> ${item.stock} ${item.unidad || 'unidades'}</p>
                ${item.lote ? `<p><strong>Lote:</strong> ${item.lote}</p>` : ''}
                ${item.vencimiento ? `<p><strong>Vencimiento:</strong> ${item.vencimiento}</p>` : ''}
            </div>
            <div class="form-group">
                <label>Cantidad a retirar *</label>
                <input type="number" id="sal-cantidad" value="1" min="1" max="${item.stock}" autofocus>
            </div>
            <div class="form-group">
                <label>Motivo / Comentarios</label>
                <textarea id="sal-comentarios" placeholder="Ej: Uso en pabellón, cirugía..."></textarea>
            </div>
            <div class="form-actions">
                <button class="btn btn-secondary" onclick="App.showSalidaModal()">← Volver</button>
                <button class="btn btn-danger" onclick="App.procesarSalida(${id})">✅ Confirmar Retiro</button>
            </div>`;
        UI.openModal(html);
    },

    async procesarSalida(id) {
        const cantidad = parseInt(document.getElementById('sal-cantidad').value);
        const comentarios = document.getElementById('sal-comentarios').value.trim();
        if (!cantidad || cantidad <= 0) { UI.showToast('Cantidad inválida', 'error'); return; }
        try {
            const result = await DB.procesarSalida(id, cantidad, comentarios);
            UI.closeModal();
            let msg = '✅ Salida registrada!';
            if (result.stockNuevo <= 5) msg += ' ⚠ Stock bajo!';
            UI.showToast(msg, result.stockNuevo <= 5 ? 'warning' : 'success');
            await this.loadAllData();
            this.renderDashboard();
        } catch (error) {
            UI.showToast('Error: ' + error.message, 'error');
        }
    },

    // ============================================
    // BÚSQUEDA POR ANAQUEL
    // ============================================
    showBusquedaAnaquelModal() {
        const anaqueles = this.state.secciones
            .map(s => s.seccion + s.anaquel)
            .sort();
        
        const html = `
            <h2>🔍 Buscar por Anaquel</h2>
            <div class="form-group">
                <label>Seleccione Anaquel</label>
                <select id="bus-anaquel" onchange="App.buscarAnaquel()">
                    <option value="">Seleccione...</option>
                    ${anaqueles.map(a => `<option value="${a}">${a}</option>`).join('')}
                </select>
            </div>
            <div id="resultado-anaquel"></div>
            <div class="form-actions">
                <button class="btn btn-secondary" onclick="UI.closeModal()">Cerrar</button>
            </div>`;
        UI.openModal(html);
    },

    buscarAnaquel() {
        const anaquel = document.getElementById('bus-anaquel').value;
        if (!anaquel) return;
        
        const items = this.state.inventario.filter(i => i.anaquel === anaquel);
        const container = document.getElementById('resultado-anaquel');
        
        let html = `<h3>📦 Contenido de Anaquel: <span class="badge badge-info">${anaquel}</span></h3>`;
        
        if (items.length === 0) {
            html += '<p style="padding:15px;">Anaquel vacío o sin insumos asignados.</p>';
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
    // GESTIÓN DE SECCIONES (COMPLETAMENTE NUEVA)
    // ============================================
    showGestionSeccionesModal() {
        let html = '<h2>⚙ Gestionar Secciones y Anaqueles</h2>';
        html += '<p style="font-size:12px;color:#666;margin-bottom:15px;">Primero cree una <strong>Sección</strong> (categoría con descripción), luego agregue <strong>Anaqueles</strong> (numeración) dentro de ella.</p>';
        
        // Agrupar secciones
        const seccionesAgrupadas = {};
        this.state.secciones.forEach(s => {
            if (!seccionesAgrupadas[s.seccion]) {
                seccionesAgrupadas[s.seccion] = {
                    descripcion: s.descripcion || 'Sin descripción',
                    anaqueles: []
                };
            }
            seccionesAgrupadas[s.seccion].anaqueles.push(s.anaquel);
        });
        
        const seccionesKeys = Object.keys(seccionesAgrupadas).sort();
        
        if (seccionesKeys.length === 0) {
            html += '<div class="empty-state"><div class="icon">⚙</div><p>No hay secciones ni anaqueles configurados. ¡Cree la primera!</p></div>';
        } else {
            html += '<div style="display:grid; gap:15px; margin-bottom:20px;">';
            
            seccionesKeys.forEach(sec => {
                const info = seccionesAgrupadas[sec];
                const anaquelesOrdenados = info.anaqueles.sort((a, b) => a.localeCompare(b, undefined, {numeric: true}));
                
                html += `
                    <div style="border:2px solid #e0e0e0; border-radius:10px; padding:15px; background:white;">
                        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
                            <div>
                                <span style="font-size:20px; font-weight:bold; color:var(--primary);">Sección ${sec}</span>
                                <span style="margin-left:10px; color:#555; font-size:14px;">— ${info.descripcion}</span>
                            </div>
                            <button class="btn btn-danger btn-sm" onclick="App.eliminarSeccionCompleta('${sec}')" title="Eliminar toda la sección">🗑️ Eliminar Sección</button>
                        </div>
                        <div style="display:flex; flex-wrap:wrap; gap:8px; margin-bottom:12px; min-height:30px;">
                            ${anaquelesOrdenados.length === 0 ? '<span style="color:#999; font-size:12px;">Sin anaqueles</span>' : ''}
                            ${anaquelesOrdenados.map(a => `
                                <span style="background:var(--primary); color:white; padding:6px 12px; border-radius:20px; font-size:13px; display:inline-flex; align-items:center; gap:8px;">
                                    ${sec}${a}
                                    <button onclick="event.stopPropagation(); App.eliminarAnaquelIndividual('${sec}', '${a}')" style="background:rgba(255,255,255,0.3); border:none; color:white; cursor:pointer; font-size:14px; padding:2px 6px; border-radius:50%; line-height:1;" title="Eliminar anaquel ${sec}${a}">×</button>
                                </span>
                            `).join('')}
                        </div>
                        <button class="btn btn-info btn-sm" onclick="App.mostrarAgregarAnaquel('${sec}')">➕ Agregar Anaquel a Sección ${sec}</button>
                    </div>`;
            });
            
            html += '</div>';
        }
        
        // Crear nueva sección
        html += `
            <h3 style="margin-top:25px; padding-top:20px; border-top:2px solid #eee;">➕ Crear Nueva Sección</h3>
            <p style="font-size:12px;color:#666;margin-bottom:12px;">Cree una nueva categoría para organizar sus insumos.</p>
            <div class="form-row">
                <div class="form-group">
                    <label>Letra de Sección *</label>
                    <input type="text" id="nueva-seccion-letra" maxlength="1" placeholder="A, B, C..." style="text-transform:uppercase;">
                    <small style="color:#888;">Ej: A, B, C...</small>
                </div>
                <div class="form-group">
                    <label>Descripción *</label>
                    <input type="text" id="nueva-seccion-descripcion" placeholder="Ej: Material Quirúrgico">
                    <small style="color:#888;">Ej: Material Quirúrgico, Insumos Clínicos, Aseo...</small>
                </div>
                <div class="form-group">
                    <label>Primer Anaquel (opcional)</label>
                    <input type="text" id="nueva-seccion-anaquel" placeholder="1">
                    <small style="color:#888;">Si no ingresa, se creará con anaquel "1"</small>
                </div>
            </div>
            <button class="btn btn-success" onclick="App.crearNuevaSeccion()">✅ Crear Sección</button>
            <div class="form-actions">
                <button class="btn btn-secondary" onclick="UI.closeModal()">Cerrar</button>
            </div>`;
        
        UI.openModal(html);
    },

    async crearNuevaSeccion() {
        const letra = document.getElementById('nueva-seccion-letra').value.trim().toUpperCase();
        const descripcion = document.getElementById('nueva-seccion-descripcion').value.trim();
        const anaquel = document.getElementById('nueva-seccion-anaquel').value.trim() || '1';
        
        if (!letra || !descripcion) {
            UI.showToast('La letra y descripción son obligatorias', 'error');
            return;
        }
        
        if (!/^[A-Z]$/.test(letra)) {
            UI.showToast('La letra debe ser una sola letra (A-Z)', 'error');
            return;
        }
        
        // Verificar que la letra no exista ya
        const existeLetra = this.state.secciones.some(s => s.seccion === letra);
        if (existeLetra) {
            UI.showToast('La sección ' + letra + ' ya existe. Puede agregar anaqueles a ella desde la lista.', 'error');
            return;
        }
        
        const codigo = letra + anaquel;
        if (this.state.secciones.find(s => s.seccion + s.anaquel === codigo)) {
            UI.showToast('El código ' + codigo + ' ya existe', 'error');
            return;
        }
        
        try {
            await DB.addSeccion(letra, descripcion, anaquel);
            await this.loadAllData();
            this.showGestionSeccionesModal();
            this.renderDashboard();
            UI.showToast('✅ Sección ' + letra + ' creada como ' + codigo + '!', 'success');
        } catch (error) {
            UI.showToast('Error: ' + error.message, 'error');
        }
    },

    mostrarAgregarAnaquel(seccion) {
        const info = this.state.secciones.find(s => s.seccion === seccion);
        const descripcion = info ? info.descripcion : '';
        
        const html = `
            <h2>➕ Agregar Anaquel a Sección ${seccion}</h2>
            <div style="background:#f8f9fa; padding:15px; border-radius:8px; margin-bottom:15px;">
                <p><strong>Sección:</strong> ${seccion}</p>
                <p><strong>Descripción:</strong> ${descripcion}</p>
            </div>
            <div class="form-group">
                <label>Número de Anaquel *</label>
                <input type="text" id="agregar-anaquel-numero" placeholder="2, 3, 4..." autofocus>
                <small style="color:#888;">Se creará: <strong>${seccion} + número</strong></small>
            </div>
            <div class="form-actions">
                <button class="btn btn-secondary" onclick="App.showGestionSeccionesModal()">← Volver</button>
                <button class="btn btn-success" onclick="App.agregarAnaquelASeccion('${seccion}')">✅ Agregar Anaquel</button>
            </div>`;
        
        UI.openModal(html);
    },

    async agregarAnaquelASeccion(seccion) {
        const numero = document.getElementById('agregar-anaquel-numero').value.trim();
        
        if (!numero) {
            UI.showToast('Ingrese un número de anaquel', 'error');
            return;
        }
        
        const codigo = seccion + numero;
        if (this.state.secciones.find(s => s.seccion + s.anaquel === codigo)) {
            UI.showToast('El anaquel ' + codigo + ' ya existe en esta sección', 'error');
            return;
        }
        
        try {
            const seccionExistente = this.state.secciones.find(s => s.seccion === seccion);
            const descripcion = seccionExistente ? seccionExistente.descripcion : '';
            
            await DB.addSeccion(seccion, descripcion, numero);
            await this.loadAllData();
            this.showGestionSeccionesModal();
            this.renderDashboard();
            UI.showToast('✅ Anaquel ' + codigo + ' agregado!', 'success');
        } catch (error) {
            UI.showToast('Error: ' + error.message, 'error');
        }
    },

    async eliminarAnaquelIndividual(seccion, anaquel) {
        const codigo = seccion + anaquel;
        
        if (!confirm('¿Eliminar el anaquel ' + codigo + '? Los insumos en él NO se eliminarán.')) return;
        
        const item = this.state.secciones.find(s => s.seccion === seccion && s.anaquel === anaquel);
        if (!item) return;
        
        try {
            await DB.deleteSeccion(item.id);
            await this.loadAllData();
            this.showGestionSeccionesModal();
            this.renderDashboard();
            UI.showToast('✅ Anaquel ' + codigo + ' eliminado!', 'success');
        } catch (error) {
            UI.showToast('Error al eliminar', 'error');
        }
    },

    async eliminarSeccionCompleta(seccion) {
        if (!confirm('⚠ ¿Eliminar TODA la sección ' + seccion + ' y todos sus anaqueles? Esta acción no se puede deshacer.')) return;
        if (!confirm('¿ESTÁ COMPLETAMENTE SEGURO? Se eliminarán todos los anaqueles de la sección ' + seccion + '.')) return;
        
        const items = this.state.secciones.filter(s => s.seccion === seccion);
        
        try {
            for (const item of items) {
                await DB.deleteSeccion(item.id);
            }
            await this.loadAllData();
            this.showGestionSeccionesModal();
            this.renderDashboard();
            UI.showToast('✅ Sección ' + seccion + ' eliminada completamente!', 'success');
        } catch (error) {
            UI.showToast('Error al eliminar', 'error');
        }
    },

    // ============================================
    // EDITAR INSUMO
    // ============================================
    editarInsumo(id) {
        const item = this.state.inventario.find(i => i.id === id);
        if (!item) return;
        
        const anaqueles = this.state.secciones
            .map(s => s.seccion + s.anaquel)
            .sort();
        
        const html = `
            <h2>✏️ Editar Insumo #${item.id}</h2>
            <div class="form-group">
                <label>Nombre *</label>
                <input type="text" id="edit-nombre" value="${item.nombre||''}">
            </div>
            <div class="form-group">
                <label>Anaquel *</label>
                <select id="edit-anaquel">
                    ${anaqueles.map(a => `<option value="${a}" ${a===item.anaquel?'selected':''}>${a}</option>`).join('')}
                </select>
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label>Stock (Actual: ${item.stock})</label>
                    <input type="number" id="edit-stock" value="${item.stock}" min="0">
                </div>
                <div class="form-group">
                    <label>Unidad</label>
                    <input type="text" id="edit-unidad" value="${item.unidad||''}">
                </div>
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label>Lote</label>
                    <input type="text" id="edit-lote" value="${item.lote||''}">
                </div>
                <div class="form-group">
                    <label>Vencimiento</label>
                    <input type="date" id="edit-vencimiento" value="${item.vencimiento||''}">
                </div>
            </div>
            <div class="form-group">
                <label>Comentarios</label>
                <textarea id="edit-comentarios">${item.comentarios||''}</textarea>
            </div>
            <div class="form-actions">
                <button class="btn btn-secondary" onclick="UI.closeModal()">Cancelar</button>
                <button class="btn btn-success" onclick="App.procesarEdicion(${id})">💾 Guardar Cambios</button>
            </div>`;
        UI.openModal(html);
    },

    async procesarEdicion(id) {
        const item = this.state.inventario.find(i => i.id === id);
        if (!item) return;
        
        const anaquel = document.getElementById('edit-anaquel').value;
        const seccion = anaquel.charAt(0);
        const nuevoStock = parseInt(document.getElementById('edit-stock').value);
        const stockAnterior = item.stock;
        
        const updates = {
            nombre: document.getElementById('edit-nombre').value.trim(),
            seccion: seccion,
            anaquel: anaquel,
            stock: nuevoStock,
            unidad: document.getElementById('edit-unidad').value.trim(),
            lote: document.getElementById('edit-lote').value.trim(),
            vencimiento: document.getElementById('edit-vencimiento').value || null,
            comentarios: document.getElementById('edit-comentarios').value.trim()
        };
        
        if (!updates.nombre || !anaquel || isNaN(nuevoStock) || nuevoStock < 0) {
            UI.showToast('Complete los campos obligatorios (*)', 'error');
            return;
        }
        
        try {
            await DB.updateInventarioItem(id, updates);
            
            // Registrar movimiento si cambió el stock
            if (nuevoStock !== stockAnterior) {
                const tipo = nuevoStock > stockAnterior ? 'INGRESO' : 'SALIDA';
                const diferencia = Math.abs(nuevoStock - stockAnterior);
                
                await DB.addMovimiento({
                    tipo: tipo,
                    insumo: updates.nombre,
                    cantidad: diferencia,
                    stock_anterior: stockAnterior,
                    stock_nuevo: nuevoStock,
                    anaquel: anaquel,
                    comentarios: 'Stock modificado manualmente',
                    usuario: 'web'
                });
            }
            
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
        if (!confirm('¿Eliminar este insumo permanentemente?')) return;
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

        let csv = 'ID;Nombre;Anaquel;Stock;Unidad;Lote;Vencimiento;Comentarios\n';
        
        inventario.forEach(item => {
            csv += `${item.id};"${item.nombre}";${item.anaquel};${item.stock};${item.unidad||''};${item.lote||''};${item.vencimiento||''};"${item.comentarios||''}"\n`;
        });

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
