const MovimientosModule = {
    async init() {
        UI.showLoading('tabla-movimientos');
        await App.loadAllData();
        this.cargarFiltroUsuarios();
        this.render();
        this.setupListeners();
    },

    setupListeners() {
        document.getElementById('filtro-tipo-movimiento').addEventListener('change', () => this.render());
        document.getElementById('filtro-usuario-movimiento').addEventListener('change', () => this.render());
        document.getElementById('busqueda-movimientos').addEventListener('input', () => this.render());
    },

    cargarFiltroUsuarios() { 
        const s = document.getElementById('filtro-usuario-movimiento'); 
        if (!s) return; 
        const us = [...new Set(App.state.movimientos.map(m => m.usuario).filter(Boolean))].sort(); 
        s.innerHTML = '<option value="TODOS">TODOS LOS USUARIOS</option>'; 
        us.forEach(u => { s.innerHTML += `<option value="${u}">${u}</option>`; }); 
    },

    render() {
        const ft = document.getElementById('busqueda-movimientos')?.value?.trim().toLowerCase() || ''; 
        const fTipo = document.getElementById('filtro-tipo-movimiento')?.value || 'TODOS'; 
        const fUsr = document.getElementById('filtro-usuario-movimiento')?.value || 'TODOS';
        
        let movs = [...App.state.movimientos]; 
        if (fTipo !== 'TODOS') movs = movs.filter(m => m.tipo === fTipo); 
        if (fUsr !== 'TODOS') movs = movs.filter(m => (m.usuario || 'SISTEMA') === fUsr);
        if (ft) movs = movs.filter(m => 
            (m.insumo&&m.insumo.toLowerCase().includes(ft))||
            (m.anaquel&&m.anaquel.toLowerCase().includes(ft))||
            (m.comentarios&&m.comentarios.toLowerCase().includes(ft))
        );
        
        const c = document.getElementById('tabla-movimientos'); 
        if (movs.length === 0) { 
            c.innerHTML = `<div class="empty-state"><div class="icon">${UI.icons.list}</div><p>SIN MOVIMIENTOS.</p></div>`; 
            return; 
        }
        
        let h = '<div class="table-container"><table><thead><tr><th>USUARIO / FECHA</th><th class="text-center">TIPO</th><th>INFO.</th><th class="text-center">CANT.</th><th class="text-center">STOCK ANT.</th><th class="text-center">STOCK NUEVO</th><th class="text-center">ANAQUEL</th><th>COMENTARIOS</th></tr></thead><tbody>';
        
        movs.forEach(mov => { 
            const f = new Date(mov.fecha); 
            const co = App.getColorTipo(mov.tipo); 
            const tf = App.formatearTipo(mov.tipo); 
            const usr = mov.usuario || 'SISTEMA'; 
            h += `<tr>
                <td>${usr} - ${f.toLocaleString('es-CL')}</td>
                <td class="text-center"><span class="badge" style="background:${co};">${tf}</span></td>
                <td>${mov.insumo||'-'}</td>
                <td class="text-center">${mov.cantidad||'-'}</td>
                <td class="text-center">${mov.stock_anterior!=null?mov.stock_anterior:'-'}</td>
                <td class="text-center">${mov.stock_nuevo!=null?mov.stock_nuevo:'-'}</td>
                <td class="text-center">${mov.anaquel||'-'}</td>
                <td style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${escapeHtml(mov.comentarios||'')}">${escapeHtml(mov.comentarios||'')}</td>
            </tr>`; 
        });
        
        h += '</tbody></table></div>'; 
        c.innerHTML = h;
        document.getElementById('contador-movimientos').textContent = movs.length;
    },

    exportarExcel() { 
        const ft = document.getElementById('busqueda-movimientos')?.value?.trim().toLowerCase()||''; 
        const fT = document.getElementById('filtro-tipo-movimiento')?.value||'TODOS'; 
        const fU = document.getElementById('filtro-usuario-movimiento')?.value||'TODOS'; 
        let m = [...App.state.movimientos]; 
        if (fT!=='TODOS') m = m.filter(x => x.tipo===fT); 
        if (fU!=='TODOS') m = m.filter(x => (x.usuario||'SISTEMA')===fU); 
        if (ft) m = m.filter(x => (x.insumo&&x.insumo.toLowerCase().includes(ft))||(x.anaquel&&x.anaquel.toLowerCase().includes(ft))); 
        if (!m.length) { UI.showToast('SIN DATOS', 'warning'); return; } 
        
        let csv = 'USUARIO;FECHA;TIPO;INFO.;CANTIDAD;STOCK ANT.;STOCK NUEVO;ANAQUEL;COMENTARIOS\n'; 
        m.forEach(x => { 
            csv += `"${x.usuario||'SISTEMA'}";"${new Date(x.fecha).toLocaleString('es-CL')}";${App.formatearTipo(x.tipo)};"${x.insumo||''}";${x.cantidad||0};${x.stock_anterior!=null?x.stock_anterior:''};${x.stock_nuevo!=null?x.stock_nuevo:''};${x.anaquel||''};"${x.comentarios||''}"\n`; 
        }); 
        
        const b = new Blob(['\uFEFF'+csv], {type:'text/csv;charset=utf-8;'}); 
        const u = URL.createObjectURL(b); 
        const a = document.createElement('a'); 
        a.href = u; 
        a.download = `MOVIMIENTOS_${window.currentBodega}_${new Date().toISOString().split('T')[0]}.csv`; 
        a.click(); 
        URL.revokeObjectURL(u); 
        UI.showToast(`${m.length} MOVIMIENTOS EXPORTADOS`, 'success'); 
    }
};
