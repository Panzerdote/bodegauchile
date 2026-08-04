const InventarioModule = {
    async init() {
        await App.loadAllData();
        this.render();
        this.setupListeners();
    },

    setupListeners() {
        const buscador = document.getElementById('busqueda-inventario');
        if (buscador) buscador.addEventListener('input', () => this.render());
        
        document.getElementById('filtro-stock-critico').addEventListener('change', () => this.render());
        document.getElementById('filtro-por-vencer').addEventListener('change', () => this.render());
        document.getElementById('filtro-vencidos').addEventListener('change', () => this.render());
    },

    render() {
        const sc = document.getElementById('filtro-stock-critico')?.checked ?? false; 
        const pv = document.getElementById('filtro-por-vencer')?.checked ?? false;
        const vc = document.getElementById('filtro-vencidos')?.checked ?? false; 
        const ninguno = !sc && !pv && !vc;
        const busqueda = document.getElementById('busqueda-inventario')?.value?.trim().toLowerCase() || '';
        
        const hoy = new Date(); 
        const lim = new Date(hoy); 
        lim.setDate(lim.getDate() + (App.state.config.dias_vencimiento || 30));
        let items = [...App.state.inventario]; 
        let filtrados = [];
        
        if (ninguno) { 
            filtrados = items; 
        } else { 
            items.forEach(item => { 
                const ec = App.esStockCritico(item); 
                const v = item.vencimiento ? new Date(item.vencimiento + 'T00:00:00') : null; 
                const venc = v && v < hoy; 
                const vp = v && !venc && v <= lim; 
                let inc = false; 
                if (sc && ec && !venc) inc = true; 
                if (pv && vp && !ec) inc = true; 
                if (vc && venc) inc = true; 
                if (ec && venc && (sc || vc)) inc = true; 
                if (inc) filtrados.push(item); 
            }); 
        }
        
        if (busqueda) {
            filtrados = filtrados.filter(item => 
                item.nombre.toLowerCase().includes(busqueda) ||
                (item.lote && item.lote.toLowerCase().includes(busqueda)) ||
                (item.codigo_barras && item.codigo_barras.toLowerCase().includes(busqueda)) ||
                (item.anaquel && item.anaquel.toLowerCase().includes(busqueda))
            );
        }
        
        document.getElementById('contador-inventario').textContent = filtrados.length;
        const c = document.getElementById('tabla-inventario'); 
        if (filtrados.length === 0) { 
            c.innerHTML = `<div class="empty-state"><div class="icon">${UI.icons.box}</div><p>SIN RESULTADOS.</p></div>`; 
            return; 
        }
        
        const esB = window.currentBodega === 'BOTIQUIN';
        let th = esB ? 
            '<th>NOMBRE</th><th class="text-center">STOCK</th><th class="text-center">UND.</th><th class="text-center">LOTE</th><th class="text-center">VENC.</th><th class="text-center">CB</th><th class="text-center">ACC.</th>' : 
            '<th>NOMBRE</th><th class="text-center">ANAQUEL</th><th class="text-center">STOCK</th><th class="text-center">UND.</th><th class="text-center">LOTE</th><th class="text-center">VENC.</th><th class="text-center">CB</th><th class="text-center">ACC.</th>';
        
        let h = `<table><thead><tr>${th}</tr></thead><tbody>`;
        
        filtrados.forEach(item => { 
            const ec = App.esStockCritico(item); 
            const v = item.vencimiento ? new Date(item.vencimiento + 'T00:00:00') : null; 
            const venc = v && v < hoy; 
            const vp = v && !venc && v <= lim; 
            let cl = ''; 
            if (venc) cl = 'stock-critical'; 
            else if (ec) cl = 'stock-critical'; 
            else if (vp) cl = 'stock-warning'; 
            
            h += `<tr class="${cl}">
                <td><strong>${item.nombre}</strong></td>
                ${esB ? '' : `<td class="text-center">${item.anaquel}</td>`}
                <td class="text-center">${item.stock}</td>
                <td class="text-center">${item.unidad||''}</td>
                <td class="text-center">${item.lote||'-'}</td>
                <td class="text-center">${item.vencimiento||'-'}${venc?' <span class="badge badge-danger">VENC</span>':''}${vp&&!ec?' <span class="badge badge-warning">PRONT</span>':''}</td>
                <td class="text-center">${item.codigo_barras ? `<span class="badge badge-info">${item.codigo_barras}</span>` : '-'}</td>
                <td class="text-center">
                    <button class="btn btn-warning btn-sm" onclick="InventarioModule.editarInsumo(${item.id})">${UI.icons.edit}</button>
                    <button class="btn btn-danger btn-sm" onclick="InventarioModule.eliminarInsumo(${item.id})">${UI.icons.trash}</button>
                </td>
            </tr>`; 
        });
        
        h += '</tbody></table>'; 
        c.innerHTML = h;
    },

    editarInsumo(id) {
        const i = App.state.inventario.find(x => x.id === id); 
        if (!i) return;
        const esB = window.currentBodega === 'BOTIQUIN';
        const anaq = App.state.secciones.map(s => s.seccion + s.anaquel).sort();
        const und = App.state.unidades.map(u => u.nombre).sort();
        const campoA = esB ? '' : `<div class="form-group"><label>ANAQUEL *</label><select id="edit-anaquel">${anaq.map(a => `<option value="${a}" ${a===i.anaquel?'selected':''}>${a}</option>`).join('')}</select></div>`;
        
        UI.openModal(`<h2>EDITAR #${i.id}</h2>
            <div class="form-group"><label>NOMBRE *</label><input type="text" id="edit-nombre" value="${escapeHtml(i.nombre||'')}" style="text-transform:uppercase;"></div>
            <div class="form-group"><label>CÓDIGO DE BARRAS</label><input type="text" id="edit-codigo-barras" value="${escapeHtml(i.codigo_barras||'')}"></div>
            ${campoA}
            <div class="form-row">
                <div class="form-group"><label>STOCK</label><input type="number" id="edit-stock" value="${i.stock}" min="0"></div>
                <div class="form-group"><label>UNIDAD</label><select id="edit-unidad"><option value="">SELECCIONE...</option>${und.map(u => `<option value="${escapeHtml(u)}" ${u===i.unidad?'selected':''}>${escapeHtml(u)}</option>`).join('')}</select></div>
            </div>
            <div class="form-row">
                <div class="form-group"><label>LOTE</label><input type="text" id="edit-lote" value="${escapeHtml(i.lote||'')}" style="text-transform:uppercase;"></div>
                <div class="form-group"><label>VENCIMIENTO</label><input type="date" id="edit-vencimiento" value="${i.vencimiento||''}"></div>
            </div>
            <div class="form-group"><label>COMENTARIOS</label><textarea id="edit-comentarios" style="text-transform:uppercase;">${escapeHtml(i.comentarios||'')}</textarea></div>
            <div class="form-actions">
                <button class="btn btn-secondary" onclick="UI.closeModal()">CANCELAR</button>
                <button class="btn btn-success" onclick="InventarioModule.procesarEdicion(${id})">${UI.icons.edit} GUARDAR</button>
            </div>`);
    },

    async procesarEdicion(id) { 
        const i = App.state.inventario.find(x => x.id === id); 
        if (!i) return; 
        const esB = window.currentBodega === 'BOTIQUIN'; 
        const editAnaque = document.getElementById('edit-anaquel');
        const an = esB ? i.anaquel : (editAnaque ? editAnaque.value : i.anaquel); 
        const editStock = document.getElementById('edit-stock');
        const ns = editStock ? parseInt(editStock.value) : i.stock; 
        const editNombre = document.getElementById('edit-nombre');
        const editCB = document.getElementById('edit-codigo-barras');
        const editUnidad = document.getElementById('edit-unidad');
        const editLote = document.getElementById('edit-lote');
        const editVenc = document.getElementById('edit-vencimiento');
        const editCom = document.getElementById('edit-comentarios');
        
        const up = { 
            nombre: editNombre ? editNombre.value.trim().toUpperCase() : i.nombre, 
            seccion: esB ? 'B' : an.charAt(0), 
            anaquel: an, 
            stock: ns, 
            codigo_barras: editCB ? editCB.value.trim() : null, 
            unidad: editUnidad ? editUnidad.value : i.unidad, 
            lote: editLote ? editLote.value.trim().toUpperCase() : i.lote, 
            vencimiento: editVenc ? editVenc.value : null, 
            comentarios: editCom ? editCom.value.trim().toUpperCase() : i.comentarios
        }; 
        
        if (!up.nombre || isNaN(ns) || ns < 0) { UI.showToast('COMPLETE LOS CAMPOS', 'error'); return; } 
        try { 
            await DB.updateInventarioItem(id, up); 
            await DB.addMovimiento({ 
                tipo: 'EDICION', 
                insumo: up.nombre, 
                cantidad: ns !== i.stock ? Math.abs(ns - i.stock) : 0, 
                stock_anterior: i.stock, 
                stock_nuevo: ns, 
                anaquel: an 
            }); 
            UI.closeModal(); 
            UI.showToast('INSUMO ACTUALIZADO', 'success'); 
            await App.loadAllData(); 
            this.render(); 
        } catch (e) { UI.showToast('ERROR: ' + e.message, 'error'); } 
    },

    async eliminarInsumo(id) { 
        const i = App.state.inventario.find(x => x.id === id); 
        if (!i) return;
        const mensaje = `¿ELIMINAR "${i.nombre}"?\n\nSTOCK ACTUAL: ${i.stock} ${i.unidad||''}\nANAQUEL: ${i.anaquel}\n\nESTA ACCIÓN NO SE PUEDE DESHACER.`;
        if (!confirm(mensaje)) return; 
        try { 
            await DB.addMovimiento({ tipo: 'ELIMINACION', insumo: i.nombre, cantidad: 0, stock_anterior: i.stock }); 
            await DB.deleteInventarioItem(id); 
            UI.showToast('INSUMO ELIMINADO', 'success'); 
            await App.loadAllData(); 
            this.render(); 
        } catch (e) { UI.showToast('ERROR: ' + e.message, 'error'); } 
    }
};
