const App = {
    state: {
        inventario: [],
        secciones: [],
        unidades: [],
        movimientos: [],
        config: { porcentaje_critico: 20, dias_vencimiento: 30 }
    },

    async init() {
        try {
            UI.setConnectionStatus('warning', 'Conectando...');
            if (typeof supabaseClient === 'undefined') throw new Error('Cliente de Supabase no inicializado');
            UI.setupMobileMenu();
            await this.loadAllData();
            this.setupEventListeners();
            this.showDashboard();
            UI.setConnectionStatus('success', 'Conectado');
        } catch (error) {
            console.error('Error al inicializar:', error);
            UI.setConnectionStatus('error', 'Error');
            UI.showToast('Error al conectar: ' + error.message, 'error');
        }
    },

    async loadAllData() {
        const [inventario, secciones, unidades, config, movimientos] = await Promise.all([
            DB.getInventario(), DB.getSecciones(), DB.getUnidadesMedida(), DB.getConfig(), DB.getTodosMovimientos()
        ]);
        this.state.inventario = inventario || [];
        this.state.secciones = secciones || [];
        this.state.unidades = unidades || [];
        this.state.config = config || { porcentaje_critico: 20, dias_vencimiento: 30 };
        this.state.movimientos = movimientos || [];
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

        const btnAdminUsuarios = document.getElementById('btn-admin-usuarios');
        if (btnAdminUsuarios) btnAdminUsuarios.addEventListener('click', (e) => { e.preventDefault(); this.showGestionUsuariosModal(); });

        document.getElementById('header-actions').addEventListener('click', (e) => {
            if (e.target.closest('#header-btn-ingreso')) this.showIngresoModal();
            else if (e.target.closest('#header-btn-salida')) this.showSalidaModal();
            else if (e.target.closest('#header-btn-buscar')) this.showBusquedaAnaquelModal();
        });

        const filtroTipo = document.getElementById('filtro-tipo-movimiento');
        if (filtroTipo) filtroTipo.addEventListener('change', () => this.renderMovimientos());
        
        const filtroUsuario = document.getElementById('filtro-usuario-movimiento');
        if (filtroUsuario) filtroUsuario.addEventListener('change', () => this.renderMovimientos());
        
        const busquedaMov = document.getElementById('busqueda-movimientos');
        if (busquedaMov) busquedaMov.addEventListener('input', () => this.renderMovimientos());

        document.addEventListener('keydown', (e) => { if (e.key === 'Escape') UI.closeModal(); });
    },

    // ============================================
    // DASHBOARD
    // ============================================
    async showDashboard() { UI.setActiveSection('dashboard'); await this.loadAllData(); this.renderDashboard(); },

    renderDashboard() {
        const { inventario, secciones, config } = this.state;
        document.getElementById('total-insumos').textContent = inventario.length;
        document.getElementById('total-badge').textContent = inventario.length;
        document.getElementById('stock-total').textContent = inventario.reduce((s, i) => s + (i.stock || 0), 0);
        document.getElementById('secciones-activas').textContent = [...new Set(secciones.map(s => s.seccion))].length;
        const criticos = inventario.filter(item => this.esStockCritico(item));
        document.getElementById('stock-critico').textContent = criticos.length;
        const hoy = new Date(); const limite = new Date(hoy); limite.setDate(limite.getDate() + (config.dias_vencimiento || 30));
        document.getElementById('vencimientos-proximos').textContent = inventario.filter(item => { if (!item.vencimiento) return false; const v = new Date(item.vencimiento + 'T00:00:00'); return v >= hoy && v <= limite; }).length;
        this.renderAlertas(criticos);
    },

    esStockCritico(item) {
        if (!item.stock || item.stock === 0) return true;
        const movimientosInsumo = this.state.movimientos.filter(m => m.insumo && item.nombre && m.insumo.toLowerCase() === item.nombre.toLowerCase() && m.anaquel === item.anaquel);
        let stockMax = item.stock;
        if (movimientosInsumo.length > 0) { const maximos = movimientosInsumo.map(m => m.stock_nuevo || 0); stockMax = Math.max(...maximos, item.stock); }
        if (movimientosInsumo.length === 0 && item.stock <= 5) return true;
        if (stockMax === 0) return false;
        return (item.stock / stockMax) * 100 <= this.state.config.porcentaje_critico;
    },

    renderAlertas(criticos) {
        const container = document.getElementById('alertas-stock');
        const { inventario, config } = this.state;
        const hoy = new Date(); const limite = new Date(hoy); limite.setDate(limite.getDate() + (config.dias_vencimiento || 30));
        const porVencer = inventario.filter(item => { if (!item.vencimiento) return false; const venc = new Date(item.vencimiento + 'T00:00:00'); return venc >= hoy && venc <= limite; });
        const criticosIds = new Set(criticos.map(i => i.id));
        const porVencerFiltrados = porVencer.filter(i => !criticosIds.has(i.id));
        const totalAlertas = criticos.length + porVencerFiltrados.length;
        if (totalAlertas === 0) { container.innerHTML = `<div class="empty-state"><div class="icon">${UI.icons.check}</div><p>No hay alertas.</p></div>`; return; }
        let html = '<div class="table-container"><table><thead><tr><th>Insumo</th><th class="text-center">Stock</th><th class="text-center">Anaquel</th><th class="text-center">Vencimiento</th><th class="text-center">Tipo Alerta</th></tr></thead><tbody>';
        criticos.forEach(item => {
            const venc = item.vencimiento ? new Date(item.vencimiento + 'T00:00:00') : null;
            const vencido = venc && venc < hoy; const vencePronto = venc && !vencido && venc <= limite;
            let tipoAlerta = '';
            if (vencido) tipoAlerta = '<span class="badge badge-danger">VENCIDO</span> <span class="badge badge-danger">STOCK CRÍTICO</span>';
            else if (vencePronto) tipoAlerta = '<span class="badge badge-danger">STOCK CRÍTICO</span> <span class="badge badge-warning">POR VENCER</span>';
            else tipoAlerta = '<span class="badge badge-danger">STOCK CRÍTICO</span>';
            html += `<tr class="stock-critical"><td><strong>${item.nombre}</strong></td><td class="text-center">${item.stock} ${item.unidad || ''}</td><td class="text-center">${item.anaquel}</td><td class="text-center">${item.vencimiento || 'N/A'}</td><td class="text-center">${tipoAlerta}</td></tr>`;
        });
        porVencerFiltrados.forEach(item => {
            const diasRestantes = Math.ceil((new Date(item.vencimiento + 'T00:00:00') - hoy) / (1000 * 60 * 60 * 24));
            html += `<tr class="stock-warning"><td><strong>${item.nombre}</strong></td><td class="text-center">${item.stock} ${item.unidad || ''}</td><td class="text-center">${item.anaquel}</td><td class="text-center">${item.vencimiento || 'N/A'} <small style="color:#856404;">(${diasRestantes} días)</small></td><td class="text-center"><span class="badge badge-warning">POR VENCER</span></td></tr>`;
        });
        html += '</tbody></table></div>'; container.innerHTML = html;
    },

    // ============================================
    // INVENTARIO
    // ============================================
    async showInventario() { UI.setActiveSection('inventario'); await this.loadAllData(); this.renderInventario(); },

    renderInventario() {
        const mostrarStockCritico = document.getElementById('filtro-stock-critico')?.checked ?? false;
        const mostrarPorVencer = document.getElementById('filtro-por-vencer')?.checked ?? false;
        const mostrarVencidos = document.getElementById('filtro-vencidos')?.checked ?? false;
        const ningunFiltroActivo = !mostrarStockCritico && !mostrarPorVencer && !mostrarVencidos;
        const hoy = new Date(); const limite = new Date(hoy); limite.setDate(limite.getDate() + (this.state.config.dias_vencimiento || 30));
        let items = [...this.state.inventario]; let filtrados = [];
        if (ningunFiltroActivo) { filtrados = items; }
        else {
            items.forEach(item => {
                const esCritico = this.esStockCritico(item);
                const venc = item.vencimiento ? new Date(item.vencimiento + 'T00:00:00') : null;
                const vencido = venc && venc < hoy; const vencePronto = venc && !vencido && venc <= limite;
                let incluir = false;
                if (mostrarStockCritico && esCritico && !vencido) incluir = true;
                if (mostrarPorVencer && vencePronto && !esCritico) incluir = true;
                if (mostrarVencidos && vencido) incluir = true;
                if (esCritico && vencido) { if (mostrarStockCritico || mostrarVencidos) incluir = true; }
                if (incluir) filtrados.push(item);
            });
        }
        document.getElementById('contador-inventario').textContent = filtrados.length;
        const container = document.getElementById('tabla-inventario');
        if (filtrados.length === 0) { container.innerHTML = `<div class="empty-state"><div class="icon">${UI.icons.box}</div><p>Sin insumos que coincidan con los filtros.</p></div>`; return; }
        let html = '<table><thead><tr><th>Nombre</th><th class="text-center">Anaquel</th><th class="text-center">Stock</th><th class="text-center">Und.</th><th class="text-center">Lote</th><th class="text-center">Venc.</th><th class="text-center">Acc.</th></tr></thead><tbody>';
        filtrados.forEach(item => {
            const critico = this.esStockCritico(item);
            const venc = item.vencimiento ? new Date(item.vencimiento + 'T00:00:00') : null;
            const vencido = venc && venc < hoy; const vencePronto = venc && !vencido && venc <= limite;
            let clase = ''; if (vencido) clase = 'stock-critical'; else if (critico) clase = 'stock-critical'; else if (vencePronto) clase = 'stock-warning';
            html += `<tr class="${clase}"><td><strong>${item.nombre}</strong></td><td class="text-center">${item.anaquel}</td><td class="text-center">${item.stock}</td><td class="text-center">${item.unidad || ''}</td><td class="text-center">${item.lote || '-'}</td><td class="text-center">${item.vencimiento || '-'}${vencido ? ' <span class="badge badge-danger">VENC</span>' : ''}${vencePronto && !critico ? ' <span class="badge badge-warning">PRONT</span>' : ''}</td><td class="text-center"><button class="btn btn-warning btn-sm" onclick="App.editarInsumo(${item.id})" title="Editar">${UI.icons.edit}</button><button class="btn btn-danger btn-sm" onclick="App.eliminarInsumo(${item.id})" title="Eliminar">${UI.icons.trash}</button></td></tr>`;
        });
        html += '</tbody></table>'; container.innerHTML = html;
    },

    // ============================================
    // MOVIMIENTOS (CON FILTRO POR USUARIO)
    // ============================================
    async showMovimientos() { 
        UI.setActiveSection('movimientos'); 
        UI.showLoading('tabla-movimientos'); 
        try { 
            await this.loadAllData(); 
            this.cargarFiltroUsuarios(); 
            this.renderMovimientos(); 
        } catch (e) { 
            document.getElementById('tabla-movimientos').innerHTML = '<div class="empty-state"><p>Error al cargar.</p></div>'; 
        } 
    },

    cargarFiltroUsuarios() {
        const select = document.getElementById('filtro-usuario-movimiento');
        if (!select) return;
        const usuarios = [...new Set(this.state.movimientos.map(m => m.usuario).filter(Boolean))].sort();
        select.innerHTML = '<option value="TODOS">Todos los usuarios</option>';
        usuarios.forEach(u => { select.innerHTML += `<option value="${u}">${u}</option>`; });
    },

    renderMovimientos() {
        const filtroTexto = document.getElementById('busqueda-movimientos')?.value?.trim().toLowerCase() || '';
        const filtroTipo = document.getElementById('filtro-tipo-movimiento')?.value || 'TODOS';
        const filtroUsuario = document.getElementById('filtro-usuario-movimiento')?.value || 'TODOS';
        let movs = [...this.state.movimientos];
        if (filtroTipo !== 'TODOS') movs = movs.filter(m => m.tipo === filtroTipo);
        if (filtroUsuario !== 'TODOS') movs = movs.filter(m => (m.usuario || 'sistema') === filtroUsuario);
        if (filtroTexto) movs = movs.filter(m => (m.insumo && m.insumo.toLowerCase().includes(filtroTexto)) || (m.anaquel && m.anaquel.toLowerCase().includes(filtroTexto)) || (m.comentarios && m.comentarios.toLowerCase().includes(filtroTexto)) || (m.tipo && m.tipo.toLowerCase().includes(filtroTexto)));
        const container = document.getElementById('tabla-movimientos');
        if (movs.length === 0) { container.innerHTML = `<div class="empty-state"><div class="icon">${UI.icons.list}</div><p>Sin movimientos que coincidan con el filtro.</p></div>`; return; }
        let html = '<div class="table-container"><table><thead><tr><th>Usuario / Fecha</th><th class="text-center">Tipo</th><th>Info.</th><th class="text-center">Cant.</th><th class="text-center">Stock Ant.</th><th class="text-center">Stock Nuevo</th><th class="text-center">Anaquel</th><th>Comentarios</th></tr></thead><tbody>';
        movs.forEach(mov => {
            const fecha = new Date(mov.fecha); const color = this.getColorTipo(mov.tipo); const tipoFormateado = this.formatearTipo(mov.tipo);
            const usuario = mov.usuario || 'sistema';
            html += `<tr><td>${usuario} - ${fecha.toLocaleString('es-CL')}</td><td class="text-center"><span class="badge" style="background:${color};">${tipoFormateado}</span></td><td>${mov.insumo || '-'}</td><td class="text-center">${mov.cantidad || '-'}</td><td class="text-center">${mov.stock_anterior !== null && mov.stock_anterior !== undefined ? mov.stock_anterior : '-'}</td><td class="text-center">${mov.stock_nuevo !== null && mov.stock_nuevo !== undefined ? mov.stock_nuevo : '-'}</td><td class="text-center">${mov.anaquel || '-'}</td><td style="max-width:200px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" title="${mov.comentarios || ''}">${mov.comentarios || ''}</td></tr>`;
        });
        html += '</tbody></table></div>'; container.innerHTML = html;
    },

    getColorTipo(tipo) { const c = {'INGRESO':'#27ae60','SALIDA':'#c0392b','EDICION':'#2980b9','ELIMINACION':'#e74c3c','CREACION_SECCION':'#8e44ad','ELIMINACION_SECCION':'#c0392b','CREACION_UNIDAD':'#16a085','ELIMINACION_UNIDAD':'#e67e22'}; return c[tipo] || '#6c757d'; },
    formatearTipo(tipo) { const t = {'INGRESO':'Ingreso','SALIDA':'Salida','EDICION':'Edición','ELIMINACION':'Eliminación','CREACION_SECCION':'Creación Sección','ELIMINACION_SECCION':'Eliminación Sección','CREACION_UNIDAD':'Creación Unidad','ELIMINACION_UNIDAD':'Eliminación Unidad'}; return t[tipo] || tipo; },

    // ============================================
    // MODALES
    // ============================================
    showIngresoModal() {
        const anaqueles = this.state.secciones.map(s => s.seccion + s.anaquel).sort();
        const unidades = this.state.unidades.map(u => u.nombre).sort();
        const html = `<h2>Nuevo Ingreso</h2><div class="form-group" style="position:relative;"><label>Nombre del Insumo *</label><input type="text" id="ing-nombre" placeholder="Escriba el nombre..." autofocus autocomplete="off" onkeyup="App.buscarCoincidencias('ing')" onfocus="App.buscarCoincidencias('ing')"><div id="sugerencias-ing" style="position:absolute; top:100%; left:0; right:0; background:white; border:1px solid #ddd; border-radius:0 0 5px 5px; max-height:200px; overflow-y:auto; z-index:100; display:none; box-shadow:0 4px 8px rgba(0,0,0,0.1);"></div></div><div class="form-group"><label>Anaquel *</label><select id="ing-anaquel"><option value="">Seleccione anaquel...</option>${anaqueles.map(a => `<option value="${a}">${a}</option>`).join('')}</select>${anaqueles.length === 0 ? '<small style="color:#c0392b;">No hay anaqueles configurados.</small>' : ''}</div><div class="form-row"><div class="form-group"><label>Cantidad *</label><input type="number" id="ing-cantidad" value="1" min="1"></div><div class="form-group"><label>Unidad de Medida</label><select id="ing-unidad"><option value="">Seleccione...</option>${unidades.map(u => `<option value="${u}">${u}</option>`).join('')}</select></div></div><div class="form-row"><div class="form-group"><label>N° Lote</label><input type="text" id="ing-lote" placeholder="LOTE-2024-001"></div><div class="form-group"><label>Fecha Vencimiento</label><input type="date" id="ing-vencimiento"></div></div><div class="form-group"><label>Comentarios</label><textarea id="ing-comentarios" placeholder="Información adicional..."></textarea></div><div class="form-actions"><button class="btn btn-secondary" onclick="UI.closeModal()">Cancelar</button><button class="btn btn-success" onclick="App.procesarIngreso()">${UI.icons.plus} Registrar Ingreso</button></div>`;
        UI.openModal(html);
        setTimeout(() => { document.addEventListener('click', function cerrar(e) { const input = document.getElementById('ing-nombre'); const sug = document.getElementById('sugerencias-ing'); if (input && sug && e.target !== input && !sug.contains(e.target)) sug.style.display = 'none'; }); }, 100);
    },

    showSalidaModal() {
        const anaqueles = this.state.secciones.map(s => s.seccion + s.anaquel).sort();
        const html = `<h2>Nueva Salida</h2><div class="form-group"><label>Filtrar por Anaquel</label><select id="sal-anaquel-filtro" onchange="App.filtrarPorAnaquelSalida()"><option value="">Todos los anaqueles</option>${anaqueles.map(a => `<option value="${a}">${a}</option>`).join('')}</select></div><div class="form-group" style="position:relative;"><label>Buscar por Nombre</label><input type="text" id="sal-busqueda" placeholder="Escriba el nombre del insumo..." autocomplete="off" onkeyup="App.buscarCoincidenciasSalida()" onfocus="App.buscarCoincidenciasSalida()"><div id="sugerencias-sal" style="position:absolute; top:100%; left:0; right:0; background:white; border:1px solid #ddd; border-radius:0 0 5px 5px; max-height:200px; overflow-y:auto; z-index:100; display:none; box-shadow:0 4px 8px rgba(0,0,0,0.1);"></div></div><div id="resultados-busqueda"><p style="color:#666; padding:15px;">Seleccione un anaquel o escriba un nombre para buscar insumos.</p></div><div class="form-actions"><button class="btn btn-secondary" onclick="UI.closeModal()">Cancelar</button></div>`;
        UI.openModal(html);
        setTimeout(() => { document.addEventListener('click', function cerrar(e) { const input = document.getElementById('sal-busqueda'); const sug = document.getElementById('sugerencias-sal'); if (input && sug && e.target !== input && !sug.contains(e.target)) sug.style.display = 'none'; }); }, 100);
    },

    async buscarCoincidencias(tipo) {
        const input = document.getElementById(tipo === 'ing' ? 'ing-nombre' : 'sal-busqueda');
        const sugerencias = document.getElementById(tipo === 'ing' ? 'sugerencias-ing' : 'sugerencias-sal');
        if (!input || !sugerencias) return;
        const busqueda = input.value.trim(); if (busqueda.length < 1) { sugerencias.style.display = 'none'; return; }
        try {
            const resultados = await DB.buscarInsumosNombre(busqueda);
            if (resultados.length === 0) { sugerencias.style.display = 'none'; return; }
            let html = ''; resultados.forEach(item => { const ne = item.nombre.replace(/'/g, "\\'"); const ue = (item.unidad || '').replace(/'/g, "\\'"); html += `<div onclick="App.seleccionarSugerencia('${tipo}', '${ne}', '${ue}')" style="padding:8px 12px; cursor:pointer; border-bottom:1px solid #eee; font-size:13px;" onmouseover="this.style.background='#eef2f7'" onmouseout="this.style.background='white'"><strong>${item.nombre}</strong>${item.unidad ? `<span style="color:#888; font-size:11px;">(${item.unidad})</span>` : ''}</div>`; });
            sugerencias.innerHTML = html; sugerencias.style.display = 'block';
        } catch (error) { console.error('Error al buscar coincidencias:', error); }
    },

    buscarCoincidenciasSalida() {
        const anaquelFiltro = document.getElementById('sal-anaquel-filtro').value;
        const input = document.getElementById('sal-busqueda'); const sugerencias = document.getElementById('sugerencias-sal');
        if (!input || !sugerencias) return;
        const busqueda = input.value.trim().toLowerCase(); if (busqueda.length < 1) { sugerencias.style.display = 'none'; this.buscarInsumoSalida(); return; }
        let resultados = this.state.inventario.filter(item => item.stock > 0 && item.nombre.toLowerCase().includes(busqueda));
        if (anaquelFiltro) resultados = resultados.filter(item => item.anaquel === anaquelFiltro);
        const unicos = []; const nombres = new Set(); resultados.forEach(item => { if (!nombres.has(item.nombre.toLowerCase())) { nombres.add(item.nombre.toLowerCase()); unicos.push(item); } });
        if (unicos.length === 0) { sugerencias.style.display = 'none'; return; }
        let html = ''; unicos.slice(0, 10).forEach(item => { html += `<div onclick="App.seleccionarSugerenciaSalida('${item.nombre.replace(/'/g, "\\'")}')" style="padding:8px 12px; cursor:pointer; border-bottom:1px solid #eee; font-size:13px;" onmouseover="this.style.background='#eef2f7'" onmouseout="this.style.background='white'"><strong>${item.nombre}</strong><span style="color:#888; font-size:11px;">Stock: ${item.stock} | ${item.anaquel}</span></div>`; });
        sugerencias.innerHTML = html; sugerencias.style.display = 'block';
    },

    seleccionarSugerencia(tipo, nombre, unidad) {
        if (tipo === 'ing') { document.getElementById('ing-nombre').value = nombre; if (unidad) { const s = document.getElementById('ing-unidad'); for (let i = 0; i < s.options.length; i++) { if (s.options[i].value === unidad) { s.selectedIndex = i; break; } } } document.getElementById('sugerencias-ing').style.display = 'none'; }
        else { document.getElementById('sal-busqueda').value = nombre; document.getElementById('sugerencias-sal').style.display = 'none'; this.buscarInsumoSalida(); }
    },
    seleccionarSugerenciaSalida(nombre) { document.getElementById('sal-busqueda').value = nombre; document.getElementById('sugerencias-sal').style.display = 'none'; this.buscarInsumoSalida(); },

    async procesarIngreso() {
        const nombre = document.getElementById('ing-nombre').value.trim(); const anaquel = document.getElementById('ing-anaquel').value;
        const cantidad = parseInt(document.getElementById('ing-cantidad').value); const unidad = document.getElementById('ing-unidad').value;
        const lote = document.getElementById('ing-lote').value.trim(); const vencimiento = document.getElementById('ing-vencimiento').value;
        const comentarios = document.getElementById('ing-comentarios').value.trim();
        if (!nombre || !anaquel || !cantidad || cantidad <= 0) { UI.showToast('Complete los campos obligatorios (*)', 'error'); return; }
        try { await DB.procesarIngreso(nombre, anaquel.charAt(0), anaquel, cantidad, unidad, lote, vencimiento, comentarios); UI.closeModal(); UI.showToast('Ingreso registrado en ' + anaquel, 'success'); await this.loadAllData(); this.renderDashboard(); }
        catch (error) { UI.showToast('Error: ' + error.message, 'error'); }
    },

    filtrarPorAnaquelSalida() { const a = document.getElementById('sal-anaquel-filtro').value; if (a) document.getElementById('sal-busqueda').value = ''; document.getElementById('sugerencias-sal').style.display = 'none'; this.buscarInsumoSalida(); },

    buscarInsumoSalida() {
        const af = document.getElementById('sal-anaquel-filtro').value; const b = document.getElementById('sal-busqueda').value.trim().toLowerCase();
        let r = this.state.inventario.filter(item => item.stock > 0); if (af) r = r.filter(item => item.anaquel === af); if (b) r = r.filter(item => item.nombre.toLowerCase().includes(b));
        const c = document.getElementById('resultados-busqueda'); if (r.length === 0) { c.innerHTML = '<p style="padding:15px;color:#666;">No se encontraron insumos con stock disponible.</p>'; return; }
        let h = '<div style="max-height:400px; overflow-y:auto;">'; r.forEach(item => { h += `<div style="border:1px solid #ddd; padding:12px; margin:5px 0; border-radius:5px; display:flex; justify-content:space-between; align-items:center;"><div><strong>${item.nombre}</strong><br><small>Stock: ${item.stock} ${item.unidad||''} | Anaquel: <span class="badge badge-info">${item.anaquel}</span></small>${item.lote?`<br><small>Lote: ${item.lote}</small>`:''}</div><button class="btn btn-danger btn-sm" onclick="App.prepararSalida(${item.id})">Retirar</button></div>`; }); h += '</div>'; c.innerHTML = h;
    },

    prepararSalida(id) {
        const item = this.state.inventario.find(i => i.id === id); if (!item) return;
        UI.openModal(`<h2>Retirar Insumo</h2><div style="background:#f8f9fa; padding:15px; border-radius:8px; margin-bottom:15px;"><p><strong>Insumo:</strong> ${item.nombre}</p><p><strong>Anaquel:</strong> <span class="badge badge-info">${item.anaquel}</span></p><p><strong>Stock Actual:</strong> ${item.stock} ${item.unidad||'unidades'}</p>${item.lote?`<p><strong>Lote:</strong> ${item.lote}</p>`:''}${item.vencimiento?`<p><strong>Vencimiento:</strong> ${item.vencimiento}</p>`:''}</div><div class="form-group"><label>Cantidad a retirar *</label><input type="number" id="sal-cantidad" value="1" min="1" max="${item.stock}" autofocus></div><div class="form-group"><label>Motivo / Comentarios</label><textarea id="sal-comentarios"></textarea></div><div class="form-actions"><button class="btn btn-secondary" onclick="App.showSalidaModal()">Volver</button><button class="btn btn-danger" onclick="App.procesarSalida(${id})">${UI.icons.minus} Confirmar Retiro</button></div>`);
    },

    async procesarSalida(id) {
        const cantidad = parseInt(document.getElementById('sal-cantidad').value); const comentarios = document.getElementById('sal-comentarios').value.trim();
        if (!cantidad || cantidad <= 0) { UI.showToast('Cantidad inválida', 'error'); return; }
        try { const r = await DB.procesarSalida(id, cantidad, comentarios); UI.closeModal(); UI.showToast('Salida registrada' + (r.stockNuevo <= 5 ? ' - Stock bajo' : ''), r.stockNuevo <= 5 ? 'warning' : 'success'); await this.loadAllData(); this.renderDashboard(); }
        catch (error) { UI.showToast('Error: ' + error.message, 'error'); }
    },

    showBusquedaAnaquelModal() { UI.openModal(`<h2>Buscar por Anaquel</h2><div class="form-group"><label>Seleccione Anaquel</label><select id="bus-anaquel" onchange="App.buscarAnaquel()"><option value="">Seleccione...</option>${this.state.secciones.map(s => s.seccion + s.anaquel).sort().map(a => `<option value="${a}">${a}</option>`).join('')}</select></div><div id="resultado-anaquel"></div><div class="form-actions"><button class="btn btn-secondary" onclick="UI.closeModal()">Cerrar</button></div>`); },

    buscarAnaquel() {
        const anaquel = document.getElementById('bus-anaquel').value; if (!anaquel) return;
        const items = this.state.inventario.filter(i => i.anaquel === anaquel); const c = document.getElementById('resultado-anaquel');
        let h = `<h3>Contenido de Anaquel: <span class="badge badge-info">${anaquel}</span></h3>`;
        if (items.length === 0) h += '<p style="padding:15px;">Anaquel vacío.</p>';
        else { h += '<div class="table-container"><table><thead><tr><th>Insumo</th><th class="text-center">Stock</th><th class="text-center">Und.</th><th class="text-center">Lote</th><th class="text-center">Venc.</th><th class="text-center">Estado</th></tr></thead><tbody>';
            items.forEach(item => { const v = item.vencimiento ? new Date(item.vencimiento) : null; const hoy = new Date(); const vencido = v && v < hoy; const crit = this.esStockCritico(item); h += `<tr class="${vencido||crit?'stock-critical':''}"><td><strong>${item.nombre}</strong></td><td class="text-center">${item.stock}</td><td class="text-center">${item.unidad||''}</td><td class="text-center">${item.lote||'-'}</td><td class="text-center">${item.vencimiento||'-'}</td><td class="text-center">${vencido?'<span class="badge badge-danger">VENC</span> ':''}${crit?'<span class="badge badge-danger">CRIT</span>':''}${!vencido&&!crit?'<span class="badge badge-success">OK</span>':''}</td></tr>`; });
            h += '</tbody></table></div>'; } c.innerHTML = h;
    },

    showGestionSeccionesModal() { let h = '<h2>Configuración</h2>'; h += `<div style="display:flex; gap:0; margin-bottom:20px; border-bottom:2px solid #e0e0e0;"><button class="btn btn-light" onclick="App.mostrarTabConfig('secciones')" id="tab-secciones" style="border-radius:5px 5px 0 0; border-bottom:none; margin-bottom:-2px; border:2px solid #e0e0e0; border-bottom:2px solid var(--primary); background:white; font-weight:bold;">${UI.icons.settings} Secciones y Anaqueles</button><button class="btn btn-light" onclick="App.mostrarTabConfig('unidades')" id="tab-unidades" style="border-radius:5px 5px 0 0; border-bottom:none; margin-bottom:-2px; border:2px solid transparent; background:transparent;">📏 Unidades de Medida</button></div><div id="tab-contenido"></div>`; UI.openModal(h); this.mostrarTabConfig('secciones'); },

    mostrarTabConfig(tab) {
        document.getElementById('tab-secciones').style.borderBottom = tab === 'secciones' ? '2px solid var(--primary)' : '2px solid transparent';
        document.getElementById('tab-secciones').style.background = tab === 'secciones' ? 'white' : 'transparent';
        document.getElementById('tab-secciones').style.fontWeight = tab === 'secciones' ? 'bold' : 'normal';
        document.getElementById('tab-secciones').style.borderColor = tab === 'secciones' ? '#e0e0e0' : 'transparent';
        document.getElementById('tab-unidades').style.borderBottom = tab === 'unidades' ? '2px solid var(--primary)' : '2px solid transparent';
        document.getElementById('tab-unidades').style.background = tab === 'unidades' ? 'white' : 'transparent';
        document.getElementById('tab-unidades').style.fontWeight = tab === 'unidades' ? 'bold' : 'normal';
        document.getElementById('tab-unidades').style.borderColor = tab === 'unidades' ? '#e0e0e0' : 'transparent';
        if (tab === 'secciones') this.mostrarContenidoSecciones(); else this.mostrarContenidoUnidades();
    },

    mostrarContenidoSecciones() {
        let html = ''; const agrupadas = {}; this.state.secciones.forEach(s => { if (!agrupadas[s.seccion]) agrupadas[s.seccion] = { descripcion: s.descripcion || 'Sin descripción', anaqueles: [] }; agrupadas[s.seccion].anaqueles.push(s.anaquel); });
        const keys = Object.keys(agrupadas).sort();
        if (keys.length === 0) html += `<div class="empty-state"><div class="icon">${UI.icons.settings}</div><p>No hay secciones configuradas.</p></div>`;
        else { html += '<div style="display:grid; gap:15px; margin-bottom:20px;">'; keys.forEach(sec => { const info = agrupadas[sec]; const ao = info.anaqueles.sort((a,b) => a.localeCompare(b, undefined, {numeric:true})); html += `<div style="border:2px solid #e0e0e0; border-radius:10px; padding:15px; background:white;"><div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;"><div><span style="font-size:20px; font-weight:bold; color:var(--primary);">Sección ${sec}</span><span style="margin-left:10px; color:#555; font-size:14px;">— ${info.descripcion}</span></div><button class="btn btn-danger btn-sm" onclick="App.eliminarSeccionCompleta('${sec}')">${UI.icons.trash} Eliminar</button></div><div style="display:flex; flex-wrap:wrap; gap:8px; margin-bottom:12px;">${ao.map(a => `<span style="background:var(--primary); color:white; padding:6px 12px; border-radius:20px; font-size:13px; display:inline-flex; align-items:center; gap:8px;">${sec}${a}<button onclick="event.stopPropagation(); App.eliminarAnaquelIndividual('${sec}', '${a}')" style="background:rgba(255,255,255,0.3); border:none; color:white; cursor:pointer; font-size:14px; padding:2px 6px; border-radius:50%; line-height:1;">×</button></span>`).join('')}</div><button class="btn btn-info btn-sm" onclick="App.mostrarAgregarAnaquel('${sec}')">${UI.icons.plus} Agregar Anaqueles</button></div>`; }); html += '</div>'; }
        html += `<h3 style="margin-top:25px; padding-top:20px; border-top:2px solid #eee;">Crear Nueva Sección</h3><div class="form-row"><div class="form-group"><label>Letra *</label><input type="text" id="nueva-seccion-letra" maxlength="1" placeholder="A" style="text-transform:uppercase;"></div><div class="form-group"><label>Descripción *</label><input type="text" id="nueva-seccion-descripcion" placeholder="Ej: Material Quirúrgico"></div><div class="form-group"><label>Cantidad de Anaqueles</label><input type="number" id="nueva-seccion-cantidad" value="1" min="1" max="50"></div></div><button class="btn btn-success" onclick="App.crearNuevaSeccion()">${UI.icons.plus} Crear Sección</button>`;
        document.getElementById('tab-contenido').innerHTML = html;
    },

    mostrarContenidoUnidades() {
        const unidades = this.state.unidades.sort((a,b) => a.nombre.localeCompare(b.nombre));
        let html = '<p style="font-size:12px;color:#666;margin-bottom:15px;">Configure las unidades de medida disponibles para los insumos.</p>';
        if (unidades.length === 0) html += '<div class="empty-state"><div class="icon">📏</div><p>No hay unidades configuradas.</p></div>';
        else { html += '<div style="display:flex; flex-wrap:wrap; gap:8px; margin-bottom:20px;">'; unidades.forEach(u => { html += `<span style="background:var(--primary-light); color:white; padding:8px 14px; border-radius:20px; font-size:13px; display:inline-flex; align-items:center; gap:8px;">${u.nombre}<button onclick="App.eliminarUnidad(${u.id})" style="background:rgba(255,255,255,0.3); border:none; color:white; cursor:pointer; font-size:14px; padding:2px 6px; border-radius:50%; line-height:1;">×</button></span>`; }); html += '</div>'; }
        html += `<h3 style="margin-top:20px; padding-top:15px; border-top:2px solid #eee;">Agregar Unidad de Medida</h3><div class="form-row"><div class="form-group"><label>Nombre de la Unidad *</label><input type="text" id="nueva-unidad" placeholder="Ej: Caja, Blister, Frasco..."></div></div><button class="btn btn-success" onclick="App.agregarUnidad()">${UI.icons.plus} Agregar Unidad</button>`;
        document.getElementById('tab-contenido').innerHTML = html;
    },

    async agregarUnidad() { const n = document.getElementById('nueva-unidad').value.trim(); if (!n) { UI.showToast('Ingrese un nombre', 'error'); return; } try { await DB.addUnidadMedida(n); await DB.addMovimiento({ tipo: 'CREACION_UNIDAD', insumo: `Unidad: ${n}`, cantidad: 0, comentarios: `Unidad "${n}" creada` }); await this.loadAllData(); this.mostrarContenidoUnidades(); UI.showToast('Unidad "' + n + '" agregada', 'success'); } catch (e) { UI.showToast('Error: ' + e.message, 'error'); } },
    async eliminarUnidad(id) { const u = this.state.unidades.find(x => x.id === id); if (!u || !confirm('¿Eliminar "' + u.nombre + '"?')) return; try { await DB.addMovimiento({ tipo: 'ELIMINACION_UNIDAD', insumo: `Unidad: ${u.nombre}`, cantidad: 0, comentarios: `Unidad "${u.nombre}" eliminada` }); await DB.deleteUnidadMedida(id); await this.loadAllData(); this.mostrarContenidoUnidades(); UI.showToast('Unidad eliminada', 'success'); } catch (e) { UI.showToast('Error', 'error'); } },

    async crearNuevaSeccion() {
        const l = document.getElementById('nueva-seccion-letra').value.trim().toUpperCase();
        const d = document.getElementById('nueva-seccion-descripcion').value.trim();
        const c = parseInt(document.getElementById('nueva-seccion-cantidad').value) || 1;
        if (!l || !d) { UI.showToast('Complete los campos', 'error'); return; }
        if (!/^[A-Z]$/.test(l)) { UI.showToast('Letra inválida', 'error'); return; }
        if (c < 1 || c > 50) { UI.showToast('Cantidad entre 1 y 50', 'error'); return; }
        if (this.state.secciones.some(s => s.seccion === l)) { UI.showToast('Sección ' + l + ' ya existe', 'error'); return; }
        try { for (let i = 1; i <= c; i++) await DB.addSeccion(l, d, String(i)); await DB.addMovimiento({ tipo: 'CREACION_SECCION', insumo: `Sección ${l}`, cantidad: c, anaquel: `${l}1${c>1?' al '+l+c:''}`, comentarios: `Sección ${l} - ${d}. ${c} anaquel(es)` }); await this.loadAllData(); this.mostrarContenidoSecciones(); this.renderDashboard(); UI.showToast('Sección ' + l + ' creada', 'success'); } catch (e) { UI.showToast('Error: ' + e.message, 'error'); }
    },

    mostrarAgregarAnaquel(seccion) {
        const ex = this.state.secciones.filter(s => s.seccion === seccion).map(s => parseInt(s.anaquel)).filter(n => !isNaN(n));
        const max = ex.length > 0 ? Math.max(...ex) : 0; const sig = max + 1;
        const info = this.state.secciones.find(s => s.seccion === seccion);
        UI.openModal(`<h2>Agregar Anaqueles a Sección ${seccion}</h2><div style="background:#f8f9fa; padding:15px; border-radius:8px; margin-bottom:15px;"><p><strong>Sección:</strong> ${seccion}</p><p><strong>Descripción:</strong> ${info?info.descripcion:''}</p><p><strong>Actuales:</strong> ${ex.length>0?ex.sort((a,b)=>a-b).join(', '):'Ninguno'}</p><p><strong>Próximo:</strong> ${sig}</p></div><div class="form-group"><label>Cantidad *</label><input type="number" id="agregar-anaquel-cantidad" value="1" min="1" max="50" autofocus></div><div class="form-actions"><button class="btn btn-secondary" onclick="App.showGestionSeccionesModal()">Volver</button><button class="btn btn-success" onclick="App.agregarAnaquelASeccion('${seccion}', ${sig})">${UI.icons.plus} Agregar</button></div>`);
    },

    async agregarAnaquelASeccion(seccion, inicio) {
        const c = parseInt(document.getElementById('agregar-anaquel-cantidad').value) || 1;
        if (c < 1 || c > 50) { UI.showToast('Cantidad entre 1 y 50', 'error'); return; }
        for (let i = 0; i < c; i++) { if (this.state.secciones.find(s => s.seccion + s.anaquel === seccion + (inicio + i))) { UI.showToast('Anaquel ' + (seccion + (inicio + i)) + ' ya existe', 'error'); return; } }
        try { const info = this.state.secciones.find(s => s.seccion === seccion); for (let i = 0; i < c; i++) await DB.addSeccion(seccion, info?info.descripcion:'', String(inicio + i)); await DB.addMovimiento({ tipo: 'CREACION_SECCION', insumo: `Sección ${seccion}`, cantidad: c, anaquel: `${seccion}${inicio}${c>1?' al '+seccion+(inicio+c-1):''}`, comentarios: `${c} anaquel(es) agregado(s)` }); await this.loadAllData(); this.mostrarContenidoSecciones(); this.renderDashboard(); UI.showToast(c === 1 ? 'Anaquel agregado' : c + ' anaqueles agregados', 'success'); } catch (e) { UI.showToast('Error: ' + e.message, 'error'); }
    },

    async eliminarAnaquelIndividual(seccion, anaquel) { if (!confirm('¿Eliminar ' + (seccion + anaquel) + '?')) return; const item = this.state.secciones.find(s => s.seccion === seccion && s.anaquel === anaquel); if (!item) return; try { await DB.addMovimiento({ tipo: 'ELIMINACION_SECCION', insumo: `Anaquel ${seccion+anaquel}`, cantidad: 0, anaquel: seccion+anaquel, comentarios: `Eliminado de Sección ${seccion}` }); await DB.deleteSeccion(item.id); await this.loadAllData(); this.mostrarContenidoSecciones(); this.renderDashboard(); UI.showToast('Anaquel eliminado', 'success'); } catch (e) { UI.showToast('Error', 'error'); } },
    async eliminarSeccionCompleta(seccion) { if (!confirm('¿Eliminar TODA la sección ' + seccion + '?') || !confirm('¿SEGURO?')) return; const items = this.state.secciones.filter(s => s.seccion === seccion); try { await DB.addMovimiento({ tipo: 'ELIMINACION_SECCION', insumo: `Sección ${seccion}`, cantidad: items.length, anaquel: seccion, comentarios: `${items.length} anaquel(es) eliminados` }); for (const item of items) await DB.deleteSeccion(item.id); await this.loadAllData(); this.mostrarContenidoSecciones(); this.renderDashboard(); UI.showToast('Sección eliminada', 'success'); } catch (e) { UI.showToast('Error', 'error'); } },

    editarInsumo(id) {
        const item = this.state.inventario.find(i => i.id === id); if (!item) return;
        const anaqueles = this.state.secciones.map(s => s.seccion + s.anaquel).sort();
        const unidades = this.state.unidades.map(u => u.nombre).sort();
        UI.openModal(`<h2>Editar Insumo #${item.id}</h2><div class="form-group"><label>Nombre *</label><input type="text" id="edit-nombre" value="${item.nombre||''}"></div><div class="form-group"><label>Anaquel *</label><select id="edit-anaquel">${anaqueles.map(a => `<option value="${a}" ${a===item.anaquel?'selected':''}>${a}</option>`).join('')}</select></div><div class="form-row"><div class="form-group"><label>Stock (Actual: ${item.stock})</label><input type="number" id="edit-stock" value="${item.stock}" min="0"></div><div class="form-group"><label>Unidad</label><select id="edit-unidad"><option value="">Seleccione...</option>${unidades.map(u => `<option value="${u}" ${u===item.unidad?'selected':''}>${u}</option>`).join('')}</select></div></div><div class="form-row"><div class="form-group"><label>Lote</label><input type="text" id="edit-lote" value="${item.lote||''}"></div><div class="form-group"><label>Vencimiento</label><input type="date" id="edit-vencimiento" value="${item.vencimiento||''}"></div></div><div class="form-group"><label>Comentarios</label><textarea id="edit-comentarios">${item.comentarios||''}</textarea></div><div class="form-actions"><button class="btn btn-secondary" onclick="UI.closeModal()">Cancelar</button><button class="btn btn-success" onclick="App.procesarEdicion(${id})">${UI.icons.edit} Guardar</button></div>`);
    },

    async procesarEdicion(id) {
        const item = this.state.inventario.find(i => i.id === id); if (!item) return;
        const anaquel = document.getElementById('edit-anaquel').value; const nuevoStock = parseInt(document.getElementById('edit-stock').value);
        const updates = { nombre: document.getElementById('edit-nombre').value.trim(), seccion: anaquel.charAt(0), anaquel, stock: nuevoStock, unidad: document.getElementById('edit-unidad').value, lote: document.getElementById('edit-lote').value.trim(), vencimiento: document.getElementById('edit-vencimiento').value || null, comentarios: document.getElementById('edit-comentarios').value.trim() };
        if (!updates.nombre || !anaquel || isNaN(nuevoStock) || nuevoStock < 0) { UI.showToast('Complete los campos', 'error'); return; }
        const cambios = []; if (updates.nombre !== item.nombre) cambios.push(`Nombre: "${item.nombre}" → "${updates.nombre}"`); if (updates.anaquel !== item.anaquel) cambios.push(`Anaquel: ${item.anaquel} → ${updates.anaquel}`); if (nuevoStock !== item.stock) cambios.push(`Stock: ${item.stock} → ${nuevoStock}`); if (updates.unidad !== item.unidad) cambios.push(`Unidad: "${item.unidad||'N/A'}" → "${updates.unidad||'N/A'}"`); if (updates.lote !== item.lote) cambios.push(`Lote: "${item.lote||'N/A'}" → "${updates.lote||'N/A'}"`); if (updates.vencimiento !== item.vencimiento) cambios.push(`Venc.: "${item.vencimiento||'N/A'}" → "${updates.vencimiento||'N/A'}"`);
        try { await DB.updateInventarioItem(id, updates); await DB.addMovimiento({ tipo: 'EDICION', insumo: updates.nombre, cantidad: nuevoStock !== item.stock ? Math.abs(nuevoStock - item.stock) : 0, stock_anterior: item.stock, stock_nuevo: nuevoStock, anaquel, comentarios: cambios.length > 0 ? 'Cambios: ' + cambios.join(' | ') : 'Sin cambios' }); UI.closeModal(); UI.showToast('Insumo actualizado', 'success'); await this.loadAllData(); this.renderDashboard(); this.renderInventario(); } catch (e) { UI.showToast('Error: ' + e.message, 'error'); }
    },

    async eliminarInsumo(id) { const item = this.state.inventario.find(i => i.id === id); if (!item || !confirm(`¿Eliminar "${item.nombre}"?`)) return; try { await DB.addMovimiento({ tipo: 'ELIMINACION', insumo: item.nombre, cantidad: 0, stock_anterior: item.stock, stock_nuevo: 0, anaquel: item.anaquel, comentarios: `Stock final: ${item.stock} ${item.unidad||''}` }); await DB.deleteInventarioItem(id); UI.showToast('Insumo eliminado', 'success'); await this.loadAllData(); this.renderDashboard(); this.renderInventario(); } catch (e) { UI.showToast('Error', 'error'); } },

    // ============================================
    // GESTIÓN DE USUARIOS
    // ============================================
    async showGestionUsuariosModal() {
        if (!window.currentUser || window.currentUser.rol !== 'admin') { UI.showToast('Acceso denegado', 'error'); return; }
        const { data: usuarios } = await supabaseClient.from('usuarios').select('*').order('created_at', { ascending: false });
        let html = '<h2>Gestionar Usuarios</h2>';
        if (usuarios && usuarios.length > 0) { html += '<div class="table-container"><table><thead><tr><th>Usuario</th><th>Nombre</th><th class="text-center">Rol</th><th class="text-center">Estado</th><th class="text-center">Acción</th></tr></thead><tbody>';
            usuarios.forEach(u => { const eb = u.activo ? '<span class="badge badge-success">Activo</span>' : '<span class="badge badge-warning">Pendiente</span>'; const rb = u.rol === 'admin' ? '<span class="badge badge-danger">Admin</span>' : (u.rol === 'usuario' ? '<span class="badge badge-info">Usuario</span>' : '<span class="badge badge-warning">Pendiente</span>'); html += `<tr><td><strong>${u.usuario}</strong></td><td>${u.nombre||'-'}</td><td class="text-center">${rb}</td><td class="text-center">${eb}</td><td class="text-center">${!u.activo ? `<button class="btn btn-success btn-sm" onclick="App.activarUsuario(${u.id})">${UI.icons.check} Activar</button>` : ''}${u.rol!=='admin'&&u.activo ? `<button class="btn btn-danger btn-sm" onclick="App.desactivarUsuario(${u.id})">${UI.icons.close} Desactivar</button>` : ''}</td></tr>`; });
            html += '</tbody></table></div>'; } else { html += '<p>No hay usuarios registrados.</p>'; }
        html += '<div class="form-actions"><button class="btn btn-secondary" onclick="UI.closeModal()">Cerrar</button></div>'; UI.openModal(html);
    },

    async activarUsuario(id) { await supabaseClient.from('usuarios').update({ activo: true, rol: 'usuario' }).eq('id', id); UI.showToast('Usuario activado', 'success'); this.showGestionUsuariosModal(); },
    async desactivarUsuario(id) { if (!confirm('¿Desactivar este usuario?')) return; await supabaseClient.from('usuarios').update({ activo: false }).eq('id', id); UI.showToast('Usuario desactivado', 'success'); this.showGestionUsuariosModal(); },

    exportarExcel() {
        const { inventario } = this.state; if (inventario.length === 0) { UI.showToast('No hay datos', 'warning'); return; }
        let csv = 'ID;Nombre;Anaquel;Stock;Unidad;Lote;Vencimiento;Comentarios\n'; inventario.forEach(item => { csv += `${item.id};"${item.nombre}";${item.anaquel};${item.stock};${item.unidad||''};${item.lote||''};${item.vencimiento||''};"${item.comentarios||''}"\n`; });
        const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `inventario_bodega_${new Date().toISOString().split('T')[0]}.csv`; a.click(); URL.revokeObjectURL(url); UI.showToast('Exportado como CSV', 'success');
    },

    exportarMovimientosExcel() {
        const ft = document.getElementById('busqueda-movimientos')?.value?.trim().toLowerCase() || '';
        const fTipo = document.getElementById('filtro-tipo-movimiento')?.value || 'TODOS';
        const fUsuario = document.getElementById('filtro-usuario-movimiento')?.value || 'TODOS';
        let movs = [...this.state.movimientos]; if (fTipo !== 'TODOS') movs = movs.filter(m => m.tipo === fTipo); if (fUsuario !== 'TODOS') movs = movs.filter(m => (m.usuario || 'sistema') === fUsuario);
        if (ft) movs = movs.filter(m => (m.insumo&&m.insumo.toLowerCase().includes(ft))||(m.anaquel&&m.anaquel.toLowerCase().includes(ft))||(m.comentarios&&m.comentarios.toLowerCase().includes(ft)));
        if (movs.length === 0) { UI.showToast('No hay movimientos', 'warning'); return; }
        let csv = 'Usuario;Fecha;Tipo;Info.;Cantidad;Stock Ant.;Stock Nuevo;Anaquel;Comentarios\n';
        movs.forEach(mov => { csv += `"${mov.usuario||'sistema'}";"${new Date(mov.fecha).toLocaleString('es-CL')}";${this.formatearTipo(mov.tipo)};"${mov.insumo||''}";${mov.cantidad||0};${mov.stock_anterior!==null&&mov.stock_anterior!==undefined?mov.stock_anterior:''};${mov.stock_nuevo!==null&&mov.stock_nuevo!==undefined?mov.stock_nuevo:''};${mov.anaquel||''};"${mov.comentarios||''}"\n`; });
        const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `movimientos_bodega_${new Date().toISOString().split('T')[0]}.csv`; a.click(); URL.revokeObjectURL(url); UI.showToast(`${movs.length} movimientos exportados`, 'success');
    }
};

document.addEventListener('DOMContentLoaded', () => App.init());
