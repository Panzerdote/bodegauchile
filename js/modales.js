const Modales = {
    async showIngreso(state) {
        const esBotiquin = window.currentBodega === 'BOTIQUIN';
        const unidades = state.unidades.map(u => u.nombre).sort();
        
        const campoAnaquel = esBotiquin ? '' : `
            <div class="form-group" style="position:relative;">
                <label>ANAQUEL *</label>
                <input type="text" id="ing-anaquel" placeholder="ESCRIBA O PISTOLEE EL ANAQUEL..." autocomplete="off" onkeyup="App.buscarAnaquelesIngreso()" onfocus="App.buscarAnaquelesIngreso()" style="text-transform:uppercase;">
                <div id="sugerencias-anaquel" style="position:absolute;top:100%;left:0;right:0;background:white;border:1px solid #ddd;border-radius:0 0 5px 5px;max-height:200px;overflow-y:auto;z-index:100;display:none;box-shadow:0 4px 8px rgba(0,0,0,0.1);"></div>
                ${state.secciones.length===0?'<small style="color:#c0392b;">NO HAY ANAQUELES CONFIGURADOS.</small>':''}
            </div>`;
        
        UI.openModal(`<h2>NUEVO INGRESO</h2>
            <div class="form-group" style="position:relative;">
                <label>NOMBRE DEL INSUMO *</label>
                <input type="text" id="ing-nombre" placeholder="ESCRIBA EL NOMBRE..." autofocus autocomplete="off" onkeyup="App.buscarCoincidencias('ing')" onfocus="App.buscarCoincidencias('ing')" style="text-transform:uppercase;">
                <div id="sugerencias-ing" style="position:absolute;top:100%;left:0;right:0;background:white;border:1px solid #ddd;border-radius:0 0 5px 5px;max-height:200px;overflow-y:auto;z-index:100;display:none;box-shadow:0 4px 8px rgba(0,0,0,0.1);"></div>
            </div>
            <div class="form-group">
                <label>CÓDIGO DE BARRAS</label>
                <input type="text" id="ing-codigo-barras" placeholder="PISTOLEE O INGRESE EL CÓDIGO..." onkeypress="if(event.key==='Enter'){event.preventDefault();App.buscarPorCodigoBarrasIngreso();}">
            </div>
            ${campoAnaquel}
            <div class="form-row">
                <div class="form-group"><label>CANTIDAD *</label><input type="number" id="ing-cantidad" value="1" min="1"></div>
                <div class="form-group"><label>UNIDAD</label><select id="ing-unidad"><option value="">SELECCIONE...</option>${unidades.map(u => `<option value="${u}">${u}</option>`).join('')}</select></div>
            </div>
            <div class="form-row">
                <div class="form-group"><label>LOTE</label><div id="ing-lote-container"><input type="text" id="ing-lote" style="text-transform:uppercase;"></div></div>
                <div class="form-group"><label>VENCIMIENTO</label><input type="date" id="ing-vencimiento"></div>
            </div>
            <div class="form-group"><label>COMENTARIOS</label><textarea id="ing-comentarios" style="text-transform:uppercase;"></textarea></div>
            <div class="form-actions">
                <button class="btn btn-secondary" onclick="UI.closeModal()">CANCELAR</button>
                <button class="btn btn-success" onclick="App.procesarIngreso()">${UI.icons.plus} REGISTRAR</button>
            </div>`);
        
        setTimeout(() => { 
            document.addEventListener('click', function cerrarIng(e) { 
                const inp = document.getElementById('ing-nombre'); 
                const sug = document.getElementById('sugerencias-ing'); 
                if (inp && sug && e.target !== inp && !sug.contains(e.target)) sug.style.display = 'none'; 
            }); 
            document.addEventListener('click', function cerrarAnq(e) { 
                const inp = document.getElementById('ing-anaquel'); 
                const sug = document.getElementById('sugerencias-anaquel'); 
                if (inp && sug && e.target !== inp && !sug.contains(e.target)) sug.style.display = 'none'; 
            }); 
        }, 100);
    },

    showSalida(state) {
        const anaqueles = state.secciones.map(s => s.seccion + s.anaquel).sort();
        const esBotiquin = window.currentBodega === 'BOTIQUIN';
        const campoAnaquel = esBotiquin ? '' : `<div class="form-group"><label>FILTRAR POR ANAQUEL</label><select id="sal-anaquel-filtro" onchange="App.filtrarPorAnaquelSalida()"><option value="">TODOS</option>${anaqueles.map(a => `<option value="${a}">${a}</option>`).join('')}</select></div>`;
        const campoCodigoBarras = `<div class="form-group"><label>CÓDIGO DE BARRAS</label><input type="text" id="sal-codigo-barras" placeholder="PISTOLEE O INGRESE EL CÓDIGO..." onkeypress="if(event.key==='Enter'){event.preventDefault();App.buscarPorCodigoBarrasSalida(document.getElementById('sal-codigo-barras').value);}"></div>`;
        UI.openModal(`<h2>NUEVA SALIDA</h2>${campoCodigoBarras}${campoAnaquel}<div class="form-group" style="position:relative;"><label>BUSCAR POR NOMBRE</label><input type="text" id="sal-busqueda" placeholder="ESCRIBA EL NOMBRE..." autocomplete="off" onkeyup="App.buscarCoincidenciasSalida()" onfocus="App.buscarCoincidenciasSalida()" style="text-transform:uppercase;"><div id="sugerencias-sal" style="position:absolute;top:100%;left:0;right:0;background:white;border:1px solid #ddd;border-radius:0 0 5px 5px;max-height:200px;overflow-y:auto;z-index:100;display:none;"></div></div><div id="resultados-busqueda"><p style="color:#666;padding:15px;">BUSQUE UN INSUMO PARA RETIRAR.</p></div><div class="form-actions"><button class="btn btn-secondary" onclick="UI.closeModal()">CANCELAR</button></div>`);
    },

    prepararSalida(id, state) {
        const i = state.inventario.find(x => x.id === id); 
        if (!i) return; 
        UI.openModal(`<h2>RETIRAR INSUMO</h2><div style="background:#f8f9fa;padding:15px;border-radius:8px;margin-bottom:15px;"><p><strong>INSUMO:</strong> ${i.nombre}</p><p><strong>ANAQUEL:</strong> ${i.anaquel}</p><p><strong>STOCK:</strong> ${i.stock} ${i.unidad||'UNIDADES'}</p>${i.lote?`<p><strong>LOTE:</strong> ${i.lote}</p>`:''}${i.vencimiento?`<p><strong>VENCIMIENTO:</strong> ${i.vencimiento}</p>`:''}${i.codigo_barras?`<p><strong>CB:</strong> ${i.codigo_barras}</p>`:''}</div><div class="form-group"><label>CANTIDAD *</label><input type="number" id="sal-cantidad" value="1" min="1" max="${i.stock}" autofocus></div><div class="form-group"><label>MOTIVO</label><textarea id="sal-comentarios" style="text-transform:uppercase;"></textarea></div><div class="form-actions"><button class="btn btn-secondary" onclick="Modales.showSalida(App.state)">VOLVER</button><button class="btn btn-danger" onclick="App.procesarSalida(${id})">${UI.icons.minus} CONFIRMAR</button></div>`);
    }
};
