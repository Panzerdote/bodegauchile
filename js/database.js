// ============================================
// ZONA HORARIA CHILE
// ============================================
function ahoraChile() {
    const ahora = new Date();
    const offsetChile = -4 * 60;
    const offsetLocal = ahora.getTimezoneOffset();
    const diff = (offsetChile - offsetLocal) * 60 * 1000;
    return new Date(ahora.getTime() + diff);
}

// ============================================
// CAPA DE BASE DE DATOS - SUPABASE
// ============================================

const DB = {
    // ============================================
    // SECCIONES
    // ============================================
    async getSecciones(bodega) {
        const { data, error } = await supabaseClient
            .from('secciones')
            .select('*')
            .eq('bodega', bodega || window.currentBodega || 'BODEGA')
            .order('seccion')
            .order('anaquel');
        if (error) throw error;
        return data || [];
    },

    async addSeccion(seccion, descripcion, anaquel) {
        const bodega = window.currentBodega || 'BODEGA';
        const { data, error } = await supabaseClient
            .from('secciones')
            .insert([{
                seccion,
                descripcion: descripcion ? descripcion.toUpperCase() : null,
                anaquel,
                bodega
            }])
            .select();
        if (error) {
            if (error.code === '23505') throw new Error('EL ANAQUEL ' + seccion + anaquel + ' YA EXISTE');
            throw error;
        }
        return data[0];
    },

    async deleteSeccion(id) {
        const { error } = await supabaseClient.from('secciones').delete().eq('id', id);
        if (error) throw error;
        return true;
    },

    // ============================================
    // INVENTARIO
    // ============================================
    async getInventario(bodega) {
        const { data, error } = await supabaseClient
            .from('inventario')
            .select('*')
            .eq('bodega', bodega || window.currentBodega || 'BODEGA')
            .order('seccion')
            .order('anaquel');
        if (error) throw error;
        return data || [];
    },

    async getInventarioItem(id) {
        const { data, error } = await supabaseClient
            .from('inventario')
            .select('*')
            .eq('id', id)
            .single();
        if (error) throw error;
        return data;
    },

    async addInventarioItem(item) {
        const bodega = window.currentBodega || 'BODEGA';
        const { data, error } = await supabaseClient
            .from('inventario')
            .insert([{
                nombre: item.nombre ? item.nombre.toUpperCase() : null,
                seccion: item.seccion,
                anaquel: item.anaquel,
                stock: item.stock || 0,
                unidad: item.unidad ? item.unidad.toUpperCase() : null,
                lote: item.lote ? item.lote.toUpperCase() : null,
                vencimiento: item.vencimiento || null,
                comentarios: item.comentarios ? item.comentarios.toUpperCase() : null,
                bodega
            }])
            .select();
        if (error) throw error;
        return data[0];
    },

    async updateInventarioItem(id, updates) {
        if (updates.nombre) updates.nombre = updates.nombre.toUpperCase();
        if (updates.unidad) updates.unidad = updates.unidad.toUpperCase();
        if (updates.lote) updates.lote = updates.lote.toUpperCase();
        if (updates.comentarios) updates.comentarios = updates.comentarios.toUpperCase();
        updates.updated_at = new Date().toISOString();
        const { data, error } = await supabaseClient
            .from('inventario')
            .update(updates)
            .eq('id', id)
            .select();
        if (error) throw error;
        return data[0];
    },

    async deleteInventarioItem(id) {
        const { error } = await supabaseClient.from('inventario').delete().eq('id', id);
        if (error) throw error;
        return true;
    },

    // ============================================
    // MOVIMIENTOS
    // ============================================
    async getMovimientos(limit = 50, bodega) {
        const { data, error } = await supabaseClient
            .from('movimientos')
            .select('*')
            .eq('bodega', bodega || window.currentBodega || 'BODEGA')
            .order('fecha', { ascending: false })
            .limit(limit);
        if (error) throw error;
        return data || [];
    },

    async getTodosMovimientos(bodega) {
        const { data, error } = await supabaseClient
            .from('movimientos')
            .select('*')
            .eq('bodega', bodega || window.currentBodega || 'BODEGA')
            .order('fecha', { ascending: false })
            .limit(1000);
        if (error) throw error;
        return data || [];
    },

    async addMovimiento(movimiento) {
        const bodega = window.currentBodega || 'BODEGA';
        const usuario = movimiento.usuario || (window.currentUser ? window.currentUser.usuario.toUpperCase() : 'SISTEMA');
        const { data, error } = await supabaseClient
            .from('movimientos')
            .insert([{
                fecha: ahoraChile().toISOString(),
                tipo: movimiento.tipo,
                insumo: movimiento.insumo ? movimiento.insumo.toUpperCase() : null,
                cantidad: movimiento.cantidad || 0,
                stock_anterior: movimiento.stock_anterior !== undefined ? movimiento.stock_anterior : null,
                stock_nuevo: movimiento.stock_nuevo !== undefined ? movimiento.stock_nuevo : null,
                anaquel: movimiento.anaquel ? movimiento.anaquel.toUpperCase() : null,
                comentarios: movimiento.comentarios ? movimiento.comentarios.toUpperCase() : null,
                usuario,
                bodega
            }])
            .select();
        if (error) throw error;
        return data[0];
    },

    // ============================================
    // CONFIGURACIÓN
    // ============================================
    async getConfig(bodega) {
        const { data, error } = await supabaseClient
            .from('configuracion')
            .select('*')
            .eq('bodega', bodega || window.currentBodega || 'BODEGA')
            .order('id')
            .limit(1)
            .single();
        if (error) return { porcentaje_critico: 20, dias_vencimiento: 30 };
        return data;
    },

    // ============================================
    // UNIDADES DE MEDIDA
    // ============================================
    async getUnidadesMedida(bodega) {
        const { data, error } = await supabaseClient
            .from('unidades_medida')
            .select('*')
            .eq('bodega', bodega || window.currentBodega || 'BODEGA')
            .order('nombre');
        if (error) throw error;
        return data || [];
    },

    async addUnidadMedida(nombre) {
        const bodega = window.currentBodega || 'BODEGA';
        const { data, error } = await supabaseClient
            .from('unidades_medida')
            .insert([{ nombre: nombre.toUpperCase(), bodega }])
            .select();
        if (error) {
            if (error.code === '23505') throw new Error('LA UNIDAD YA EXISTE');
            throw error;
        }
        return data[0];
    },

    async deleteUnidadMedida(id) {
        const { error } = await supabaseClient.from('unidades_medida').delete().eq('id', id);
        if (error) throw error;
        return true;
    },

    // ============================================
    // BÚSQUEDA DE INSUMOS (AUTOCOMPLETADO)
    // ============================================
    async buscarInsumosNombre(busqueda) {
        const bodega = window.currentBodega || 'BODEGA';
        const { data, error } = await supabaseClient
            .from('inventario')
            .select('nombre, unidad, lote, vencimiento')
            .ilike('nombre', `%${busqueda}%`)
            .eq('bodega', bodega)
            .order('nombre')
            .limit(10);
        if (error) throw error;
        
        // Eliminar duplicados (mismo nombre + lote + vencimiento)
        const unicos = [];
        const claves = new Set();
        (data || []).forEach(item => {
            const clave = `${item.nombre.toLowerCase()}|${(item.lote || '').toLowerCase()}|${item.vencimiento || ''}`;
            if (!claves.has(clave)) {
                claves.add(clave);
                unicos.push(item);
            }
        });
        return unicos;
    },

    // ============================================
    // OPERACIONES COMBINADAS
    // ============================================
    async procesarIngreso(nombre, seccion, anaquel, cantidad, unidad, lote, vencimiento, comentarios) {
        try {
            const bodega = window.currentBodega || 'BODEGA';
            const nombreUpper = nombre.toUpperCase();
            const loteUpper = lote ? lote.toUpperCase() : '';
            
            // CORRECCIÓN: Buscar coincidencia exacta por nombre + anaquel + lote + vencimiento
            // Si el lote o vencimiento son diferentes, se crea un nuevo registro
            const { data: existentes } = await supabaseClient
                .from('inventario')
                .select('*')
                .ilike('nombre', nombreUpper)
                .eq('anaquel', anaquel)
                .eq('bodega', bodega)
                .eq('lote', loteUpper)
                .eq('vencimiento', vencimiento || null);
            
            let itemId, stockAnterior = 0, stockNuevo = cantidad;
            
            if (existentes && existentes.length > 0) {
                // Mismo insumo, mismo lote, mismo vencimiento → actualizar stock
                const item = existentes[0];
                itemId = item.id;
                stockAnterior = item.stock;
                stockNuevo = stockAnterior + cantidad;
                
                const updates = { stock: stockNuevo };
                if (comentarios) updates.comentarios = comentarios.toUpperCase();
                if (unidad) updates.unidad = unidad.toUpperCase();
                await this.updateInventarioItem(itemId, updates);
            } else {
                // Lote o vencimiento diferente → crear nuevo registro
                const nuevo = await this.addInventarioItem({
                    nombre: nombreUpper,
                    seccion,
                    anaquel,
                    stock: cantidad,
                    unidad: unidad ? unidad.toUpperCase() : null,
                    lote: loteUpper || null,
                    vencimiento: vencimiento || null,
                    comentarios: comentarios ? comentarios.toUpperCase() : null
                });
                itemId = nuevo.id;
            }
            
            await this.addMovimiento({
                tipo: 'INGRESO',
                insumo: nombreUpper,
                cantidad,
                stock_anterior: stockAnterior,
                stock_nuevo: stockNuevo,
                anaquel,
                comentarios: comentarios ? comentarios.toUpperCase() : null
            });
            
            return { itemId, stockNuevo };
        } catch (error) {
            console.error('Error en procesarIngreso:', error);
            throw error;
        }
    },

    async procesarSalida(itemId, cantidad, comentarios) {
        try {
            const item = await this.getInventarioItem(itemId);
            
            if (!item) throw new Error('INSUMO NO ENCONTRADO');
            if (cantidad > item.stock) throw new Error('STOCK INSUFICIENTE. STOCK ACTUAL: ' + item.stock);
            if (cantidad <= 0) throw new Error('LA CANTIDAD DEBE SER MAYOR A 0');
            
            const stockAnterior = item.stock;
            const stockNuevo = stockAnterior - cantidad;
            
            await this.updateInventarioItem(itemId, { stock: stockNuevo });
            
            await this.addMovimiento({
                tipo: 'SALIDA',
                insumo: item.nombre,
                cantidad,
                stock_anterior: stockAnterior,
                stock_nuevo: stockNuevo,
                anaquel: item.anaquel,
                comentarios: comentarios ? comentarios.toUpperCase() : null
            });
            
            return {
                stockNuevo,
                nombre: item.nombre,
                anaquel: item.anaquel
            };
        } catch (error) {
            console.error('Error en procesarSalida:', error);
            throw error;
        }
    }
};
