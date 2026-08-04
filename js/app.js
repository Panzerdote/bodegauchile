const App = {
    state: { inventario: [], secciones: [], unidades: [], movimientos: [], config: { porcentaje_critico: 20, dias_vencimiento: 30 } },

    async init() {
        try {
            UI.setConnectionStatus('warning', 'CONECTANDO...');
            if (typeof supabaseClient === 'undefined') throw new Error('CLIENTE NO INICIALIZADO');
            UI.setupMobileMenu();
            await this.loadAllData();
            this.setupEventListeners();
            UI.setConnectionStatus('success', 'CONECTADO');
            this.verificarConfiguracionInicial();
        } catch (error) { 
            console.error(error); 
            UI.setConnectionStatus('error', 'ERROR'); 
            UI.showToast('ERROR AL CONECTAR', 'error'); 
        }
    },

    verificarConfiguracionInicial() {
        const bodega = window.currentBodega || 'BODEGA';
        const esBotiquin = bodega === 'BOTIQUIN';
        const sinSecciones = this.state.secciones.length === 0;
        const sinUnidades = this.state.unidades.length === 0;
        if (esBotiquin) { 
            if (sinUnidades) { UI.showToast('NO TIENES UNIDADES DE MEDIDA CONFIGURADAS. CONFIGÚRALAS ANTES DE USAR EL SISTEMA.', 'warning'); } 
        } else { 
            if (sinSecciones && sinUnidades) { 
                UI.showToast('NO TIENES ANAQUELES NI UNIDADES DE MEDIDA CONFIGURADOS. CONFIGÚRALOS ANTES DE EMPEZAR A INGRESAR DATOS.', 'warning'); 
            } else if (sinSecciones) { 
                UI.showToast('NO TIENES ANAQUELES CONFIGURADOS. CONFIGÚRALOS ANTES DE EMPEZAR A INGRESAR DATOS.', 'warning'); 
            } else if (sinUnidades) { 
                UI.showToast('NO TIENES UNIDADES DE MEDIDA CONFIGURADAS. CONFIGÚRALAS ANTES DE USAR EL SISTEMA.', 'warning'); 
            } 
        }
    },

    async loadAllData() {
        const b = window.currentBodega || 'BODEGA';
        const [inventario, secciones, unidades, config, movimientos] = await Promise.all([
            DB.getInventario(b), 
            DB.getSecciones(b), 
            DB.getUnidadesMedida(b), 
            DB.getConfig(b), 
            DB.getTodosMovimientos(b)
        ]);
        this.state.inventario = inventario || []; 
        this.state.secciones = secciones || []; 
        this.state.unidades = unidades || [];
        this.state.config = config || { porcentaje_critico: 20, dias_vencimiento: 30 }; 
        this.state.movimientos = movimientos || [];
    },

    setupEventListeners() {
        const elements = {
            'btn-ingreso': () => this.abrirIngreso(),
            'btn-salida': () => this.abrirSalida(),
            'btn-buscar-anaquel': () => this.showBusquedaAnaquelModal(),
            'btn-gestionar': () => this.showGestionSeccionesModal(),
            'btn-exportar': () => this.exportarExcel(),
            'btn-admin-usuarios': () => this.showGestionUsuariosModal()
        };

        Object.entries(elements).forEach(([id, handler]) => {
            const el = document.getElementById(id);
            if (el) {
                el.addEventListener('click', (e) => {
                    e.preventDefault();
                    handler();
                });
            }
        });
        
        document.addEventListener('keydown', (e) => { 
            if (e.key === 'Escape') {
                UI.closeModal();
                if (typeof Scanner !== 'undefined') Scanner.stop();
            }
        });
    },

    abrirIngreso() {
        if (typeof Modales !== 'undefined') {
            Modales.showIngreso(this.state);
        }
    },

    abrirSalida() {
        if (typeof Modales !== 'undefined') {
            Modales.showSalida(this.state);
        }
    },

    esStockCritico(item) {
        if (!item.stock || item.stock === 0) return true;
        const movs = this.state.movimientos.filter(m => 
            m.insumo && item.nombre && 
            m.insumo.toLowerCase() === item.nombre.toLowerCase() && 
            m.anaquel === item.anaquel
        );
        if (movs.length === 0) return false;
        if (!movs.some(m => m.tipo === 'SALIDA')) return false;
        const maxs = movs.map(m => m.stock_nuevo || 0); 
        const sm = Math.max(...maxs, item.stock);
        if (sm === 0) return false;
        return (item.stock / sm) * 100 <= this.state.config.porcentaje_critico;
    },

    async buscarCoincidencias(tipo) {
        const input = document.getElementById(tipo === 'ing' ? 'ing-nombre' : 'sal-busqueda');
        const sugerencias = document.getElementById(tipo === 'ing' ? 'sugerencias-ing' : 'sugerencias-sal');
        if (!input || !sugerencias) return;
        const busqueda = input.value.trim(); 
        if (busqueda.length < 1) { sugerencias.style.display = 'none'; return; }
        try {
            const resultados = await DB.buscarInsumosNombre(busqueda);
            if (resultados.length === 0) { sugerencias.style.display = 'none'; return; }
            let html = ''; 
            resultados.forEach(item => { 
                const ne = item.nombre.replace(/'/g, "\\'"); 
                const ue = (item.unidad || '').replace(/'/g, "\\'"); 
                html += `<div onclick="App.seleccionarSugerencia('${tipo}', '${ne}', '${ue}')" style="padding:8px 12px; cursor:pointer; border-bottom:1px solid #eee; font-size:13px;" onmouseover="this.style.background='#eef2f7'" onmouseout="this.style.background='white'"><strong>${item.nombre}</strong>${item.unidad ? `<span style="color:#888; font-size:11px;">(${item.unidad})</span>` : ''}</div>`; 
            });
            sugerencias.innerHTML = html; 
            sugerencias.style.display = 'block';
        } catch (error) { console.error('Error al buscar coincidencias:', error); }
    },

    seleccionarSugerencia(tipo, nombre, unidad) {
        if (tipo === 'ing') { 
            const ingNombre = document.getElementById('ing-nombre');
            if (ingNombre) ingNombre.value = nombre; 
            if (unidad) { 
                const s = document.getElementById('ing-unidad');
                if (s) {
                    for (let i = 0; i < s.options.length; i++) { 
                        if (s.options[i].value === unidad) { s.selectedIndex = i; break; } 
                    }
                }
            } 
            const sugIng = document.getElementById('sugerencias-ing');
            if (sugIng) sugIng.style.display = 'none'; 
        } else { 
            const salBusqueda = document.getElementById('sal-busqueda');
            if (salBusqueda) salBusqueda.value = nombre; 
            const sugSal = document.getElementById('sugerencias-sal');
            if (sugSal) sugSal.style.display = 'none'; 
            this.buscarInsumoSalida(); 
        }
    },

    async buscarAnaquelesIngreso() {
        const input = document.getElementById('ing-anaquel');
        const sugerencias = document.getElementById('sugerencias-anaquel');
        if (!input || !sugerencias) return;
        
        const busqueda = input.value.trim();
        
        try {
            const resultados = await DB.buscarAnaqueles(busqueda);
            
            if (resultados.length === 0) {
                sugerencias.style.display = 'none';
                return;
            }
            
            let html = '';
            resultados.forEach(a => {
                html += `<div onclick="App.seleccionarAnaquel('${a}')" style="padding:8px 12px;cursor:pointer;border-bottom:1px solid #eee;font-size:13px;" onmouseover="this.style.background='#eef2f7'" onmouseout="this.style.background='white'"><strong>${a}</strong></div>`;
            });
            
            sugerencias.innerHTML = html;
            sugerencias.style.display = 'block';
        } catch (error) {
            console.error('Error al buscar anaqueles:', error);
        }
    },

    seleccionarAnaquel(anaquel) {
        const input = document.getElementById('ing-anaquel');
        const sugerencias = document.getElementById('sugerencias-anaquel');
        if (input) input.value = anaquel;
        if (sugerencias) sugerencias.style.display = 'none';
    },

    async buscarPorCodigoBarrasIngreso() {
        const codigoInput = document.getElementById('ing-codigo-barras');
        if (!codigoInput) return;
        const codigo = limpiarCodigoBarras(codigoInput.value);
        if (!codigo) return;
        codigoInput.value = codigo;
        try {
            const resultados = await DB.buscarPorCodigoBarras(codigo);
            if (resultados.length > 0) {
                const item = resultados[0];
                const ingNombre = document.getElementById('ing-nombre');
                const ingUnidad = document.getElementById('ing-unidad');
                const ingAnaque = document.getElementById('ing-anaquel');
                const ingVenc = document.getElementById('ing-vencimiento');
                
                if (ingNombre) ingNombre.value = item.nombre;
                if (ingUnidad) ingUnidad.value = item.unidad || '';
                if (ingAnaque) ingAnaque.value = item.anaquel;
                if (ingVenc) ingVenc.value = item.vencimiento || '';
                
                this.construirSelectorLotesIngreso(resultados, item);
                UI.showToast('INSUMO ENCONTRADO: ' + item.nombre + ' | ' + resultados.length + ' LOTE(S)', 'success');
            } else { 
                const loteContainer = document.getElementById('ing-lote-container');
                if (loteContainer) loteContainer.innerHTML = '<input type="text" id="ing-lote" style="text-transform:uppercase;">';
                UI.showToast('CÓDIGO NUEVO. COMPLETE LOS DATOS.', 'warning'); 
            }
        } catch (e) { UI.showToast('ERROR AL BUSCAR CÓDIGO', 'error'); }
    },

    construirSelectorLotesIngreso(resultados, itemSeleccionado) {
        const container = document.getElementById('ing-lote-container');
        if (!container) return;
        const lotesUnicos = [];
        const lotesVistos = new Set();
        resultados.forEach(r => {
            const loteKey = (r.lote || 'SIN LOTE').toUpperCase();
            if (!lotesVistos.has(loteKey)) {
                lotesVistos.add(loteKey);
                lotesUnicos.push(r);
            }
        });
        let html = '<select id="ing-lote" onchange="App.seleccionarLoteIngreso()" style="width:100%;padding:8px 10px;border:1px solid #ddd;border-radius:5px;font-size:13px;font-family:inherit;">';
        html += '<option value="">SELECCIONE UN LOTE...</option>';
        lotesUnicos.forEach(r => {
            const selected = (r.lote || '') === (itemSeleccionado.lote || '') ? ' selected' : '';
            const loteStr = r.lote || 'SIN LOTE';
            const vencStr = r.vencimiento || 'SIN VENC.';
            const stockStr = r.stock || 0;
            html += `<option value="${escapeHtml(r.lote || '')}" data-vencimiento="${r.vencimiento || ''}" data-unidad="${escapeHtml(r.unidad || '')}" data-anaquel="${escapeHtml(r.anaquel || '')}"${selected}>${loteStr} | VENC: ${vencStr} | STOCK: ${stockStr}</option>`;
        });
        html += '<option value="__NUEVO_LOTE__">➕ INGRESAR LOTE NUEVO...</option>';
        html += '</select>';
        container.innerHTML = html;
    },

    seleccionarLoteIngreso() {
        const select = document.getElementById('ing-lote');
        if (!select) return;
        const selectedValue = select.value;
        if (selectedValue === '__NUEVO_LOTE__') {
            const container = document.getElementById('ing-lote-container');
            if (container) container.innerHTML = '<input type="text" id="ing-lote" style="text-transform:uppercase;" placeholder="INGRESE NUEVO LOTE...">';
            const ingVenc = document.getElementById('ing-vencimiento');
            if (ingVenc) {
                ingVenc.value = '';
                ingVenc.focus();
            }
            return;
        }
        if (!selectedValue) return;
        const selectedOption = select.options[select.selectedIndex];
        const vencimiento = selectedOption.getAttribute('data-vencimiento') || '';
        const unidad = selectedOption.getAttribute('data-unidad') || '';
        const anaquel = selectedOption.getAttribute('data-anaquel') || '';
        
        const ingVenc = document.getElementById('ing-vencimiento');
        const ingUnidad = document.getElementById('ing-unidad');
        const ingAnaque = document.getElementById('ing-anaquel');
        
        if (ingVenc) ingVenc.value = vencimiento;
        if (unidad && ingUnidad) ingUnidad.value = unidad;
        if (anaquel && ingAnaque) ingAnaque.value = anaquel;
        UI.showToast('DATOS DEL LOTE CARGADOS', 'success');
    },

    async procesarIngreso() {
        const esBotiquin = window.currentBodega === 'BOTIQUIN';
        const ingNombre = document.getElementById('ing-nombre');
        const ingAnaque = document.getElementById('ing-anaquel');
        const ingCantidad = document.getElementById('ing-cantidad');
        const ingUnidad = document.getElementById('ing-unidad');
        const ingLote = document.getElementById('ing-lote');
        const ingVenc = document.getElementById('ing-vencimiento');
        const ingCB = document.getElementById('ing-codigo-barras');
        const ingCom = document.getElementById('ing-comentarios');
        
        if (!ingNombre || !ingCantidad) return;
        
        const nombre = ingNombre.value.trim().toUpperCase();
        const anaquel = esBotiquin ? 'BOTIQUIN' : (ingAnaque ? ingAnaque.value.trim().toUpperCase() : '');
        const cantidad = parseInt(ingCantidad.value);
        const unidad = ingUnidad ? ingUnidad.value : '';
        const lote = ingLote ? (ingLote.tagName === 'SELECT' ? ingLote.value : ingLote.value.trim().toUpperCase()) : '';
        const vencimiento = ingVenc ? ingVenc.value : '';
        const codigoBarras = ingCB ? limpiarCodigoBarras(ingCB.value) : '';
        const comentarios = ingCom ? ingCom.value.trim().toUpperCase() : '';
        const loteFinal = (lote === '__NUEVO_LOTE__') ? '' : lote;
        
        if (!nombre || (!esBotiquin && !anaquel) || !cantidad || cantidad <= 0) { 
            UI.showToast('COMPLETE LOS CAMPOS (*)', 'error'); 
            return; 
        }
        const seccion = esBotiquin ? 'B' : anaquel.charAt(0);
        try { 
            await DB.procesarIngreso(nombre, seccion, anaquel, cantidad, unidad, loteFinal, vencimiento, codigoBarras || null, comentarios); 
            UI.closeModal(); 
            UI.showToast('INGRESO REGISTRADO', 'success'); 
            await this.loadAllData(); 
        } catch (e) { UI.showToast('ERROR: ' + e.message, 'error'); }
    },

    buscarCoincidenciasSalida() {
        const af = document.getElementById('sal-anaquel-filtro')?.value;
        const input = document.getElementById('sal-busqueda'); 
        const sug = document.getElementById('sugerencias-sal');
        if (!input || !sug) return;
        const b = input.value.trim().toLowerCase(); 
        if (b.length < 1) { sug.style.display = 'none'; this.buscarInsumoSalida(); return; }
        let r = this.state.inventario.filter(i => i.stock > 0 && i.nombre.toLowerCase().includes(b));
        if (af) r = r.filter(i => i.anaquel === af);
        if (r.length === 0) { sug.style.display = 'none'; return; }
        let h = ''; 
        r.slice(0, 10).forEach(i => { 
            const nombreEscapado = i.nombre.replace(/'/g, "\\'");
            h += `<div onclick="App.seleccionarSugerenciaSalida('${nombreEscapado}')" style="padding:8px 12px;cursor:pointer;border-bottom:1px solid #eee;font-size:13px;" onmouseover="this.style.background='#eef2f7'" onmouseout="this.style.background='white'"><strong>${i.nombre}</strong><span style="color:#888;font-size:11px;">STOCK: ${i.stock} | ${i.anaquel}${i.lote?` | LOTE: ${i.lote}`:''}${i.vencimiento?` | VENC: ${i.vencimiento}`:''}${i.codigo_barras?` | CB: ${i.codigo_barras}`:''}</span></div>`; 
        });
        sug.innerHTML = h; 
        sug.style.display = 'block';
    },

    seleccionarSugerenciaSalida(nombre) { 
        const salBusqueda = document.getElementById('sal-busqueda');
        if (salBusqueda) salBusqueda.value = nombre; 
        const sugSal = document.getElementById('sugerencias-sal');
        if (sugSal) sugSal.style.display = 'none'; 
        this.buscarInsumoSalida(); 
    },

    buscarInsumoSalida() {
        const af = document.getElementById('sal-anaquel-filtro')?.value; 
        const salBusqueda = document.getElementById('sal-busqueda');
        const b = salBusqueda ? salBusqueda.value.trim().toLowerCase() : '';
        let r = this.state.inventario.filter(i => i.stock > 0); 
        if (af) r = r.filter(i => i.anaquel === af); 
        if (b) r = r.filter(i => i.nombre.toLowerCase().includes(b));
        const c = document.getElementById('resultados-busqueda'); 
        if (!c) return;
        if (r.length === 0) { c.innerHTML = '<p style="padding:15px;">NO SE ENCONTRARON INSUMOS.</p>'; return; }
        let h = '<div style="max-height:400px;overflow-y:auto;">';
        r.forEach(i => { 
            h += `<div style="border:1px solid #ddd;padding:12px;margin:5px 0;border-radius:5px;display:flex;justify-content:space-between;"><div><strong>${i.nombre}</strong><br><small>STOCK: ${i.stock} ${i.unidad||''} | ANAQUEL: ${i.anaquel}${i.lote?` | LOTE: <span class="badge badge-info">${i.lote}</span>`:''}${i.vencimiento?` | VENC: ${i.vencimiento}`:''}${i.codigo_barras?` | CB: ${i.codigo_barras}`:''}</small></div><button class="btn btn-danger btn-sm" onclick="App.prepararSalida(${i.id})">RETIRAR</button></div>`; 
        });
        h += '</div>'; 
        c.innerHTML = h;
    },

    async buscarPorCodigoBarrasSalida(codigo) {
        const codigoLimpio = limpiarCodigoBarras(codigo);
        if (!codigoLimpio) return;
        try {
            const resultados = await DB.buscarPorCodigoBarras(codigoLimpio);
            if (resultados.length > 0) {
                const itemsConStock = resultados.filter(i => i.stock > 0);
                if (itemsConStock.length === 0) { UI.showToast('SIN STOCK DISPONIBLE', 'warning'); return; }
                if (itemsConStock.length === 1) { this.prepararSalida(itemsConStock[0].id); return; }
                let h = '<div style="max-height:400px;overflow-y:auto;">';
                itemsConStock.forEach(i => { 
                    h += `<div style="border:1px solid #ddd;padding:12px;margin:5px 0;border-radius:5px;display:flex;justify-content:space-between;"><div><strong>${i.nombre}</strong><br><small>STOCK: ${i.stock} ${i.unidad||''} | ${i.anaquel}${i.lote?` | LOTE: ${i.lote}`:''}${i.vencimiento?` | VENC: ${i.vencimiento}`:''}</small></div><button class="btn btn-danger btn-sm" onclick="App.prepararSalida(${i.id})">RETIRAR</button></div>`; 
                });
                h += '</div>';
                UI.openModal(`<h2>SELECCIONE LOTE</h2>${h}<div class="form-actions"><button class="btn btn-secondary" onclick="UI.closeModal()">CANCELAR</button></div>`);
            } else { UI.showToast('CÓDIGO NO ENCONTRADO', 'warning'); }
        } catch (e) { UI.showToast('ERROR AL BUSCAR', 'error'); }
    },

    prepararSalida(id) { 
        if (typeof Modales !== 'undefined') {
            Modales.prepararSalida(id, this.state);
        }
    },

    async procesarSalida(id) { 
        const salCantidad = document.getElementById('sal-cantidad');
        const salCom = document.getElementById('sal-comentarios');
        if (!salCantidad) return;
        const c = parseInt(salCantidad.value); 
        const co = salCom ? salCom.value.trim().toUpperCase() : ''; 
        if (!c || c <= 0) { UI.showToast('CANTIDAD INVÁLIDA', 'error'); return; } 
        try { 
            const r = await DB.procesarSalida(id, c, co); 
            UI.closeModal(); 
            UI.showToast('SALIDA REGISTRADA' + (r.stockNuevo <= 5 ? ' - STOCK BAJO' : ''), r.stockNuevo <= 5 ? 'warning' : 'success'); 
            await this.loadAllData(); 
        } catch (e) { UI.showToast('ERROR: ' + e.message, 'error'); } 
    },

    showBusquedaAnaquelModal() { 
        if (window.currentBodega === 'BOTIQUIN') return; 
        UI.openModal(`<h2>BUSCAR ANAQUEL</h2><div class="form-group"><label>ANAQUEL</label><select id="bus-anaquel" onchange="App.buscarAnaquel()"><option value="">SELECCIONE...</option>${this.state.secciones.map(s => s.seccion+s.anaquel).sort().map(a => `<option value="${a}">${a}</option>`).join('')}</select></div><div id="resultado-anaquel"></div><div class="form-actions"><button class="btn btn-secondary" onclick="UI.closeModal()">CERRAR</button></div>`); 
    },

    buscarAnaquel() { 
        const busAnaque = document.getElementById('bus-anaquel');
        if (!busAnaque) return;
        const a = busAnaque.value; 
        if (!a) return; 
        const items = this.state.inventario.filter(i => i.anaquel === a); 
        const c = document.getElementById('resultado-anaquel'); 
        if (!c) return;
        let h = `<h3>ANAQUEL: <span class="badge badge-info">${a}</span></h3>`; 
        if (items.length === 0) h += '<p>VACÍO.</p>'; 
        else { 
            h += '<div class="table-container"><table><thead><tr><th>INSUMO</th><th class="text-center">STOCK</th><th class="text-center">UND.</th><th class="text-center">LOTE</th><th class="text-center">VENC.</th></tr></thead><tbody>'; 
            items.forEach(i => { h += `<tr><td><strong>${i.nombre}</strong></td><td class="text-center">${i.stock}</td><td class="text-center">${i.unidad||''}</td><td class="text-center">${i.lote||'-'}</td><td class="text-center">${i.vencimiento||'-'}</td></tr>`; }); 
            h += '</tbody></table></div>'; 
        } 
        c.innerHTML = h; 
    },

    showGestionSeccionesModal() {
        const esBotiquin = window.currentBodega === 'BOTIQUIN';
        let h = '<h2>CONFIGURACIÓN</h2>';
        if (esBotiquin) { 
            h += '<div id="tab-contenido"></div>'; 
        } else { 
            h += `<div style="display:flex;gap:0;margin-bottom:20px;border-bottom:2px solid #e0e0e0;"><button class="btn btn-light" onclick="App.mostrarTabConfig('secciones')" id="tab-secciones" style="border-radius:5px 5px 0 0;border:2px solid #e0e0e0;border-bottom:2px solid var(--primary);background:white;font-weight:bold;"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg> SECCIONES</button><button class="btn btn-light" onclick="App.mostrarTabConfig('unidades')" id="tab-unidades" style="border-radius:5px 5px 0 0;border:2px solid transparent;background:transparent;"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg> UNIDADES</button></div><div id="tab-contenido"></div>`; 
        }
        UI.openModal(h); 
        if (esBotiquin) { this.mostrarContenidoUnidades(); } else { this.mostrarTabConfig('secciones'); }
    },

    mostrarTabConfig(tab) { 
        if (window.currentBodega === 'BOTIQUIN') { this.mostrarContenidoUnidades(); return; } 
        const tabSecciones = document.getElementById('tab-secciones');
        const tabUnidades = document.getElementById('tab-unidades');
        if (tabSecciones) {
            tabSecciones.style.borderBottom = tab === 'secciones' ? '2px solid var(--primary)' : '2px solid transparent'; 
            tabSecciones.style.background = tab === 'secciones' ? 'white' : 'transparent'; 
            tabSecciones.style.fontWeight = tab === 'secciones' ? 'bold' : 'normal'; 
        }
        if (tabUnidades) {
            tabUnidades.style.borderBottom = tab === 'unidades' ? '2px solid var(--primary)' : '2px solid transparent'; 
            tabUnidades.style.background = tab === 'unidades' ? 'white' : 'transparent'; 
            tabUnidades.style.fontWeight = tab === 'unidades' ? 'bold' : 'normal'; 
        }
        if (tab === 'secciones') this.mostrarContenidoSecciones(); 
        else this.mostrarContenidoUnidades(); 
    },

    mostrarContenidoSecciones() { 
        const tabContenido = document.getElementById('tab-contenido');
        if (!tabContenido) return;
        let html = ''; 
        const ag = {}; 
        this.state.secciones.forEach(s => { 
            if (!ag[s.seccion]) ag[s.seccion] = { d: s.descripcion || 'SIN DESCRIPCIÓN', a: [] }; 
            ag[s.seccion].a.push(s.anaquel); 
        }); 
        const keys = Object.keys(ag).sort(); 
        if (keys.length === 0) html += `<div class="empty-state"><p>NO HAY SECCIONES.</p></div>`; 
        else { 
            html += '<div style="display:grid;gap:15px;margin-bottom:20px;">'; 
            keys.forEach(sec => { 
                const info = ag[sec]; 
                const ao = info.a.sort((a,b) => a.localeCompare(b,undefined,{numeric:true})); 
                html += `<div style="border:2px solid #e0e0e0;border-radius:10px;padding:15px;"><div style="display:flex;justify-content:space-between;margin-bottom:12px;"><div><span style="font-size:20px;font-weight:bold;color:var(--primary);">SECCIÓN ${sec}</span><span style="margin-left:10px;">— ${info.d}</span></div><button class="btn btn-danger btn-sm" onclick="App.eliminarSeccionCompleta('${sec}')">${UI.icons.trash} ELIMINAR</button></div><div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:12px;">${ao.map(a => `<span style="background:var(--primary);color:white;padding:6px 12px;border-radius:20px;font-size:13px;">${sec}${a}<button onclick="event.stopPropagation();App.eliminarAnaquelIndividual('${sec}','${a}')" style="background:rgba(255,255,255,0.3);border:none;color:white;cursor:pointer;padding:2px 6px;border-radius:50%;">×</button></span>`).join('')}</div><button class="btn btn-info btn-sm" onclick="App.mostrarAgregarAnaquel('${sec}')">${UI.icons.plus} AGREGAR</button></div>`; 
            }); 
            html += '</div>'; 
        } 
        html += `<h3 style="margin-top:25px;padding-top:20px;border-top:2px solid #eee;">CREAR SECCIÓN</h3><div class="form-row"><div class="form-group"><label>LETRA *</label><input type="text" id="nueva-seccion-letra" maxlength="1" placeholder="A" style="text-transform:uppercase;"></div><div class="form-group"><label>DESCRIPCIÓN *</label><input type="text" id="nueva-seccion-descripcion" placeholder="EJ: MATERIAL QUIRÚRGICO" style="text-transform:uppercase;"></div><div class="form-group"><label>CANTIDAD</label><input type="number" id="nueva-seccion-cantidad" value="1" min="1" max="50"></div></div><button class="btn btn-success" onclick="App.crearNuevaSeccion()">${UI.icons.plus} CREAR</button>`; 
        tabContenido.innerHTML = html; 
    },

    mostrarContenidoUnidades() { 
        const tabContenido = document.getElementById('tab-contenido');
        if (!tabContenido) return;
        const unidades = this.state.unidades.sort((a,b) => a.nombre.localeCompare(b.nombre)); 
        let html = '<p style="font-size:12px;color:#666;margin-bottom:15px;">CONFIGURE LAS UNIDADES DE MEDIDA DISPONIBLES.</p>'; 
        if (unidades.length === 0) html += '<div class="empty-state"><p>NO HAY UNIDADES.</p></div>'; 
        else { 
            html += '<div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:20px;">'; 
            unidades.forEach(u => { html += `<span style="background:var(--primary-light);color:white;padding:8px 14px;border-radius:20px;font-size:13px;">${u.nombre}<button onclick="App.eliminarUnidad(${u.id})" style="background:rgba(255,255,255,0.3);border:none;color:white;cursor:pointer;padding:2px 6px;border-radius:50%;">×</button></span>`; }); 
            html += '</div>'; 
        } 
        html += `<h3 style="margin-top:20px;padding-top:15px;border-top:2px solid #eee;">AGREGAR UNIDAD</h3><div class="form-group"><label>NOMBRE *</label><input type="text" id="nueva-unidad" placeholder="EJ: CAJA" style="text-transform:uppercase;"></div><button class="btn btn-success" onclick="App.agregarUnidad()">${UI.icons.plus} AGREGAR</button>`; 
        tabContenido.innerHTML = html; 
    },

    async agregarUnidad() { 
        const nuevaUnidad = document.getElementById('nueva-unidad');
        if (!nuevaUnidad) return;
        const n = nuevaUnidad.value.trim().toUpperCase(); 
        if (!n) { UI.showToast('INGRESE UN NOMBRE', 'error'); return; } 
        try { 
            await DB.addUnidadMedida(n); 
            await DB.addMovimiento({ tipo: 'CREACION_UNIDAD', insumo: `UNIDAD: ${n}`, cantidad: 0, comentarios: `UNIDAD CREADA` }); 
            await this.loadAllData(); 
            this.mostrarContenidoUnidades(); 
            UI.showToast('UNIDAD AGREGADA', 'success'); 
        } catch (e) { UI.showToast('ERROR: ' + e.message, 'error'); } 
    },

    async eliminarUnidad(id) { 
        const u = this.state.unidades.find(x => x.id === id); 
        if (!u || !confirm('¿ELIMINAR UNIDAD "' + u.nombre + '"?')) return; 
        try { 
            await DB.addMovimiento({ tipo: 'ELIMINACION_UNIDAD', insumo: `UNIDAD: ${u.nombre}`, cantidad: 0 }); 
            await DB.deleteUnidadMedida(id); 
            await this.loadAllData(); 
            this.mostrarContenidoUnidades(); 
            UI.showToast('UNIDAD ELIMINADA', 'success'); 
        } catch (e) { UI.showToast('ERROR: ' + e.message, 'error'); } 
    },

    async crearNuevaSeccion() { 
        const letra = document.getElementById('nueva-seccion-letra');
        const desc = document.getElementById('nueva-seccion-descripcion');
        const cant = document.getElementById('nueva-seccion-cantidad');
        if (!letra || !desc) return;
        const l = letra.value.trim().toUpperCase(); 
        const d = desc.value.trim().toUpperCase(); 
        const c = cant ? (parseInt(cant.value) || 1) : 1; 
        if (!l || !d) { UI.showToast('COMPLETE LOS CAMPOS', 'error'); return; } 
        try { 
            for (let i = 1; i <= c; i++) {
                // Formatear número: 1-9 -> 01-09, 10+ -> igual
                const anaquelFormateado = i < 10 ? '0' + i : String(i);
                await DB.addSeccion(l, d, anaquelFormateado);
            }
            await DB.addMovimiento({ tipo: 'CREACION_SECCION', insumo: `SECCIÓN ${l}`, cantidad: c }); 
            await this.loadAllData(); 
            this.mostrarContenidoSecciones(); 
            UI.showToast('SECCIÓN CREADA', 'success'); 
        } catch (e) { UI.showToast('ERROR: ' + e.message, 'error'); } 
    },

    async eliminarSeccionCompleta(sec) { 
        if (!confirm('¿ELIMINAR SECCIÓN ' + sec + ' Y TODOS SUS ANAQUELES?')) return; 
        const items = this.state.secciones.filter(s => s.seccion === sec); 
        try { 
            await DB.addMovimiento({ tipo: 'ELIMINACION_SECCION', insumo: `SECCIÓN ${sec}`, cantidad: items.length }); 
            for (const item of items) await DB.deleteSeccion(item.id); 
            await this.loadAllData(); 
            this.mostrarContenidoSecciones(); 
            UI.showToast('SECCIÓN ELIMINADA', 'success'); 
        } catch (e) { UI.showToast('ERROR: ' + e.message, 'error'); } 
    },

    getColorTipo(t) { 
        const c = {
            'INGRESO':'#27ae60','SALIDA':'#c0392b','EDICION':'#2980b9','ELIMINACION':'#e74c3c',
            'CREACION_SECCION':'#8e44ad','ELIMINACION_SECCION':'#c0392b',
            'CREACION_UNIDAD':'#16a085','ELIMINACION_UNIDAD':'#e67e22'
        }; 
        return c[t]||'#6c757d'; 
    },

    formatearTipo(t) { 
        const tf = {
            'INGRESO':'INGRESO','SALIDA':'SALIDA','EDICION':'EDICIÓN','ELIMINACION':'ELIMINACIÓN',
            'CREACION_SECCION':'CREACIÓN SECCIÓN','ELIMINACION_SECCION':'ELIMINACIÓN SECCIÓN',
            'CREACION_UNIDAD':'CREACIÓN UNIDAD','ELIMINACION_UNIDAD':'ELIMINACIÓN UNIDAD'
        }; 
        return tf[t]||t; 
    },

    exportarExcel() { 
        const { inventario } = this.state; 
        if (!inventario.length) { UI.showToast('SIN DATOS', 'warning'); return; } 
        let csv = 'ID;NOMBRE;ANAQUEL;STOCK;UNIDAD;LOTE;VENCIMIENTO;CODIGO_BARRAS;COMENTARIOS\n'; 
        inventario.forEach(i => { 
            csv += `${i.id};"${i.nombre}";${i.anaquel};${i.stock};${i.unidad||''};${i.lote||''};${i.vencimiento||''};'${i.codigo_barras||''};"${i.comentarios||''}"\n`; 
        }); 
        const b = new Blob(['\uFEFF'+csv], {type:'text/csv;charset=utf-8;'}); 
        const u = URL.createObjectURL(b); 
        const a = document.createElement('a'); 
        a.href = u; 
        a.download = `INVENTARIO_${window.currentBodega}_${new Date().toISOString().split('T')[0]}.csv`; 
        a.click(); 
        URL.revokeObjectURL(u); 
        UI.showToast('EXPORTADO', 'success'); 
    },

    async showGestionUsuariosModal() { 
        if (!window.currentUser || window.currentUser.rol !== 'admin') return; 
        const { data: u } = await supabaseClient.from('usuarios').select('*').order('created_at', { ascending: false }); 
        let h = '<h2>GESTIONAR USUARIOS</h2>'; 
        if (u && u.length > 0) { 
            h += '<div class="table-container"><table><thead><tr><th>USUARIO</th><th>NOMBRE</th><th class="text-center">ROL</th><th class="text-center">ESTADO</th><th class="text-center">ACCIÓN</th></tr></thead><tbody>'; 
            u.forEach(p => { 
                h += `<tr><td><strong>${p.usuario}</strong></td><td>${p.nombre||'-'}</td><td class="text-center">${p.rol==='admin'?'<span class="badge badge-danger">ADMIN</span>':(p.rol==='usuario'?'<span class="badge badge-info">USUARIO</span>':'<span class="badge badge-warning">PENDIENTE</span>')}</td><td class="text-center">${p.activo?'<span class="badge badge-success">ACTIVO</span>':'<span class="badge badge-warning">PENDIENTE</span>'}</td><td class="text-center">${!p.activo?`<button class="btn btn-success btn-sm" onclick="App.activarUsuario(${p.id})">ACTIVAR</button>`:''}${p.rol!=='admin'&&p.activo?`<button class="btn btn-danger btn-sm" onclick="App.desactivarUsuario(${p.id})">DESACTIVAR</button>`:''}</td></tr>`; 
            }); 
            h += '</tbody></table></div>'; 
        } 
        UI.openModal(h + '<div class="form-actions"><button class="btn btn-secondary" onclick="UI.closeModal()">CERRAR</button></div>'); 
    },

    async activarUsuario(id) { 
        await supabaseClient.from('usuarios').update({ activo: true, rol: 'usuario' }).eq('id', id); 
        UI.showToast('USUARIO ACTIVADO', 'success'); 
        this.showGestionUsuariosModal(); 
    },

    async desactivarUsuario(id) { 
        if (!confirm('¿DESACTIVAR USUARIO?')) return; 
        await supabaseClient.from('usuarios').update({ activo: false }).eq('id', id); 
        UI.showToast('USUARIO DESACTIVADO', 'success'); 
        this.showGestionUsuariosModal(); 
    }
};
