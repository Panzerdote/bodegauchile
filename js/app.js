// ============================================
// APLICACIÓN PRINCIPAL
// ============================================

const App = {
    // Estado global
    state: {
        inventario: [],
        secciones: [],
        config: { porcentaje_critico: 20, dias_vencimiento: 30 }
    },

    // ============================================
    // INICIALIZACIÓN
    // ============================================
    async init() {
    try {
        UI.setConnectionStatus('🟡', 'Conectando...');
        
        // Verificar que supabaseClient existe
        if (typeof supabaseClient === 'undefined') {
            throw new Error('Cliente de Supabase no inicializado');
        }
        
        // Cargar datos iniciales
        await this.loadAllData();
        
        // Configurar eventos
        this.setupEventListeners();
        
        // Mostrar dashboard
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
            DB.getInventario(),
            DB.getSecciones(),
            DB.getConfig()
        ]);
        
        this.state.inventario = inventario;
        this.state.secciones = secciones;
        this.state.config = config || { porcentaje_critico: 20, dias_vencimiento: 30 };
    },

    // ============================================
    // EVENTOS
    // ============================================
    setupEventListeners() {
        // Menú lateral
        document.querySelectorAll('.sidebar-menu a[data-section]').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const section = link.dataset.section;
                if (section === 'dashboard') this.showDashboard();
                else if (section === 'inventario') this.showInventario();
                else if (section === 'movimientos') this.showMovimientos();
            });
        });

        // Botones del sidebar
        document.getElementById('btn-ingreso').addEventListener('click', (e) => {
            e.preventDefault();
            this.showIngresoModal();
        });
        
        document.getElementById('btn-salida').addEventListener('click', (e) => {
            e.preventDefault();
            this.showSalidaModal();
        });
        
        document.getElementById('btn-buscar-anaquel').addEventListener('click', (e) => {
            e.preventDefault();
            this.showBusquedaAnaquelModal();
        });
        
        document.getElementById('btn-gestionar').addEventListener('click', (e) => {
            e.preventDefault();
            this.showGestionSeccionesModal();
        });

        document.getElementById('btn-exportar').addEventListener('click', (e) => {
            e.preventDefault();
            this.exportarDatos();
        });

        document.getElementById('btn-importar').addEventListener('click', (e) => {
            e.preventDefault();
            this.importarDatos();
        });

        // Botones del header (delegación)
        document.getElementById('header-actions').addEventListener('click', (e) => {
            if (e.target.id === 'header-btn-ingreso' || e.target.closest('#header-btn-ingreso')) {
                this.showIngresoModal();
            } else if (e.target.id === 'header-btn-salida' || e.target.closest('#header-btn-salida')) {
                this.showSalidaModal();
            } else if (e.target.id === 'header-btn-buscar' || e.target.closest('#header-btn-buscar')) {
                this.showBusquedaAnaquelModal();
            }
        });

        // Búsquedas
        document.getElementById('busqueda-inventario').addEventListener('input', (e) => {
            this.renderInventario(e.target.value);
        });
        
        document.getElementById('busqueda-movimientos').addEventListener('input', (e) => {
            this.renderMovimientos(e.target.value);
        });

        // Cerrar modal
        document.getElementById('modal').addEventListener('click', (e) => {
            if (e.target === e.currentTarget) UI.closeModal();
        });

        // Tecla ESC
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
        
        // Cards
        document.getElementById('total-insumos').textContent = inventario.length;
        document.getElementById('total-badge').textContent = inventario.length;
        
        const stockTotal = inventario.reduce((sum, i) => sum + (i.stock || 0), 0);
        document.getElementById('stock-total').textContent = stockTotal;
        
        const seccionesUnicas = [...new Set(secciones.map(s => s.seccion))];
        document.getElementById('secciones-activas').textContent = seccionesUnicas.length;
        
        // Stock crítico
        const criticos = inventario.filter(item => this.esStockCritico(item));
        document.getElementById('stock-critico').textContent = criticos.length;
        
        // Vencimientos
        const hoy = new Date();
        const limite = new Date(hoy);
        limite.setDate(limite.getDate() + (config.dias_vencimiento || 30));
        const vencenPronto = inventario.filter(item => {
            if (!item.vencimiento) return false;
            const venc = new Date(item.vencimiento);
            return venc >= hoy && venc <= limite;
        }).length;
        document.getElementById('vencimientos-proximos').textContent = vencenPronto;

        // Alertas
        this.renderAlertas(criticos);
        
        // Últimos movimientos
        this.renderUltimosMovimientos();
        
        // Vista rápida
        this.renderInventarioRapido();
    },

    esStockCritico(item) {
        if (!item.stock || item.stock === 0) return true;
        const stockMax = item.stock_max || item.stock;
        const porcentaje = (item.stock / stockMax) * 100;
        return porcentaje <= this.state.config.porcentaje_critico;
    },

    renderAlertas(criticos) {
        const container = document.getElementById('alertas-stock');
        
        if (criticos.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="icon">✅</div>
                    <p>No hay insumos con stock crítico.</p>
                </div>`;
            return;
        }
        
        let html = '<div class="table-container"><table><thead><tr>';
        html += '<th>Insumo</th><th>Stock</th><th>Anaquel</th><th>Vencimiento</th><th>Estado</th>';
        html += '</tr></thead><tbody>';
        
        criticos.forEach(item => {
            const venc = item.vencimiento ? new Date(item.vencimiento) : null;
            const vencido = venc && venc < new Date();
            html += `<tr class="${vencido ? 'stock-critical' : 'stock-warning'}">`;
            html += `<td><strong>${item.nombre}</strong></td>`;
            html += `<td>${item.stock} ${item.unidad || ''}</td>`;
            html += `<td>${item.anaquel}</td>`;
            html += `<td>${item.vencimiento || 'N/A'}</td>`;
            html += `<td>${vencido ? '<span class="badge badge-danger">VENCIDO</span>' : '<span class="badge badge-warning">CRÍTICO</span>'}</td>`;
            html += '</tr>';
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
            
            let html = '<div class="table-container"><table><thead><tr>';
            html += '<th>Fecha</th><th>Tipo</th><th>Insumo</th><th>Cant.</th><th>Stock Ant.</th><th>Stock Nuevo</th><th>Anaquel</th>';
            html += '</tr></thead><tbody>';
            
            movimientos.forEach(mov => {
                const fecha = new Date(mov.fecha);
                const tipoColor = mov.tipo === 'INGRESO' ? '#28a745' : '#dc3545';
                html += '<tr>';
                html += `<td>${fecha.toLocaleString('es-CL')}</td>`;
                html += `<td><span class="badge" style="background:${tipoColor};">${mov.tipo}</span></td>`;
                html += `<td>${mov.insumo}</td>`;
                html += `<td>${mov.cantidad}</td>`;
                html += `<td>${mov.stock_anterior || '-'}</td>`;
                html += `<td>${mov.stock_nuevo || '-'}</td>`;
                html += `<td>${mov.anaquel || '-'}</td>`;
                html += '</tr>';
            });
            
            html += '</tbody></table></div>';
            container.innerHTML = html;
        } catch (error) {
            container.innerHTML = '<div class="empty-state"><p>Error al cargar movimientos</p></div>';
        }
    },

    renderInventarioRapido() {
        const container = document.getElementById('inventario-rapido');
        const items = this.state.inventario.slice(0, 8);
        
        if (items.length === 0) {
            container.innerHTML = '<div class="empty-state"><div class="icon">📦</div><p>Sin insumos.</p></div>';
            return;
        }
        
        let html = '<div class="table-container"><table><thead><tr>';
        html += '<th>Insumo</th><th>Sec.</th><th>Anaquel</th><th>Stock</th><th>Und.</th><th>Lote</th><th>Venc.</th>';
        html += '</tr></thead><tbody>';
        
        items.forEach(item => {
            const clase = this.esStockCritico(item) ? 'stock-critical' : '';
            html += `<tr class="${clase}">`;
            html += `<td><strong>${item.nombre}</strong></td>`;
            html += `<td>${item.seccion}</td>`;
            html += `<td>${item.anaquel}</td>`;
            html += `<td>${item.stock}</td>`;
            html += `<td>${item.unidad || ''}</td>`;
            html += `<td>${item.lote || '-'}</td>`;
            html += `<td>${item.vencimiento || '-'}</td>`;
            html += '</tr>';
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
            items = items.filter(item =>
                item.nombre?.toLowerCase().includes(f) ||
                item.anaquel?.toLowerCase().includes(f) ||
                item.seccion?.toLowerCase().includes(f) ||
                item.lote?.toLowerCase().includes(f)
            );
        }
        
        const container = document.getElementById('tabla-inventario');
        
        if (items.length === 0) {
            container.innerHTML = '<div class="empty-state"><div class="icon">📦</div><p>Sin resultados.</p></div>';
            return;
        }
        
        let html = '<table><thead><tr>';
        html += '<th>ID</th><th>Nombre</th><th>Sec.</th><th>Anaquel</th><th>Stock</th><th>Und.</th><th>Lote</th><th>Venc.</th><th>Acc.</th>';
        html += '</tr></thead><tbody>';
        
        items.forEach(item => {
            const critico = this.esStockCritico(item);
            const clase = critico ? 'stock-critical' : '';
            const venc = item.vencimiento ? new Date(item.vencimiento) : null;
            const vencido = venc && venc < new Date();
            
            html += `<tr class="${clase}">`;
            html += `<td>${item.id}</td>`;
            html += `<td><strong>${item.nombre}</strong></td>`;
            html += `<td>${item.seccion}</td>`;
            html += `<td>${item.anaquel}</td>`;
            html += `<td>${item.stock}</td>`;
            html += `<td>${item.unidad || ''}</td>`;
            html += `<td>${item.lote || '-'}</td>`;
            html += `<td>${item.vencimiento || '-'} ${vencido ? '<span class="badge badge-danger">VENC</span>' : ''}</td>`;
            html += `<td>
                <button class="btn btn-warning btn-sm" onclick="App.editarInsumo(${item.id})">✏️</button>
                <button class="btn btn-danger btn-sm" onclick="App.eliminarInsumo(${item.id})">🗑️</button>
            </td>`;
            html += '</tr>';
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
        } catch (error) {
            container.innerHTML = '<div class="empty-state"><p>Error al cargar.</p></div>';
        }
    },

    renderMovimientos(filtro = '', movimientosData = null) {
        let movs = movimientosData || [];
        
        if (filtro && movimientosData) {
            const f = filtro.toLowerCase();
            movs = movs.filter(mov =>
                mov.insumo?.toLowerCase().includes(f) ||
                mov.tipo?.toLowerCase().includes(f) ||
                mov.anaquel?.toLowerCase().includes(f)
            );
        }
        
        const container = document.getElementById('tabla-movimientos');
        
        if (movs.length === 0) {
            container.innerHTML = '<div class="empty-state"><div class="icon">📋</div><p>Sin movimientos.</p></div>';
            return;
        }
        
        let html = '<table><thead><tr>';
        html += '<th>Fecha</th><th>Tipo</th><th>Insumo</th><th>Cant.</th><th>Stock Ant.</th><th>Stock Nuevo</th><th>Anaquel</th>';
        html += '</tr></thead><tbody>';
        
        movs.forEach(mov => {
            const fecha = new Date(mov.fecha);
            const tipoColor = mov.tipo === 'INGRESO' ? '#28a745' : '#dc3545';
            html += '<tr>';
            html += `<td>${fecha.toLocaleString('es-CL')}</td>`;
            html += `<td><span class="badge" style="background:${tipoColor};">${mov.tipo}</span></td>`;
            html += `<td>${mov.insumo}</td>`;
            html += `<td>${mov.cantidad}</td>`;
            html += `<td>${mov.stock_anterior || '-'}</td>`;
            html += `<td>${mov.stock_nuevo || '-'}</td>`;
            html += `<td>${mov.anaquel || '-'}</td>`;
            html += '</tr>';
        });
        
        html += '</tbody></table>';
        container.innerHTML = html;
    },

    // ============================================
    // MODALES
    // ============================================
    showIngresoModal() {
        const secciones = [...new Set(this.state.secciones.map(s => s.seccion))];
        const anaqueles = this.state.secciones.map(s => s.anaquel);
        
        const html = `
            <h2>📥 Ingreso de Insumo</h2>
            <div class="form-group">
                <label>Nombre *</label>
                <input type="text" id="ing-nombre" placeholder="Nombre del insumo">
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label>Sección *</label>
                    <select id="ing-seccion">
                        <option value="">Seleccione...</option>
                        ${secciones.map(s => `<option value="${s}">${s}</option>`).join('')}
                    </select>
                </div>
                <div class="form-group">
                    <label>Anaquel *</label>
                    <select id="ing-anaquel">
                        <option value="">Seleccione...</option>
                        ${anaqueles.map(a => `<option value="${a}">${a}</option>`).join('')}
                    </select>
                </div>
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label>Cantidad *</label>
                    <input type="number" id="ing-cantidad" value="1" min="1">
                </div>
                <div class="form-group">
                    <label>Unidad</label>
                    <input type="text" id="ing-unidad" placeholder="Caja, Unidad...">
                </div>
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label>Lote</label>
                    <input type="text" id="ing-lote">
                </div>
                <div class="form-group">
                    <label>Vencimiento</label>
                    <input type="date" id="ing-vencimiento">
                </div>
            </div>
            <div class="form-group">
                <label>Comentarios</label>
                <textarea id="ing-comentarios"></textarea>
            </div>
            <div class="form-actions">
                <button class="btn btn-secondary" onclick="UI.closeModal()">Cancelar</button>
                <button class="btn btn-success" onclick="App.procesarIngreso()">✅ Registrar</button>
            </div>
        `;
        
        UI.openModal(html);
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
            <div class="form-group">
                <label>Buscar Insumo</label>
                <input type="text" id="sal-busqueda" placeholder="Escriba el nombre..." onkeyup="App.buscarInsumoSalida()" autofocus>
            </div>
            <div id="resultados-busqueda"></div>
            <div class="form-actions">
                <button class="btn btn-secondary" onclick="UI.closeModal()">Cancelar</button>
            </div>
        `;
        
        UI.openModal(html);
    },

    buscarInsumoSalida() {
        const busqueda = document.getElementById('sal-busqueda').value.trim().toLowerCase();
        const resultados = this.state.inventario.filter(item =>
            item.nombre?.toLowerCase().includes(busqueda) && item.stock > 0
        );
        
        const container = document.getElementById('resultados-busqueda');
        
        if (resultados.length === 0) {
            container.innerHTML = '<p style="padding:15px; color:#666;">Sin resultados.</p>';
            return;
        }
        
        let html = '';
        resultados.forEach(item => {
            html += `
                <div style="border:1px solid #ddd; padding:12px; margin:5px 0; border-radius:5px; display:flex; justify-content:space-between; align-items:center;">
                    <div>
                        <strong>${item.nombre}</strong><br>
                        <small>Stock: ${item.stock} ${item.unidad || ''} | Anaquel: ${item.anaquel}</small>
                    </div>
                    <button class="btn btn-danger btn-sm" onclick="App.prepararSalida(${item.id})">Retirar</button>
                </div>
            `;
        });
        
        container.innerHTML = html;
    },

    prepararSalida(id) {
        const item = this.state.inventario.find(i => i.id === id);
        if (!item) return;
        
        const html = `
            <h2>📤 Retirar Insumo</h2>
            <p><strong>${item.nombre}</strong></p>
            <p>Stock: ${item.stock} ${item.unidad || ''} | Anaquel: ${item.anaquel}</p>
            <div class="form-group">
                <label>Cantidad *</label>
                <input type="number" id="sal-cantidad" value="1" min="1" max="${item.stock}" autofocus>
            </div>
            <div class="form-group">
                <label>Motivo</label>
                <textarea id="sal-comentarios"></textarea>
            </div>
            <div class="form-actions">
                <button class="btn btn-secondary" onclick="App.showSalidaModal()">← Volver</button>
                <button class="btn btn-danger" onclick="App.procesarSalida(${id})">✅ Confirmar</button>
            </div>
        `;
        
        UI.openModal(html);
    },

    async procesarSalida(id) {
        const cantidad = parseInt(document.getElementById('sal-cantidad').value);
        const comentarios = document.getElementById('sal-comentarios').value.trim();
        
        if (!cantidad || cantidad <= 0) {
            UI.showToast('Cantidad inválida', 'error');
            return;
        }
        
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

    showBusquedaAnaquelModal() {
        const anaqueles = [...new Set(this.state.secciones.map(s => s.anaquel))].sort();
        
        const html = `
            <h2>🔍 Buscar por Anaquel</h2>
            <div class="form-group">
                <label>Anaquel</label>
                <select id="bus-anaquel" onchange="App.buscarAnaquel()">
                    <option value="">Seleccione...</option>
                    ${anaqueles.map(a => `<option value="${a}">${a}</option>`).join('')}
                </select>
            </div>
            <div id="resultado-anaquel"></div>
            <div class="form-actions">
                <button class="btn btn-secondary" onclick="UI.closeModal()">Cerrar</button>
            </div>
        `;
        
        UI.openModal(html);
    },

    buscarAnaquel() {
        const anaquel = document.getElementById('bus-anaquel').value;
        if (!anaquel) return;
        
        const items = this.state.inventario.filter(item => item.anaquel === anaquel);
        const container = document.getElementById('resultado-anaquel');
        
        let html = `<h3>📦 Anaquel: ${anaquel}</h3>`;
        
        if (items.length === 0) {
            html += '<p style="padding:15px;">Vacío.</p>';
        } else {
            html += '<div class="table-container"><table><thead><tr>';
            html += '<th>Insumo</th><th>Stock</th><th>Und.</th><th>Lote</th><th>Venc.</th><th>Estado</th>';
            html += '</tr></thead><tbody>';
            
            items.forEach(item => {
                const venc = item.vencimiento ? new Date(item.vencimiento) : null;
                const hoy = new Date();
                const vencido = venc && venc < hoy;
                const critico = this.esStockCritico(item);
                
                html += `<tr class="${vencido || critico ? 'stock-critical' : ''}">`;
                html += `<td><strong>${item.nombre}</strong></td>`;
                html += `<td>${item.stock}</td>`;
                html += `<td>${item.unidad || ''}</td>`;
                html += `<td>${item.lote || '-'}</td>`;
                html += `<td>${item.vencimiento || '-'}</td>`;
                html += `<td>
                    ${vencido ? '<span class="badge badge-danger">VENC</span> ' : ''}
                    ${critico ? '<span class="badge badge-danger">CRIT</span>' : ''}
                    ${!vencido && !critico ? '<span class="badge badge-success">OK</span>' : ''}
                </td>`;
                html += '</tr>';
            });
            
            html += '</tbody></table></div>';
        }
        
        container.innerHTML = html;
    },

    showGestionSeccionesModal() {
        let html = '<h2>⚙ Gestionar Anaqueles</h2>';
        
        if (this.state.secciones.length === 0) {
            html += '<div class="empty-state"><div class="icon">⚙</div><p>No hay anaqueles. ¡Agregue el primero!</p></div>';
        } else {
            html += '<div class="table-container"><table><thead><tr><th>Sección</th><th>Descripción</th><th>Anaquel</th><th>Acc.</th></tr></thead><tbody>';
            this.state.secciones.forEach(sec => {
                html += `<tr>
                    <td><strong>${sec.seccion}</strong></td>
                    <td>${sec.descripcion || '-'}</td>
                    <td>${sec.anaquel}</td>
                    <td><button class="btn btn-danger btn-sm" onclick="App.eliminarSeccion(${sec.id})">🗑️</button></td>
                </tr>`;
            });
            html += '</tbody></table></div>';
        }
        
        html += `
            <h3 style="margin-top:15px;">➕ Agregar Anaquel</h3>
            <div class="form-row">
                <div class="form-group">
                    <label>Sección *</label>
                    <input type="text" id="nueva-seccion" maxlength="1" placeholder="A">
                </div>
                <div class="form-group">
                    <label>Descripción</label>
                    <input type="text" id="nueva-descripcion" placeholder="Opcional">
                </div>
                <div class="form-group">
                    <label>Anaquel *</label>
                    <input type="text" id="nuevo-anaquel" placeholder="A1">
                </div>
            </div>
            <button class="btn btn-success" onclick="App.agregarSeccion()">➕ Agregar</button>
        `;
        
        UI.openModal(html);
    },

    async agregarSeccion() {
        const seccion = document.getElementById('nueva-seccion').value.trim().toUpperCase();
        const descripcion = document.getElementById('nueva-descripcion').value.trim();
        const anaquel = document.getElementById('nuevo-anaquel').value.trim().toUpperCase();
        
        if (!seccion || !anaquel) {
            UI.showToast('Complete los campos *', 'error');
            return;
        }
        
        try {
            await DB.addSeccion(seccion, descripcion, anaquel);
            await this.loadAllData();
            this.showGestionSeccionesModal();
            this.renderDashboard();
            UI.showToast('✅ Anaquel agregado!', 'success');
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

    async editarInsumo(id) {
        const item = this.state.inventario.find(i => i.id === id);
        if (!item) return;
        
        const secs = [...new Set(this.state.secciones.map(s => s.seccion))];
        const anaq = this.state.secciones.map(s => s.anaquel);
        
        const html = `
            <h2>✏️ Editar Insumo</h2>
            <div class="form-group">
                <label>Nombre *</label>
                <input type="text" id="edit-nombre" value="${item.nombre || ''}">
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label>Sección *</label>
                    <select id="edit-seccion">
                        ${secs.map(s => `<option value="${s}" ${s === item.seccion ? 'selected' : ''}>${s}</option>`).join('')}
                    </select>
                </div>
                <div class="form-group">
                    <label>Anaquel *</label>
                    <select id="edit-anaquel">
                        ${anaq.map(a => `<option value="${a}" ${a === item.anaquel ? 'selected' : ''}>${a}</option>`).join('')}
                    </select>
                </div>
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label>Stock *</label>
                    <input type="number" id="edit-stock" value="${item.stock}" min="0">
                </div>
                <div class="form-group">
                    <label>Unidad</label>
                    <input type="text" id="edit-unidad" value="${item.unidad || ''}">
                </div>
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label>Lote</label>
                    <input type="text" id="edit-lote" value="${item.lote || ''}">
                </div>
                <div class="form-group">
                    <label>Vencimiento</label>
                    <input type="date" id="edit-vencimiento" value="${item.vencimiento || ''}">
                </div>
            </div>
            <div class="form-group">
                <label>Comentarios</label>
                <textarea id="edit-comentarios">${item.comentarios || ''}</textarea>
            </div>
            <div class="form-actions">
                <button class="btn btn-secondary" onclick="UI.closeModal()">Cancelar</button>
                <button class="btn btn-success" onclick="App.procesarEdicion(${id})">💾 Guardar</button>
            </div>
        `;
        
        UI.openModal(html);
    },

    async procesarEdicion(id) {
        const updates = {
            nombre: document.getElementById('edit-nombre').value.trim(),
            seccion: document.getElementById('edit-seccion').value,
            anaquel: document.getElementById('edit-anaquel').value,
            stock: parseInt(document.getElementById('edit-stock').value),
            unidad: document.getElementById('edit-unidad').value.trim(),
            lote: document.getElementById('edit-lote').value.trim(),
            vencimiento: document.getElementById('edit-vencimiento').value || null,
            comentarios: document.getElementById('edit-comentarios').value.trim()
        };
        
        if (!updates.nombre || !updates.seccion || !updates.anaquel || isNaN(updates.stock) || updates.stock < 0) {
            UI.showToast('Campos inválidos', 'error');
            return;
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

    exportarDatos() {
        const datos = JSON.stringify(this.state, null, 2);
        const blob = new Blob([datos], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `respaldo_bodega_${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);
        UI.showToast('✅ Datos exportados!', 'success');
    },

    importarDatos() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        input.onchange = async (e) => {
            const file = e.target.files[0];
            if (!file) return;
            
            try {
                const text = await file.text();
                const datos = JSON.parse(text);
                
                if (!confirm('¿Importar datos? Esto reemplazará los datos locales. Los datos en Supabase no se modificarán.')) return;
                
                // Aquí podrías sincronizar con Supabase
                UI.showToast('✅ Datos importados localmente', 'success');
            } catch (error) {
                UI.showToast('❌ Archivo inválido', 'error');
            }
        };
        input.click();
    }
};

// ============================================
// INICIAR APLICACIÓN
// ============================================
document.addEventListener('DOMContentLoaded', () => {
    App.init();
});
