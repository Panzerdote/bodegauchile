const PlanillaSalida = {
    insumosSeleccionados: [],

    init() {
        this.actualizarEncabezado();
        this.setupListeners();
    },

    actualizarEncabezado() {
        const ahora = new Date();
        document.getElementById('planilla-fecha').textContent = ahora.toLocaleDateString('es-CL');
        document.getElementById('planilla-bodega').textContent = window.currentBodega;
        document.getElementById('entrega-nombre').textContent = window.currentUser.nombre || window.currentUser.usuario;
        document.getElementById('entrega-usuario').textContent = window.currentUser.usuario;
        document.getElementById('entrega-fecha').textContent = ahora.toLocaleString('es-CL');
        document.getElementById('firma-entrega-nombre').textContent = (window.currentUser.nombre || window.currentUser.usuario).toUpperCase();
    },

    setupListeners() {
        const inputBusqueda = document.getElementById('busqueda-insumo');
        const sugerencias = document.getElementById('sugerencias-busqueda');
        
        if (inputBusqueda) {
            inputBusqueda.addEventListener('input', () => this.buscarInsumos());
            inputBusqueda.addEventListener('focus', () => this.buscarInsumos());
            inputBusqueda.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    this.agregarPrimerResultado();
                }
            });
        }
        
        if (sugerencias) {
            document.addEventListener('click', (e) => {
                if (e.target !== inputBusqueda && !sugerencias.contains(e.target)) {
                    sugerencias.style.display = 'none';
                }
            });
        }
        
        const btnAgregar = document.getElementById('btn-agregar-insumo');
        if (btnAgregar) {
            btnAgregar.addEventListener('click', () => this.agregarPrimerResultado());
        }
        
        // Actualizar firma del receptor en tiempo real
        const receptorNombre = document.getElementById('receptor-nombre');
        if (receptorNombre) {
            receptorNombre.addEventListener('input', () => {
                document.getElementById('firma-receptor-nombre').textContent = 
                    receptorNombre.value.trim().toUpperCase() || '_________________';
            });
        }
    },

    buscarInsumos() {
        const input = document.getElementById('busqueda-insumo');
        const sugerencias = document.getElementById('sugerencias-busqueda');
        if (!input || !sugerencias) return;
        
        const busqueda = input.value.trim().toLowerCase();
        if (busqueda.length < 1) {
            sugerencias.style.display = 'none';
            return;
        }
        
        // Buscar en inventario por nombre o código de barras
        let resultados = App.state.inventario.filter(i => 
            i.stock > 0 && (
                i.nombre.toLowerCase().includes(busqueda) ||
                (i.codigo_barras && i.codigo_barras.toLowerCase().includes(busqueda))
            )
        );
        
        if (resultados.length === 0) {
            sugerencias.style.display = 'none';
            return;
        }
        
        let html = '';
        resultados.slice(0, 15).forEach(i => {
            const yaAgregado = this.insumosSeleccionados.find(x => x.id === i.id);
            const nombreEscapado = i.nombre.replace(/'/g, "\\'");
            html += `<div onclick="PlanillaSalida.agregarInsumo(${i.id})" 
                style="padding:10px 12px;cursor:pointer;border-bottom:1px solid #eee;font-size:12px;
                ${yaAgregado ? 'background:#e8f5e9;' : ''}"
                onmouseover="this.style.background='${yaAgregado ? '#c8e6c9' : '#eef2f7'}'" 
                onmouseout="this.style.background='${yaAgregado ? '#e8f5e9' : 'white'}'">
                <strong>${i.nombre}</strong>
                <span style="color:#888;font-size:11px;display:block;">
                    STOCK: ${i.stock} ${i.unidad||''} | ${i.anaquel}
                    ${i.lote ? ` | LOTE: ${i.lote}` : ''}
                    ${i.codigo_barras ? ` | CB: ${i.codigo_barras}` : ''}
                    ${yaAgregado ? ' ✅ YA AGREGADO' : ''}
                </span>
            </div>`;
        });
        
        sugerencias.innerHTML = html;
        sugerencias.style.display = 'block';
    },

    agregarPrimerResultado() {
        const input = document.getElementById('busqueda-insumo');
        const busqueda = input.value.trim().toLowerCase();
        
        const resultados = App.state.inventario.filter(i => 
            i.stock > 0 && (
                i.nombre.toLowerCase().includes(busqueda) ||
                (i.codigo_barras && i.codigo_barras.toLowerCase().includes(busqueda))
            )
        );
        
        if (resultados.length > 0) {
            this.agregarInsumo(resultados[0].id);
        }
    },

    agregarInsumo(id) {
        const item = App.state.inventario.find(i => i.id === id);
        if (!item) return;
        
        // Verificar si ya está agregado
        const existente = this.insumosSeleccionados.find(x => x.id === id);
        if (existente) {
            UI.showToast('ESTE INSUMO YA FUE AGREGADO', 'warning');
            return;
        }
        
        this.insumosSeleccionados.push({
            id: item.id,
            nombre: item.nombre,
            anaquel: item.anaquel,
            unidad: item.unidad || '',
            lote: item.lote || '',
            vencimiento: item.vencimiento || '',
            codigo_barras: item.codigo_barras || '',
            stock_disponible: item.stock,
            cantidad: 1
        });
        
        document.getElementById('busqueda-insumo').value = '';
        document.getElementById('sugerencias-busqueda').style.display = 'none';
        
        this.renderizarLista();
        UI.showToast('INSUMO AGREGADO: ' + item.nombre, 'success');
    },

    quitarInsumo(index) {
        const item = this.insumosSeleccionados[index];
        this.insumosSeleccionados.splice(index, 1);
        this.renderizarLista();
        UI.showToast('INSUMO QUITADO: ' + item.nombre, 'warning');
    },

    actualizarCantidad(index, nuevaCantidad) {
        const cantidad = parseInt(nuevaCantidad);
        const item = this.insumosSeleccionados[index];
        
        if (isNaN(cantidad) || cantidad < 1) {
            this.insumosSeleccionados[index].cantidad = 1;
        } else if (cantidad > item.stock_disponible) {
            this.insumosSeleccionados[index].cantidad = item.stock_disponible;
            UI.showToast('STOCK MÁXIMO: ' + item.stock_disponible, 'warning');
        } else {
            this.insumosSeleccionados[index].cantidad = cantidad;
        }
        
        this.renderizarLista();
    },

    renderizarLista() {
        const container = document.getElementById('lista-insumos');
        const totalSection = document.getElementById('total-section');
        
        if (this.insumosSeleccionados.length === 0) {
            container.innerHTML = `
                <div class="empty-planilla">
                    <p>NO HAY INSUMOS AGREGADOS.</p>
                    <p style="font-size:12px;">BUSQUE Y AGREGUE INSUMOS PARA GENERAR LA PLANILLA.</p>
                </div>`;
            totalSection.style.display = 'none';
            return;
        }
        
        let html = '';
        let totalItems = 0;
        let totalUnidades = 0;
        
        this.insumosSeleccionados.forEach((item, index) => {
            totalItems++;
            totalUnidades += item.cantidad;
            
            html += `
            <div class="insumo-item">
                <div class="info">
                    <strong>${item.nombre}</strong>
                    <small>
                        ANAQUEL: ${item.anaquel} | 
                        STOCK DISP: ${item.stock_disponible} ${item.unidad}
                        ${item.lote ? ` | LOTE: ${item.lote}` : ''}
                        ${item.vencimiento ? ` | VENC: ${item.vencimiento}` : ''}
                        ${item.codigo_barras ? ` | CB: ${item.codigo_barras}` : ''}
                    </small>
                </div>
                <input type="number" 
                    class="cantidad-input" 
                    value="${item.cantidad}" 
                    min="1" 
                    max="${item.stock_disponible}"
                    onchange="PlanillaSalida.actualizarCantidad(${index}, this.value)">
                <span style="font-size:12px;color:#888;min-width:40px;">${item.unidad}</span>
                <button class="btn-quitar no-print" onclick="PlanillaSalida.quitarInsumo(${index})">✕</button>
            </div>`;
        });
        
        container.innerHTML = html;
        
        totalSection.style.display = 'flex';
        document.getElementById('total-items').textContent = totalItems;
        document.getElementById('total-unidades').textContent = totalUnidades;
    },

    async procesarSalida() {
        const receptorNombre = document.getElementById('receptor-nombre').value.trim();
        
        if (!receptorNombre) {
            UI.showToast('DEBE INGRESAR EL NOMBRE DE QUIEN RECIBE', 'error');
            return;
        }
        
        if (this.insumosSeleccionados.length === 0) {
            UI.showToast('DEBE AGREGAR AL MENOS UN INSUMO', 'error');
            return;
        }
        
        // Confirmar
        if (!confirm(`¿CONFIRMAR SALIDA DE ${this.insumosSeleccionados.length} INSUMO(S)?\n\nRECEPTOR: ${receptorNombre.toUpperCase()}`)) {
            return;
        }
        
        const receptorCargo = document.getElementById('receptor-cargo').value.trim().toUpperCase();
        const observaciones = document.getElementById('receptor-observaciones').value.trim().toUpperCase();
        
        let errores = 0;
        let procesados = 0;
        
        for (const item of this.insumosSeleccionados) {
            try {
                const comentario = `PLANILLA DE SALIDA | RECEPTOR: ${receptorNombre.toUpperCase()}${receptorCargo ? ' | CARGO: ' + receptorCargo : ''}${observaciones ? ' | MOTIVO: ' + observaciones : ''}`;
                await DB.procesarSalida(item.id, item.cantidad, comentario);
                procesados++;
            } catch (e) {
                errores++;
                console.error(`Error al procesar ${item.nombre}:`, e);
            }
        }
        
        if (errores === 0) {
            UI.showToast(`${procesados} INSUMO(S) PROCESADO(S) CORRECTAMENTE`, 'success');
            // Limpiar planilla
            this.insumosSeleccionados = [];
            this.renderizarLista();
            document.getElementById('receptor-nombre').value = '';
            document.getElementById('receptor-cargo').value = '';
            document.getElementById('receptor-observaciones').value = '';
            document.getElementById('firma-receptor-nombre').textContent = '_________________';
            await App.loadAllData();
        } else {
            UI.showToast(`PROCESADOS: ${procesados} | ERRORES: ${errores}`, 'warning');
        }
    }
};
