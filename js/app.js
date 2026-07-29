const App = {
    state: { inventario: [], secciones: [], unidades: [], movimientos: [], config: { porcentaje_critico: 20, dias_vencimiento: 30 } },

    async init() {
        try {
            UI.setConnectionStatus('warning', 'CONECTANDO...');
            if (typeof supabaseClient === 'undefined') throw new Error('CLIENTE NO INICIALIZADO');
            UI.setupMobileMenu();
            await this.loadAllData();
            this.setupEventListeners();
            this.showDashboard();
            UI.setConnectionStatus('success', 'CONECTADO');
            this.verificarConfiguracionInicial();
        } catch (error) { console.error(error); UI.setConnectionStatus('error', 'ERROR'); UI.showToast('ERROR AL CONECTAR', 'error'); }
    },

    verificarConfiguracionInicial() {
        const bodega = window.currentBodega || 'BODEGA';
        const esBotiquin = bodega === 'BOTIQUIN';
        const sinSecciones = this.state.secciones.length === 0;
        const sinUnidades = this.state.unidades.length === 0;
        if (esBotiquin) { if (sinUnidades) { UI.showToast('NO TIENES UNIDADES DE MEDIDA CONFIGURADAS. CONFIGÚRALAS ANTES DE USAR EL SISTEMA.', 'warning'); } }
        else { if (sinSecciones && sinUnidades) { UI.showToast('NO TIENES ANAQUELES NI UNIDADES DE MEDIDA CONFIGURADOS. CONFIGÚRALOS ANTES DE EMPEZAR A INGRESAR DATOS.', 'warning'); } else if (sinSecciones) { UI.showToast('NO TIENES ANAQUELES CONFIGURADOS. CONFIGÚRALOS ANTES DE EMPEZAR A INGRESAR DATOS.', 'warning'); } else if (sinUnidades) { UI.showToast('NO TIENES UNIDADES DE MEDIDA CONFIGURADAS. CONFIGÚRALAS ANTES DE USAR EL SISTEMA.', 'warning'); } }
    },

    async loadAllData() {
        const b = window.currentBodega || 'BODEGA';
        const [inventario, secciones, unidades, config, movimientos] = await Promise.all([DB.getInventario(b), DB.getSecciones(b), DB.getUnidadesMedida(b), DB.getConfig(b), DB.getTodosMovimientos(b)]);
        this.state.inventario = inventario || []; this.state.secciones = secciones || []; this.state.unidades = unidades || [];
        this.state.config = config || { porcentaje_critico: 20, dias_vencimiento: 30 }; this.state.movimientos = movimientos || [];
    },

    setupEventListeners() {
        document.querySelectorAll('.sidebar-menu a[data-section]').forEach(link => { link.addEventListener('click', (e) => { e.preventDefault(); const s = link.dataset.section; if (s === 'dashboard') this.showDashboard(); else if (s === 'inventario') this.showInventario(); else if (s === 'movimientos') this.showMovimientos(); }); });
        document.getElementById('btn-ingreso').addEventListener('click', (e) => { e.preventDefault(); this.showIngresoModal(); });
        document.getElementById('btn-salida').addEventListener('click', (e) => { e.preventDefault(); this.showSalidaModal(); });
        const btnBuscar = document.getElementById('btn-buscar-anaquel'); if (btnBuscar) btnBuscar.addEventListener('click', (e) => { e.preventDefault(); this.showBusquedaAnaquelModal(); });
        const btnGestionar = document.getElementById('btn-gestionar'); if (btnGestionar) btnGestionar.addEventListener('click', (e) => { e.preventDefault(); this.showGestionSeccionesModal(); });
        document.getElementById('btn-exportar').addEventListener('click', (e) => { e.preventDefault(); this.exportarExcel(); });
        const btnAdmin = document.getElementById('btn-admin-usuarios'); if (btnAdmin) btnAdmin.addEventListener('click', (e) => { e.preventDefault(); this.showGestionUsuariosModal(); });
        document.getElementById('header-actions').addEventListener('click', (e) => { if (e.target.closest('#header-btn-ingreso')) this.showIngresoModal(); else if (e.target.closest('#header-btn-salida')) this.showSalidaModal(); });
        const ft = document.getElementById('filtro-tipo-movimiento'); if (ft) ft.addEventListener('change', () => this.renderMovimientos());
        const fu = document.getElementById('filtro-usuario-movimiento'); if (fu) fu.addEventListener('change', () => this.renderMovimientos());
        const bm = document.getElementById('busqueda-movimientos'); if (bm) bm.addEventListener('input', () => this.renderMovimientos());
        document.addEventListener('keydown', (e) => { if (e.key === 'Escape') UI.closeModal(); });
    },

    limpiarCodigoBarras(codigo) {
        if (!codigo) return '';
        const match = codigo.match(/\(01\)(\d+)/);
        return match ? match[1] : codigo.replace(/[()\s-]/g, '').toUpperCase();
    },

    async showDashboard() { UI.setActiveSection('dashboard'); await this.loadAllData(); this.renderDashboard(); },
    renderDashboard() {
        const { inventario, secciones, config } = this.state;
        document.getElementById('total-insumos').textContent = inventario.length;
        document.getElementById('total-badge').textContent = inventario.length;
        document.getElementById('stock-total').textContent = inventario.reduce((s, i) => s + (i.stock || 0), 0);
        document.getElementById('secciones-activas').textContent = [...new Set(secciones.map(s => s.seccion))].length;
        const criticos = inventario.filter(i => this.esStockCritico(i));
        document.getElementById('stock-critico').textContent = criticos.length;
        const hoy = new Date(); const lim = new Date(hoy); lim.setDate(lim.getDate() + (config.dias_vencimiento || 30));
        const vc = inventario.filter(i => { if (!i.vencimiento) return false; return new Date(i.vencimiento + 'T00:00:00') < hoy; }).length;
        const pv = inventario.filter(i => { if (!i.vencimiento) return false; const v = new Date(i.vencimiento + 'T00:00:00'); return v >= hoy && v <= lim; }).length;
        document.getElementById('vencimientos-proximos').textContent = vc + pv;
        this.renderAlertas(criticos);
    },

    esStockCritico(item) {
        if (!item.stock || item.stock === 0) return true;
        const movs = this.state.movimientos.filter(m => m.insumo && item.nombre && m.insumo.toLowerCase() === item.nombre.toLowerCase() && m.anaquel === item.anaquel);
        if (movs.length === 0) return false;
        if (!movs.some(m => m.tipo === 'SALIDA')) return false;
        const maxs = movs.map(m => m.stock_nuevo || 0); const sm = Math.max(...maxs, item.stock);
        if (sm === 0) return false;
        return (item.stock / sm) * 100 <= this.state.config.porcentaje_critico;
    },

    renderAlertas(criticos) {
        const c = document.getElementById('alertas-stock'); const { inventario, config } = this.state;
        const hoy = new Date(); const lim = new Date(hoy); lim.setDate(lim.getDate() + (config.dias_vencimiento || 30));
        const porVencer = inventario.filter(i => { if (!i.vencimiento) return false; const v = new Date(i.vencimiento + 'T00:00:00'); return v >= hoy && v <= lim && !this.esStockCritico(i); });
        const vencidos = inventario.filter(i => { if (!i.vencimiento) return false; return new Date(i.vencimiento + 'T00:00:00') < hoy && !this.esStockCritico(i); });
        const cIds = new Set(criticos.map(i => i.id));
        const pvf = porVencer.filter(i => !cIds.has(i.id)); const vf = vencidos.filter(i => !cIds.has(i.id));
        const total = criticos.length + pvf.length + vf.length;
        if (total === 0) { c.innerHTML = `<div class="empty-state"><div class="icon">${UI.icons.check}</div><p>NO HAY ALERTAS.</p></div>`; return; }
        let h = '<div class="table-container"><table><thead><tr><th>INSUMO</th><th class="text-center">STOCK</th><th class="text-center">ANAQUEL</th><th class="text-center">VENC.</th><th class="text-center">ALERTA</th></tr></thead><tbody>';
        criticos.forEach(item => { const v = item.vencimiento ? new Date(item.vencimiento + 'T00:00:00') : null; const venc = v && v < hoy; const vp = v && !venc && v <= lim; let ta = ''; if (venc) ta = '<span class="badge badge-danger">VENCIDO</span> <span class="badge badge-danger">STOCK CRÍTICO</span>'; else if (vp) ta = '<span class="badge badge-danger">STOCK CRÍTICO</span> <span class="badge badge-warning">POR VENCER</span>'; else ta = '<span class="badge badge-danger">STOCK CRÍTICO</span>'; h += `<tr class="stock-critical"><td><strong>${item.nombre}</strong></td><td class="text-center">${item.stock} ${item.unidad||''}</td><td class="text-center">${item.anaquel}</td><td class="text-center">${item.vencimiento||'N/A'}</td><td class="text-center">${ta}</td></tr>`; });
        vf.forEach(item => { h += `<tr class="stock-critical"><td><strong>${item.nombre}</strong></td><td class="text-center">${item.stock} ${item.unidad||''}</td><td class="text-center">${item.anaquel}</td><td class="text-center">${item.vencimiento||'N/A'}</td><td class="text-center"><span class="badge badge-danger">VENCIDO</span></td></tr>`; });
        pvf.forEach(item => { const dr = Math.ceil((new Date(item.vencimiento + 'T00:00:00') - hoy) / 86400000); h += `<tr class="stock-warning"><td><strong>${item.nombre}</strong></td><td class="text-center">${item.stock} ${item.unidad||''}</td><td class="text-center">${item.anaquel}</td><td class="text-center">${item.vencimiento||'N/A'} <small>(${dr} DÍAS)</small></td><td class="text-center"><span class="badge badge-warning">POR VENCER</span></td></tr>`; });
        h += '</tbody></table></div>'; c.innerHTML = h;
        if (total > 10) { c.innerHTML += `<p style="margin-top:10px;font-size:11px;color:#888;text-align:center;">MOSTRANDO LAS PRIMERAS 10 DE ${total} ALERTAS. <a href="#" onclick="App.showInventario();return false;" style="color:var(--primary);">VER TODAS →</a></p>`; }
    },

    async showInventario() { UI.setActiveSection('inventario'); await this.loadAllData(); this.renderInventario(); },
    renderInventario() {
        const sc = document.getElementById('filtro-stock-critico')?.checked ?? false; const pv = document.getElementById('filtro-por-vencer')?.checked ?? false;
        const vc = document.getElementById('filtro-vencidos')?.checked ?? false; const ninguno = !sc && !pv && !vc;
        const hoy = new Date(); const lim = new Date(hoy); lim.setDate(lim.getDate() + (this.state.config.dias_vencimiento || 30));
        let items = [...this.state.inventario]; let filtrados = [];
        if (ninguno) { filtrados = items; } else { items.forEach(item => { const ec = this.esStockCritico(item); const v = item.vencimiento ? new Date(item.vencimiento + 'T00:00:00') : null; const venc = v && v < hoy; const vp = v && !venc && v <= lim; let inc = false; if (sc && ec && !venc) inc = true; if (pv && vp && !ec) inc = true; if (vc && venc) inc = true; if (ec && venc && (sc || vc)) inc = true; if (inc) filtrados.push(item); }); }
        document.getElementById('contador-inventario').textContent = filtrados.length;
        const c = document.getElementById('tabla-inventario'); if (filtrados.length === 0) { c.innerHTML = `<div class="empty-state"><div class="icon">${UI.icons.box}</div><p>SIN RESULTADOS.</p></div>`; return; }
        const esB = window.currentBodega === 'BOTIQUIN';
        let th = esB ? '<th>NOMBRE</th><th class="text-center">STOCK</th><th class="text-center">UND.</th><th class="text-center">LOTE</th><th class="text-center">VENC.</th><th class="text-center">CB</th><th class="text-center">ACC.</th>' : '<th>NOMBRE</th><th class="text-center">ANAQUEL</th><th class="text-center">STOCK</th><th class="text-center">UND.</th><th class="text-center">LOTE</th><th class="text-center">VENC.</th><th class="text-center">CB</th><th class="text-center">ACC.</th>';
        let h = `<table><thead><tr>${th}</tr></thead><tbody>`;
        filtrados.forEach(item => { const ec = this.esStockCritico(item); const v = item.vencimiento ? new Date(item.vencimiento + 'T00:00:00') : null; const venc = v && v < hoy; const vp = v && !venc && v <= lim; let cl = ''; if (venc) cl = 'stock-critical'; else if (ec) cl = 'stock-critical'; else if (vp) cl = 'stock-warning'; h += `<tr class="${cl}"><td><strong>${item.nombre}</strong></td>${esB ? '' : `<td class="text-center">${item.anaquel}</td>`}<td class="text-center">${item.stock}</td><td class="text-center">${item.unidad||''}</td><td class="text-center">${item.lote||'-'}</td><td class="text-center">${item.vencimiento||'-'}${venc?' <span class="badge badge-danger">VENC</span>':''}${vp&&!ec?' <span class="badge badge-warning">PRONT</span>':''}</td><td class="text-center">${item.codigo_barras ? `<span class="badge badge-info">${item.codigo_barras}</span>` : '-'}</td><td class="text-center"><button class="btn btn-warning btn-sm" onclick="App.editarInsumo(${item.id})">${UI.icons.edit}</button><button class="btn btn-danger btn-sm" onclick="App.eliminarInsumo(${item.id})">${UI.icons.trash}</button></td></tr>`; });
        h += '</tbody></table>'; c.innerHTML = h;
    },

    async showMovimientos() { UI.setActiveSection('movimientos'); UI.showLoading('tabla-movimientos'); try { await this.loadAllData(); this.cargarFiltroUsuarios(); this.renderMovimientos(); } catch (e) { document.getElementById('tabla-movimientos').innerHTML = '<div class="empty-state"><p>ERROR AL CARGAR.</p></div>'; } },
    cargarFiltroUsuarios() { const s = document.getElementById('filtro-usuario-movimiento'); if (!s) return; const us = [...new Set(this.state.movimientos.map(m => m.usuario).filter(Boolean))].sort(); s.innerHTML = '<option value="TODOS">TODOS LOS USUARIOS</option>'; us.forEach(u => { s.innerHTML += `<option value="${u}">${u}</option>`; }); },
    renderMovimientos() {
        const ft = document.getElementById('busqueda-movimientos')?.value?.trim().toLowerCase() || ''; const fTipo = document.getElementById('filtro-tipo-movimiento')?.value || 'TODOS'; const fUsr = document.getElementById('filtro-usuario-movimiento')?.value || 'TODOS';
        let movs = [...this.state.movimientos]; if (fTipo !== 'TODOS') movs = movs.filter(m => m.tipo === fTipo); if (fUsr !== 'TODOS') movs = movs.filter(m => (m.usuario || 'SISTEMA') === fUsr);
        if (ft) movs = movs.filter(m => (m.insumo&&m.insumo.toLowerCase().includes(ft))||(m.anaquel&&m.anaquel.toLowerCase().includes(ft))||(m.comentarios&&m.comentarios.toLowerCase().includes(ft)));
        const c = document.getElementById('tabla-movimientos'); if (movs.length === 0) { c.innerHTML = `<div class="empty-state"><div class="icon">${UI.icons.list}</div><p>SIN MOVIMIENTOS.</p></div>`; return; }
        let h = '<div class="table-container"><table><thead><tr><th>USUARIO / FECHA</th><th class="text-center">TIPO</th><th>INFO.</th><th class="text-center">CANT.</th><th class="text-center">STOCK ANT.</th><th class="text-center">STOCK NUEVO</th><th class="text-center">ANAQUEL</th><th>COMENTARIOS</th></tr></thead><tbody>';
        movs.forEach(mov => { const f = new Date(mov.fecha); const co = this.getColorTipo(mov.tipo); const tf = this.formatearTipo(mov.tipo); const usr = mov.usuario || 'SISTEMA'; h += `<tr><td>${usr} - ${f.toLocaleString('es-CL')}</td><td class="text-center"><span class="badge" style="background:${co};">${tf}</span></td><td>${mov.insumo||'-'}</td><td class="text-center">${mov.cantidad||'-'}</td><td class="text-center">${mov.stock_anterior!=null?mov.stock_anterior:'-'}</td><td class="text-center">${mov.stock_nuevo!=null?mov.stock_nuevo:'-'}</td><td class="text-center">${mov.anaquel||'-'}</td><td style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${mov.comentarios||''}">${mov.comentarios||''}</td></tr>`; });
        h += '</tbody></table></div>'; c.innerHTML = h;
    },
    getColorTipo(t) { const c = {'INGRESO':'#27ae60','SALIDA':'#c0392b','EDICION':'#2980b9','ELIMINACION':'#e74c3c','CREACION_SECCION':'#8e44ad','ELIMINACION_SECCION':'#c0392b','CREACION_UNIDAD':'#16a085','ELIMINACION_UNIDAD':'#e67e22'}; return c[t]||'#6c757d'; },
    formatearTipo(t) { const tf = {'INGRESO':'INGRESO','SALIDA':'SALIDA','EDICION':'EDICIÓN','ELIMINACION':'ELIMINACIÓN','CREACION_SECCION':'CREACIÓN SECCIÓN','ELIMINACION_SECCION':'ELIMINACIÓN SECCIÓN','CREACION_UNIDAD':'CREACIÓN UNIDAD','ELIMINACION_UNIDAD':'ELIMINACIÓN UNIDAD'}; return tf[t]||t; },

    showIngresoModal() {
        const esBotiquin = window.currentBodega === 'BOTIQUIN';
        const anaqueles = this.state.secciones.map(s => s.seccion + s.anaquel).sort();
        const unidades = this.state.unidades.map(u => u.nombre).sort();
        const esMovil = window.innerWidth <= 768;
        const campoAnaquel = esBotiquin ? '' : `<div class="form-group"><label>ANAQUEL *</label><select id="ing-anaquel"><option value="">SELECCIONE...</option>${anaqueles.map(a => `<option value="${a}">${a}</option>`).join('')}</select>${anaqueles.length===0?'<small style="color:#c0392b;">NO HAY ANAQUELES.</small>':''}</div>`;
        const botonEscaner = esMovil ? `<div class="form-group"><button type="button" class="btn btn-info btn-block" onclick="App.abrirEscanner('ingreso')" style="margin-bottom:10px;"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 7V5a2 2 0 0 1 2-2h2"/><path d="M17 3h2a2 2 0 0 1 2 2v2"/><path d="M21 17v2a2 2 0 0 1-2 2h-2"/><path d="M7 21H5a2 2 0 0 1-2-2v-2"/><line x1="7" y1="12" x2="17" y2="12"/></svg> ESCANEAR CÓDIGO DE BARRAS</button></div>` : '';
        UI.openModal(`<h2>NUEVO INGRESO</h2>${botonEscaner}<div id="scanner-container-ingreso" style="display:none;margin-bottom:10px;"></div><div class="form-group" style="position:relative;"><label>NOMBRE DEL INSUMO *</label><input type="text" id="ing-nombre" placeholder="ESCRIBA EL NOMBRE..." autofocus autocomplete="off" onkeyup="App.buscarCoincidencias('ing')" onfocus="App.buscarCoincidencias('ing')" style="text-transform:uppercase;"><div id="sugerencias-ing" style="position:absolute;top:100%;left:0;right:0;background:white;border:1px solid #ddd;border-radius:0 0 5px 5px;max-height:200px;overflow-y:auto;z-index:100;display:none;box-shadow:0 4px 8px rgba(0,0,0,0.1);"></div></div><div class="form-group"><label>CÓDIGO DE BARRAS</label><input type="text" id="ing-codigo-barras" placeholder="ESCANEE O INGRESE EL CÓDIGO..." onkeypress="if(event.key==='Enter'){event.preventDefault();App.buscarPorCodigoBarrasIngreso();}"></div>${campoAnaquel}<div class="form-row"><div class="form-group"><label>CANTIDAD *</label><input type="number" id="ing-cantidad" value="1" min="1"></div><div class="form-group"><label>UNIDAD</label><select id="ing-unidad"><option value="">SELECCIONE...</option>${unidades.map(u => `<option value="${u}">${u}</option>`).join('')}</select></div></div><div class="form-row"><div class="form-group"><label>LOTE</label><input type="text" id="ing-lote" style="text-transform:uppercase;"></div><div class="form-group"><label>VENCIMIENTO</label><input type="date" id="ing-vencimiento"></div></div><div class="form-group"><label>COMENTARIOS</label><textarea id="ing-comentarios" style="text-transform:uppercase;"></textarea></div><div class="form-actions"><button class="btn btn-secondary" onclick="UI.closeModal()">CANCELAR</button><button class="btn btn-success" onclick="App.procesarIngreso()">${UI.icons.plus} REGISTRAR</button></div>`);
        setTimeout(() => { document.addEventListener('click', function cerrar(e) { const inp = document.getElementById('ing-nombre'); const sug = document.getElementById('sugerencias-ing'); if (inp && sug && e.target !== inp && !sug.contains(e.target)) sug.style.display = 'none'; }); }, 100);
    },

    showSalidaModal() {
        const anaqueles = this.state.secciones.map(s => s.seccion + s.anaquel).sort();
        const esBotiquin = window.currentBodega === 'BOTIQUIN';
        const esMovil = window.innerWidth <= 768;
        const campoAnaquel = esBotiquin ? '' : `<div class="form-group"><label>FILTRAR POR ANAQUEL</label><select id="sal-anaquel-filtro" onchange="App.filtrarPorAnaquelSalida()"><option value="">TODOS</option>${anaqueles.map(a => `<option value="${a}">${a}</option>`).join('')}</select></div>`;
        const botonEscaner = esMovil ? `<div class="form-group"><button type="button" class="btn btn-info btn-block" onclick="App.abrirEscanner('salida')" style="margin-bottom:10px;"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 7V5a2 2 0 0 1 2-2h2"/><path d="M17 3h2a2 2 0 0 1 2 2v2"/><path d="M21 17v2a2 2 0 0 1-2 2h-2"/><path d="M7 21H5a2 2 0 0 1-2-2v-2"/><line x1="7" y1="12" x2="17" y2="12"/></svg> ESCANEAR CÓDIGO DE BARRAS</button></div>` : '';
        UI.openModal(`<h2>NUEVA SALIDA</h2>${botonEscaner}<div id="scanner-container-salida" style="display:none;margin-bottom:10px;"></div>${campoAnaquel}<div class="form-group" style="position:relative;"><label>BUSCAR POR NOMBRE</label><input type="text" id="sal-busqueda" placeholder="ESCRIBA EL NOMBRE..." autocomplete="off" onkeyup="App.buscarCoincidenciasSalida()" onfocus="App.buscarCoincidenciasSalida()" style="text-transform:uppercase;"><div id="sugerencias-sal" style="position:absolute;top:100%;left:0;right:0;background:white;border:1px solid #ddd;border-radius:0 0 5px 5px;max-height:200px;overflow-y:auto;z-index:100;display:none;"></div></div><div id="resultados-busqueda"><p style="color:#666;padding:15px;">BUSQUE UN INSUMO PARA RETIRAR.</p></div><div class="form-actions"><button class="btn btn-secondary" onclick="UI.closeModal()">CANCELAR</button></div>`);
    },

    abrirEscanner(tipo) {
        const containerId = tipo === 'edicion' ? 'scanner-container-edicion' : `scanner-container-${tipo}`;
        const container = document.getElementById(containerId);
        if (!container) return;
        container.style.display = 'block';
        container.innerHTML = '';
        const key = `html5QrCode${tipo.charAt(0).toUpperCase() + tipo.slice(1)}`;
        if (window[key]) { window[key].stop(); }
        const html5QrCode = new Html5Qrcode(containerId);
        html5QrCode.start({ facingMode: 'environment' }, { fps: 10, qrbox: { width: 250, height: 150 } }, (decodedText) => {
            html5QrCode.stop();
            container.style.display = 'none';
            const codigoLimpio = this.limpiarCodigoBarras(decodedText);
            if (tipo === 'ingreso') { document.getElementById('ing-codigo-barras').value = codigoLimpio; this.buscarPorCodigoBarrasIngreso(); }
            else if (tipo === 'salida') { this.buscarPorCodigoBarrasSalida(codigoLimpio); }
            else if (tipo === 'edicion') { document.getElementById('edit-codigo-barras').value = codigoLimpio; this.buscarPorCodigoBarrasEdicion(); }
            window[key] = null;
        }, (errorMessage) => { }).catch(err => { container.style.display = 'none'; UI.showToast('NO SE PUDO ABRIR LA CÁMARA.', 'warning'); });
        window[key] = html5QrCode;
    },

    async buscarPorCodigoBarrasIngreso() {
        const codigo = this.limpiarCodigoBarras(document.getElementById('ing-codigo-barras').value);
        if (!codigo) return;
        document.getElementById('ing-codigo-barras').value = codigo;
        try {
            const resultados = await DB.buscarPorCodigoBarras(codigo);
            if (resultados.length > 0) {
                const item = resultados[0];
                document.getElementById('ing-nombre').value = item.nombre;
                document.getElementById('ing-unidad').value = item.unidad || '';
                if (document.getElementById('ing-anaquel')) document.getElementById('ing-anaquel').value = item.anaquel;
                document.getElementById('ing-lote').value = item.lote || '';
                document.getElementById('ing-vencimiento').value = item.vencimiento || '';
                UI.showToast('INSUMO ENCONTRADO: ' + item.nombre, 'success');
            } else { UI.showToast('CÓDIGO NUEVO. COMPLETE LOS DATOS.', 'warning'); }
        } catch (e) { UI.showToast('ERROR AL BUSCAR CÓDIGO', 'error'); }
    },

    async buscarPorCodigoBarrasSalida(codigo) {
        const codigoLimpio = this.limpiarCodigoBarras(codigo);
        if (!codigoLimpio) return;
        try {
            const resultados = await DB.buscarPorCodigoBarras(codigoLimpio);
            if (resultados.length > 0) {
                const itemsConStock = resultados.filter(i => i.stock > 0);
                if (itemsConStock.length === 0) { UI.showToast('SIN STOCK DISPONIBLE', 'warning'); return; }
                if (itemsConStock.length === 1) { this.prepararSalida(itemsConStock[0].id); return; }
                let h = '<div style="max-height:400px;overflow-y:auto;">';
                itemsConStock.forEach(i => { h += `<div style="border:1px solid #ddd;padding:12px;margin:5px 0;border-radius:5px;display:flex;justify-content:space-between;"><div><strong>${i.nombre}</strong><br><small>STOCK: ${i.stock} ${i.unidad||''} | ${i.anaquel}${i.lote?` | LOTE: ${i.lote}`:''}${i.vencimiento?` | VENC: ${i.vencimiento}`:''}</small></div><button class="btn btn-danger btn-sm" onclick="App.prepararSalida(${i.id})">RETIRAR</button></div>`; });
                h += '</div>';
                UI.openModal(`<h2>SELECCIONE LOTE</h2>${h}<div class="form-actions"><button class="btn btn-secondary" onclick="UI.closeModal()">CANCELAR</button></div>`);
            } else { UI.showToast('CÓDIGO NO ENCONTRADO', 'warning'); }
        } catch (e) { UI.showToast('ERROR AL BUSCAR', 'error'); }
    },

    async buscarPorCodigoBarrasEdicion() {
        const codigo = this.limpiarCodigoBarras(document.getElementById('edit-codigo-barras').value);
        if (!codigo) return;
        document.getElementById('edit-codigo-barras').value = codigo;
        try {
            const resultados = await DB.buscarPorCodigoBarras(codigo);
            if (resultados.length > 0) {
                const item = resultados[0];
                document.getElementById('edit-nombre').value = item.nombre;
                document.getElementById('edit-unidad').value = item.unidad || '';
                if (document.getElementById('edit-anaquel')) document.getElementById('edit-anaquel').value = item.anaquel;
                document.getElementById('edit-lote').value = item.lote || '';
                document.getElementById('edit-vencimiento').value = item.vencimiento || '';
                UI.showToast('INSUMO ENCONTRADO: ' + item.nombre, 'success');
            } else { UI.showToast('CÓDIGO NUEVO.', 'warning'); }
        } catch (e) { UI.showToast('ERROR AL BUSCAR CÓDIGO', 'error'); }
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

    seleccionarSugerencia(tipo, nombre, unidad) {
        if (tipo === 'ing') { document.getElementById('ing-nombre').value = nombre; if (unidad) { const s = document.getElementById('ing-unidad'); for (let i = 0; i < s.options.length; i++) { if (s.options[i].value === unidad) { s.selectedIndex = i; break; } } } document.getElementById('sugerencias-ing').style.display = 'none'; }
        else { document.getElementById('sal-busqueda').value = nombre; document.getElementById('sugerencias-sal').style.display = 'none'; this.buscarInsumoSalida(); }
    },

    async procesarIngreso() {
        const esBotiquin = window.currentBodega === 'BOTIQUIN';
        const nombre = document.getElementById('ing-nombre').value.trim().toUpperCase();
        const anaquel = esBotiquin ? 'BOTIQUIN' : document.getElementById('ing-anaquel').value;
        const cantidad = parseInt(document.getElementById('ing-cantidad').value);
        const unidad = document.getElementById('ing-unidad').value;
        const lote = document.getElementById('ing-lote').value.trim().toUpperCase();
        const vencimiento = document.getElementById('ing-vencimiento').value;
        const codigoBarras = this.limpiarCodigoBarras(document.getElementById('ing-codigo-barras').value);
        const comentarios = document.getElementById('ing-comentarios').value.trim().toUpperCase();
        if (!nombre || (!esBotiquin && !anaquel) || !cantidad || cantidad <= 0) { UI.showToast('COMPLETE LOS CAMPOS (*)', 'error'); return; }
        const seccion = esBotiquin ? 'B' : anaquel.charAt(0);
        try { await DB.procesarIngreso(nombre, seccion, anaquel, cantidad, unidad, lote, vencimiento, codigoBarras || null, comentarios); UI.closeModal(); UI.showToast('INGRESO REGISTRADO', 'success'); await this.loadAllData(); this.renderDashboard(); } catch (e) { UI.showToast('ERROR: ' + e.message, 'error'); }
    },

    buscarCoincidenciasSalida() {
        const af = document.getElementById('sal-anaquel-filtro')?.value;
        const input = document.getElementById('sal-busqueda'); const sug = document.getElementById('sugerencias-sal');
        if (!input || !sug) return;
        const b = input.value.trim().toLowerCase(); if (b.length < 1) { sug.style.display = 'none'; this.buscarInsumoSalida(); return; }
        let r = this.state.inventario.filter(i => i.stock > 0 && i.nombre.toLowerCase().includes(b));
        if (af) r = r.filter(i => i.anaquel === af);
        if (r.length === 0) { sug.style.display = 'none'; return; }
        let h = ''; r.slice(0, 10).forEach(i => { h += `<div onclick="App.seleccionarSugerenciaSalida('${i.nombre.replace(/'/g, "\\'")}')" style="padding:8px 12px;cursor:pointer;border-bottom:1px solid #eee;font-size:13px;" onmouseover="this.style.background='#eef2f7'" onmouseout="this.style.background='white'"><strong>${i.nombre}</strong><span style="color:#888;font-size:11px;">STOCK: ${i.stock} | ${i.anaquel}${i.lote?` | LOTE: ${i.lote}`:''}${i.vencimiento?` | VENC: ${i.vencimiento}`:''}${i.codigo_barras?` | CB: ${i.codigo_barras}`:''}</span></div>`; });
        sug.innerHTML = h; sug.style.display = 'block';
    },
    seleccionarSugerenciaSalida(nombre) { document.getElementById('sal-busqueda').value = nombre; document.getElementById('sugerencias-sal').style.display = 'none'; this.buscarInsumoSalida(); },

    buscarInsumoSalida() {
        const af = document.getElementById('sal-anaquel-filtro')?.value; const b = document.getElementById('sal-busqueda').value.trim().toLowerCase();
        let r = this.state.inventario.filter(i => i.stock > 0); if (af) r = r.filter(i => i.anaquel === af); if (b) r = r.filter(i => i.nombre.toLowerCase().includes(b));
        const c = document.getElementById('resultados-busqueda'); if (r.length === 0) { c.innerHTML = '<p style="padding:15px;">NO SE ENCONTRARON INSUMOS.</p>'; return; }
        let h = '<div style="max-height:400px;overflow-y:auto;">';
        r.forEach(i => { h += `<div style="border:1px solid #ddd;padding:12px;margin:5px 0;border-radius:5px;display:flex;justify-content:space-between;"><div><strong>${i.nombre}</strong><br><small>STOCK: ${i.stock} ${i.unidad||''} | ANAQUEL: ${i.anaquel}${i.lote?` | LOTE: <span class="badge badge-info">${i.lote}</span>`:''}${i.vencimiento?` | VENC: ${i.vencimiento}`:''}${i.codigo_barras?` | CB: ${i.codigo_barras}`:''}</small></div><button class="btn btn-danger btn-sm" onclick="App.prepararSalida(${i.id})">RETIRAR</button></div>`; });
        h += '</div>'; c.innerHTML = h;
    },

    prepararSalida(id) { const i = this.state.inventario.find(x => x.id === id); if (!i) return; UI.openModal(`<h2>RETIRAR INSUMO</h2><div style="background:#f8f9fa;padding:15px;border-radius:8px;margin-bottom:15px;"><p><strong>INSUMO:</strong> ${i.nombre}</p><p><strong>ANAQUEL:</strong> ${i.anaquel}</p><p><strong>STOCK:</strong> ${i.stock} ${i.unidad||'UNIDADES'}</p>${i.lote?`<p><strong>LOTE:</strong> ${i.lote}</p>`:''}${i.vencimiento?`<p><strong>VENCIMIENTO:</strong> ${i.vencimiento}</p>`:''}${i.codigo_barras?`<p><strong>CB:</strong> ${i.codigo_barras}</p>`:''}</div><div class="form-group"><label>CANTIDAD *</label><input type="number" id="sal-cantidad" value="1" min="1" max="${i.stock}" autofocus></div><div class="form-group"><label>MOTIVO</label><textarea id="sal-comentarios" style="text-transform:uppercase;"></textarea></div><div class="form-actions"><button class="btn btn-secondary" onclick="App.showSalidaModal()">VOLVER</button><button class="btn btn-danger" onclick="App.procesarSalida(${id})">${UI.icons.minus} CONFIRMAR</button></div>`); },
    async procesarSalida(id) { const c = parseInt(document.getElementById('sal-cantidad').value); const co = document.getElementById('sal-comentarios').value.trim().toUpperCase(); if (!c || c <= 0) { UI.showToast('CANTIDAD INVÁLIDA', 'error'); return; } try { const r = await DB.procesarSalida(id, c, co); UI.closeModal(); UI.showToast('SALIDA REGISTRADA' + (r.stockNuevo <= 5 ? ' - STOCK BAJO' : ''), r.stockNuevo <= 5 ? 'warning' : 'success'); await this.loadAllData(); this.renderDashboard(); } catch (e) { UI.showToast('ERROR: ' + e.message, 'error'); } },

    showBusquedaAnaquelModal() { if (window.currentBodega === 'BOTIQUIN') return; UI.openModal(`<h2>BUSCAR ANAQUEL</h2><div class="form-group"><label>ANAQUEL</label><select id="bus-anaquel" onchange="App.buscarAnaquel()"><option value="">SELECCIONE...</option>${this.state.secciones.map(s => s.seccion+s.anaquel).sort().map(a => `<option value="${a}">${a}</option>`).join('')}</select></div><div id="resultado-anaquel"></div><div class="form-actions"><button class="btn btn-secondary" onclick="UI.closeModal()">CERRAR</button></div>`); },
    buscarAnaquel() { const a = document.getElementById('bus-anaquel').value; if (!a) return; const items = this.state.inventario.filter(i => i.anaquel === a); const c = document.getElementById('resultado-anaquel'); let h = `<h3>ANAQUEL: <span class="badge badge-info">${a}</span></h3>`; if (items.length === 0) h += '<p>VACÍO.</p>'; else { h += '<div class="table-container"><table><thead><tr><th>INSUMO</th><th class="text-center">STOCK</th><th class="text-center">UND.</th><th class="text-center">LOTE</th><th class="text-center">VENC.</th></tr></thead><tbody>'; items.forEach(i => { h += `<tr><td><strong>${i.nombre}</strong></td><td class="text-center">${i.stock}</td><td class="text-center">${i.unidad||''}</td><td class="text-center">${i.lote||'-'}</td><td class="text-center">${i.vencimiento||'-'}</td></tr>`; }); h += '</tbody></table></div>'; } c.innerHTML = h; },

    showGestionSeccionesModal() {
        const esBotiquin = window.currentBodega === 'BOTIQUIN';
        let h = '<h2>CONFIGURACIÓN</h2>';
        if (esBotiquin) { h += '<div id="tab-contenido"></div>'; }
        else { h += `<div style="display:flex;gap:0;margin-bottom:20px;border-bottom:2px solid #e0e0e0;"><button class="btn btn-light" onclick="App.mostrarTabConfig('secciones')" id="tab-secciones" style="border-radius:5px 5px 0 0;border:2px solid #e0e0e0;border-bottom:2px solid var(--primary);background:white;font-weight:bold;"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg> SECCIONES</button><button class="btn btn-light" onclick="App.mostrarTabConfig('unidades')" id="tab-unidades" style="border-radius:5px 5px 0 0;border:2px solid transparent;background:transparent;"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg> UNIDADES</button></div><div id="tab-contenido"></div>`; }
        UI.openModal(h); if (esBotiquin) { this.mostrarContenidoUnidades(); } else { this.mostrarTabConfig('secciones'); }
    },
    mostrarTabConfig(tab) { if (window.currentBodega === 'BOTIQUIN') { this.mostrarContenidoUnidades(); return; } document.getElementById('tab-secciones').style.borderBottom = tab === 'secciones' ? '2px solid var(--primary)' : '2px solid transparent'; document.getElementById('tab-secciones').style.background = tab === 'secciones' ? 'white' : 'transparent'; document.getElementById('tab-secciones').style.fontWeight = tab === 'secciones' ? 'bold' : 'normal'; document.getElementById('tab-unidades').style.borderBottom = tab === 'unidades' ? '2px solid var(--primary)' : '2px solid transparent'; document.getElementById('tab-unidades').style.background = tab === 'unidades' ? 'white' : 'transparent'; document.getElementById('tab-unidades').style.fontWeight = tab === 'unidades' ? 'bold' : 'normal'; if (tab === 'secciones') this.mostrarContenidoSecciones(); else this.mostrarContenidoUnidades(); },
    mostrarContenidoSecciones() { let html = ''; const ag = {}; this.state.secciones.forEach(s => { if (!ag[s.seccion]) ag[s.seccion] = { d: s.descripcion || 'SIN DESCRIPCIÓN', a: [] }; ag[s.seccion].a.push(s.anaquel); }); const keys = Object.keys(ag).sort(); if (keys.length === 0) html += `<div class="empty-state"><p>NO HAY SECCIONES.</p></div>`; else { html += '<div style="display:grid;gap:15px;margin-bottom:20px;">'; keys.forEach(sec => { const info = ag[sec]; const ao = info.a.sort((a,b) => a.localeCompare(b,undefined,{numeric:true})); html += `<div style="border:2px solid #e0e0e0;border-radius:10px;padding:15px;"><div style="display:flex;justify-content:space-between;margin-bottom:12px;"><div><span style="font-size:20px;font-weight:bold;color:var(--primary);">SECCIÓN ${sec}</span><span style="margin-left:10px;">— ${info.d}</span></div><button class="btn btn-danger btn-sm" onclick="App.eliminarSeccionCompleta('${sec}')">${UI.icons.trash} ELIMINAR</button></div><div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:12px;">${ao.map(a => `<span style="background:var(--primary);color:white;padding:6px 12px;border-radius:20px;font-size:13px;">${sec}${a}<button onclick="event.stopPropagation();App.eliminarAnaquelIndividual('${sec}','${a}')" style="background:rgba(255,255,255,0.3);border:none;color:white;cursor:pointer;padding:2px 6px;border-radius:50%;">×</button></span>`).join('')}</div><button class="btn btn-info btn-sm" onclick="App.mostrarAgregarAnaquel('${sec}')">${UI.icons.plus} AGREGAR</button></div>`; }); html += '</div>'; } html += `<h3 style="margin-top:25px;padding-top:20px;border-top:2px solid #eee;">CREAR SECCIÓN</h3><div class="form-row"><div class="form-group"><label>LETRA *</label><input type="text" id="nueva-seccion-letra" maxlength="1" placeholder="A" style="text-transform:uppercase;"></div><div class="form-group"><label>DESCRIPCIÓN *</label><input type="text" id="nueva-seccion-descripcion" placeholder="EJ: MATERIAL QUIRÚRGICO" style="text-transform:uppercase;"></div><div class="form-group"><label>CANTIDAD</label><input type="number" id="nueva-seccion-cantidad" value="1" min="1" max="50"></div></div><button class="btn btn-success" onclick="App.crearNuevaSeccion()">${UI.icons.plus} CREAR</button>`; document.getElementById('tab-contenido').innerHTML = html; },
    mostrarContenidoUnidades() { const unidades = this.state.unidades.sort((a,b) => a.nombre.localeCompare(b.nombre)); let html = '<p style="font-size:12px;color:#666;margin-bottom:15px;">CONFIGURE LAS UNIDADES DE MEDIDA DISPONIBLES.</p>'; if (unidades.length === 0) html += '<div class="empty-state"><p>NO HAY UNIDADES.</p></div>'; else { html += '<div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:20px;">'; unidades.forEach(u => { html += `<span style="background:var(--primary-light);color:white;padding:8px 14px;border-radius:20px;font-size:13px;">${u.nombre}<button onclick="App.eliminarUnidad(${u.id})" style="background:rgba(255,255,255,0.3);border:none;color:white;cursor:pointer;padding:2px 6px;border-radius:50%;">×</button></span>`; }); html += '</div>'; } html += `<h3 style="margin-top:20px;padding-top:15px;border-top:2px solid #eee;">AGREGAR UNIDAD</h3><div class="form-group"><label>NOMBRE *</label><input type="text" id="nueva-unidad" placeholder="EJ: CAJA" style="text-transform:uppercase;"></div><button class="btn btn-success" onclick="App.agregarUnidad()">${UI.icons.plus} AGREGAR</button>`; document.getElementById('tab-contenido').innerHTML = html; },

    async agregarUnidad() { const n = document.getElementById('nueva-unidad').value.trim().toUpperCase(); if (!n) { UI.showToast('INGRESE UN NOMBRE', 'error'); return; } try { await DB.addUnidadMedida(n); await DB.addMovimiento({ tipo: 'CREACION_UNIDAD', insumo: `UNIDAD: ${n}`, cantidad: 0, comentarios: `UNIDAD CREADA` }); await this.loadAllData(); this.mostrarContenidoUnidades(); UI.showToast('UNIDAD AGREGADA', 'success'); } catch (e) { UI.showToast('ERROR', 'error'); } },
    async eliminarUnidad(id) { const u = this.state.unidades.find(x => x.id === id); if (!u || !confirm('¿ELIMINAR?')) return; try { await DB.addMovimiento({ tipo: 'ELIMINACION_UNIDAD', insumo: `UNIDAD: ${u.nombre}`, cantidad: 0 }); await DB.deleteUnidadMedida(id); await this.loadAllData(); this.mostrarContenidoUnidades(); UI.showToast('UNIDAD ELIMINADA', 'success'); } catch (e) { UI.showToast('ERROR', 'error'); } },

    async crearNuevaSeccion() { const l = document.getElementById('nueva-seccion-letra').value.trim().toUpperCase(); const d = document.getElementById('nueva-seccion-descripcion').value.trim().toUpperCase(); const c = parseInt(document.getElementById('nueva-seccion-cantidad').value) || 1; if (!l || !d) { UI.showToast('COMPLETE LOS CAMPOS', 'error'); return; } try { for (let i = 1; i <= c; i++) await DB.addSeccion(l, d, String(i)); await DB.addMovimiento({ tipo: 'CREACION_SECCION', insumo: `SECCIÓN ${l}`, cantidad: c }); await this.loadAllData(); this.mostrarContenidoSecciones(); this.renderDashboard(); UI.showToast('SECCIÓN CREADA', 'success'); } catch (e) { UI.showToast('ERROR', 'error'); } },
    async eliminarSeccionCompleta(sec) { if (!confirm('¿ELIMINAR SECCIÓN ' + sec + '?')) return; const items = this.state.secciones.filter(s => s.seccion === sec); try { await DB.addMovimiento({ tipo: 'ELIMINACION_SECCION', insumo: `SECCIÓN ${sec}`, cantidad: items.length }); for (const item of items) await DB.deleteSeccion(item.id); await this.loadAllData(); this.mostrarContenidoSecciones(); UI.showToast('SECCIÓN ELIMINADA', 'success'); } catch (e) { UI.showToast('ERROR', 'error'); } },

    editarInsumo(id) {
        const i = this.state.inventario.find(x => x.id === id); if (!i) return;
        const esB = window.currentBodega === 'BOTIQUIN';
        const anaq = this.state.secciones.map(s => s.seccion+s.anaquel).sort();
        const und = this.state.unidades.map(u => u.nombre).sort();
        const esMovil = window.innerWidth <= 768;
        const campoA = esB ? '' : `<div class="form-group"><label>ANAQUEL *</label><select id="edit-anaquel">${anaq.map(a => `<option value="${a}" ${a===i.anaquel?'selected':''}>${a}</option>`).join('')}</select></div>`;
        const botonEscaner = esMovil ? `<div class="form-group"><button type="button" class="btn btn-info btn-block" onclick="App.abrirEscanner('edicion')" style="margin-bottom:10px;"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 7V5a2 2 0 0 1 2-2h2"/><path d="M17 3h2a2 2 0 0 1 2 2v2"/><path d="M21 17v2a2 2 0 0 1-2 2h-2"/><path d="M7 21H5a2 2 0 0 1-2-2v-2"/><line x1="7" y1="12" x2="17" y2="12"/></svg> ESCANEAR CÓDIGO DE BARRAS</button></div>` : '';
        UI.openModal(`<h2>EDITAR #${i.id}</h2>${botonEscaner}<div id="scanner-container-edicion" style="display:none;margin-bottom:10px;"></div><div class="form-group"><label>NOMBRE *</label><input type="text" id="edit-nombre" value="${i.nombre||''}" style="text-transform:uppercase;"></div><div class="form-group"><label>CÓDIGO DE BARRAS</label><input type="text" id="edit-codigo-barras" value="${i.codigo_barras||''}" onkeypress="if(event.key==='Enter'){event.preventDefault();App.buscarPorCodigoBarrasEdicion();}"></div>${campoA}<div class="form-row"><div class="form-group"><label>STOCK</label><input type="number" id="edit-stock" value="${i.stock}" min="0"></div><div class="form-group"><label>UNIDAD</label><select id="edit-unidad"><option value="">SELECCIONE...</option>${und.map(u => `<option value="${u}" ${u===i.unidad?'selected':''}>${u}</option>`).join('')}</select></div></div><div class="form-row"><div class="form-group"><label>LOTE</label><input type="text" id="edit-lote" value="${i.lote||''}" style="text-transform:uppercase;"></div><div class="form-group"><label>VENCIMIENTO</label><input type="date" id="edit-vencimiento" value="${i.vencimiento||''}"></div></div><div class="form-group"><label>COMENTARIOS</label><textarea id="edit-comentarios" style="text-transform:uppercase;">${i.comentarios||''}</textarea></div><div class="form-actions"><button class="btn btn-secondary" onclick="UI.closeModal()">CANCELAR</button><button class="btn btn-success" onclick="App.procesarEdicion(${id})">${UI.icons.edit} GUARDAR</button></div>`);
    },
    async procesarEdicion(id) { const i = this.state.inventario.find(x => x.id === id); if (!i) return; const esB = window.currentBodega === 'BOTIQUIN'; const an = esB ? i.anaquel : document.getElementById('edit-anaquel').value; const ns = parseInt(document.getElementById('edit-stock').value); const up = { nombre: document.getElementById('edit-nombre').value.trim().toUpperCase(), seccion: esB ? 'B' : an.charAt(0), anaquel: an, stock: ns, codigo_barras: this.limpiarCodigoBarras(document.getElementById('edit-codigo-barras').value) || null, unidad: document.getElementById('edit-unidad').value, lote: document.getElementById('edit-lote').value.trim().toUpperCase(), vencimiento: document.getElementById('edit-vencimiento').value || null, comentarios: document.getElementById('edit-comentarios').value.trim().toUpperCase() }; if (!up.nombre || isNaN(ns) || ns < 0) { UI.showToast('COMPLETE LOS CAMPOS', 'error'); return; } try { await DB.updateInventarioItem(id, up); await DB.addMovimiento({ tipo: 'EDICION', insumo: up.nombre, cantidad: ns !== i.stock ? Math.abs(ns - i.stock) : 0, stock_anterior: i.stock, stock_nuevo: ns, anaquel: an }); UI.closeModal(); UI.showToast('INSUMO ACTUALIZADO', 'success'); await this.loadAllData(); this.renderDashboard(); this.renderInventario(); } catch (e) { UI.showToast('ERROR', 'error'); } },
    async eliminarInsumo(id) { const i = this.state.inventario.find(x => x.id === id); if (!i || !confirm('¿ELIMINAR?')) return; try { await DB.addMovimiento({ tipo: 'ELIMINACION', insumo: i.nombre, cantidad: 0, stock_anterior: i.stock }); await DB.deleteInventarioItem(id); UI.showToast('INSUMO ELIMINADO', 'success'); await this.loadAllData(); this.renderDashboard(); this.renderInventario(); } catch (e) { UI.showToast('ERROR', 'error'); } },

    async showGestionUsuariosModal() { if (!window.currentUser || window.currentUser.rol !== 'admin') return; const { data: u } = await supabaseClient.from('usuarios').select('*').order('created_at', { ascending: false }); let h = '<h2>GESTIONAR USUARIOS</h2>'; if (u && u.length > 0) { h += '<div class="table-container"><table><thead><tr><th>USUARIO</th><th>NOMBRE</th><th class="text-center">ROL</th><th class="text-center">ESTADO</th><th class="text-center">ACCIÓN</th></tr></thead><tbody>'; u.forEach(p => { h += `<tr><td><strong>${p.usuario}</strong></td><td>${p.nombre||'-'}</td><td class="text-center">${p.rol==='admin'?'<span class="badge badge-danger">ADMIN</span>':(p.rol==='usuario'?'<span class="badge badge-info">USUARIO</span>':'<span class="badge badge-warning">PENDIENTE</span>')}</td><td class="text-center">${p.activo?'<span class="badge badge-success">ACTIVO</span>':'<span class="badge badge-warning">PENDIENTE</span>'}</td><td class="text-center">${!p.activo?`<button class="btn btn-success btn-sm" onclick="App.activarUsuario(${p.id})">ACTIVAR</button>`:''}${p.rol!=='admin'&&p.activo?`<button class="btn btn-danger btn-sm" onclick="App.desactivarUsuario(${p.id})">DESACTIVAR</button>`:''}</td></tr>`; }); h += '</tbody></table></div>'; } UI.openModal(h + '<div class="form-actions"><button class="btn btn-secondary" onclick="UI.closeModal()">CERRAR</button></div>'); },
    async activarUsuario(id) { await supabaseClient.from('usuarios').update({ activo: true, rol: 'usuario' }).eq('id', id); UI.showToast('USUARIO ACTIVADO', 'success'); this.showGestionUsuariosModal(); },
    async desactivarUsuario(id) { if (!confirm('¿DESACTIVAR?')) return; await supabaseClient.from('usuarios').update({ activo: false }).eq('id', id); UI.showToast('USUARIO DESACTIVADO', 'success'); this.showGestionUsuariosModal(); },

    exportarExcel() { const { inventario } = this.state; if (!inventario.length) { UI.showToast('SIN DATOS', 'warning'); return; } let csv = 'ID;NOMBRE;ANAQUEL;STOCK;UNIDAD;LOTE;VENCIMIENTO;CODIGO_BARRAS;COMENTARIOS\n'; inventario.forEach(i => { csv += `${i.id};"${i.nombre}";${i.anaquel};${i.stock};${i.unidad||''};${i.lote||''};${i.vencimiento||''};${i.codigo_barras||''};"${i.comentarios||''}"\n`; }); const b = new Blob(['\uFEFF'+csv], {type:'text/csv;charset=utf-8;'}); const u = URL.createObjectURL(b); const a = document.createElement('a'); a.href = u; a.download = `INVENTARIO_${window.currentBodega}_${new Date().toISOString().split('T')[0]}.csv`; a.click(); URL.revokeObjectURL(u); UI.showToast('EXPORTADO', 'success'); },
    exportarMovimientosExcel() { const ft = document.getElementById('busqueda-movimientos')?.value?.trim().toLowerCase()||''; const fT = document.getElementById('filtro-tipo-movimiento')?.value||'TODOS'; const fU = document.getElementById('filtro-usuario-movimiento')?.value||'TODOS'; let m = [...this.state.movimientos]; if (fT!=='TODOS') m = m.filter(x => x.tipo===fT); if (fU!=='TODOS') m = m.filter(x => (x.usuario||'SISTEMA')===fU); if (ft) m = m.filter(x => (x.insumo&&x.insumo.toLowerCase().includes(ft))||(x.anaquel&&x.anaquel.toLowerCase().includes(ft))); if (!m.length) { UI.showToast('SIN DATOS', 'warning'); return; } let csv = 'USUARIO;FECHA;TIPO;INFO.;CANTIDAD;STOCK ANT.;STOCK NUEVO;ANAQUEL;COMENTARIOS\n'; m.forEach(x => { csv += `"${x.usuario||'SISTEMA'}";"${new Date(x.fecha).toLocaleString('es-CL')}";${this.formatearTipo(x.tipo)};"${x.insumo||''}";${x.cantidad||0};${x.stock_anterior!=null?x.stock_anterior:''};${x.stock_nuevo!=null?x.stock_nuevo:''};${x.anaquel||''};"${x.comentarios||''}"\n`; }); const b = new Blob(['\uFEFF'+csv], {type:'text/csv;charset=utf-8;'}); const u = URL.createObjectURL(b); const a = document.createElement('a'); a.href = u; a.download = `MOVIMIENTOS_${window.currentBodega}_${new Date().toISOString().split('T')[0]}.csv`; a.click(); URL.revokeObjectURL(u); UI.showToast(`${m.length} MOVIMIENTOS EXPORTADOS`, 'success'); }
};

document.addEventListener('DOMContentLoaded', () => App.init());
