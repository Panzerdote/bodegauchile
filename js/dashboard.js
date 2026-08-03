const Dashboard = {
    async render() {
        const { inventario, secciones, config } = App.state;
        document.getElementById('total-insumos').textContent = inventario.length;
        document.getElementById('total-badge').textContent = inventario.length;
        document.getElementById('stock-total').textContent = inventario.reduce((s, i) => s + (i.stock || 0), 0);
        document.getElementById('secciones-activas').textContent = [...new Set(secciones.map(s => s.seccion))].length;
        
        const criticos = inventario.filter(i => App.esStockCritico(i));
        document.getElementById('stock-critico').textContent = criticos.length;
        
        const hoy = new Date(); 
        const lim = new Date(hoy); 
        lim.setDate(lim.getDate() + (config.dias_vencimiento || 30));
        const vc = inventario.filter(i => { 
            if (!i.vencimiento) return false; 
            return new Date(i.vencimiento + 'T00:00:00') < hoy; 
        }).length;
        const pv = inventario.filter(i => { 
            if (!i.vencimiento) return false; 
            const v = new Date(i.vencimiento + 'T00:00:00'); 
            return v >= hoy && v <= lim; 
        }).length;
        document.getElementById('vencimientos-proximos').textContent = vc + pv;
        
        this.renderAlertas(criticos);
    },

    renderAlertas(criticos) {
        const c = document.getElementById('alertas-stock'); 
        const { inventario, config } = App.state;
        const hoy = new Date(); 
        const lim = new Date(hoy); 
        lim.setDate(lim.getDate() + (config.dias_vencimiento || 30));
        
        const porVencer = inventario.filter(i => { 
            if (!i.vencimiento) return false; 
            const v = new Date(i.vencimiento + 'T00:00:00'); 
            return v >= hoy && v <= lim && !App.esStockCritico(i); 
        });
        const vencidos = inventario.filter(i => { 
            if (!i.vencimiento) return false; 
            return new Date(i.vencimiento + 'T00:00:00') < hoy && !App.esStockCritico(i); 
        });
        
        const cIds = new Set(criticos.map(i => i.id));
        const pvf = porVencer.filter(i => !cIds.has(i.id)); 
        const vf = vencidos.filter(i => !cIds.has(i.id));
        const total = criticos.length + pvf.length + vf.length;
        
        if (total === 0) { 
            c.innerHTML = `<div class="empty-state"><div class="icon">${UI.icons.check}</div><p>NO HAY ALERTAS.</p></div>`; 
            return; 
        }
        
        let h = '<div class="table-container"><table><thead><tr><th>INSUMO</th><th class="text-center">STOCK</th><th class="text-center">ANAQUEL</th><th class="text-center">VENC.</th><th class="text-center">ALERTA</th></tr></thead><tbody>';
        
        criticos.forEach(item => { 
            const v = item.vencimiento ? new Date(item.vencimiento + 'T00:00:00') : null; 
            const venc = v && v < hoy; 
            const vp = v && !venc && v <= lim; 
            let ta = ''; 
            if (venc) ta = '<span class="badge badge-danger">VENCIDO</span> <span class="badge badge-danger">STOCK CRÍTICO</span>'; 
            else if (vp) ta = '<span class="badge badge-danger">STOCK CRÍTICO</span> <span class="badge badge-warning">POR VENCER</span>'; 
            else ta = '<span class="badge badge-danger">STOCK CRÍTICO</span>'; 
            h += `<tr class="stock-critical"><td><strong>${item.nombre}</strong></td><td class="text-center">${item.stock} ${item.unidad||''}</td><td class="text-center">${item.anaquel}</td><td class="text-center">${item.vencimiento||'N/A'}</td><td class="text-center">${ta}</td></tr>`; 
        });
        
        vf.forEach(item => { 
            h += `<tr class="stock-critical"><td><strong>${item.nombre}</strong></td><td class="text-center">${item.stock} ${item.unidad||''}</td><td class="text-center">${item.anaquel}</td><td class="text-center">${item.vencimiento||'N/A'}</td><td class="text-center"><span class="badge badge-danger">VENCIDO</span></td></tr>`; 
        });
        
        pvf.forEach(item => { 
            const dr = Math.ceil((new Date(item.vencimiento + 'T00:00:00') - hoy) / 86400000); 
            h += `<tr class="stock-warning"><td><strong>${item.nombre}</strong></td><td class="text-center">${item.stock} ${item.unidad||''}</td><td class="text-center">${item.anaquel}</td><td class="text-center">${item.vencimiento||'N/A'} <small>(${dr} DÍAS)</small></td><td class="text-center"><span class="badge badge-warning">POR VENCER</span></td></tr>`; 
        });
        
        h += '</tbody></table></div>'; 
        c.innerHTML = h;
        
        if (total > 10) { 
            c.innerHTML += `<p style="margin-top:10px;font-size:11px;color:#888;text-align:center;">MOSTRANDO LAS PRIMERAS 10 DE ${total} ALERTAS. <a href="inventario.html" style="color:var(--primary);">VER TODAS →</a></p>`; 
        }
    }
};
