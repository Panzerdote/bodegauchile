// ============================================
// CAPA DE BASE DE DATOS - SUPABASE
// ============================================

const DB = {
    // ============================================
    // SECCIONES
    // ============================================
    async getSecciones() {
        const { data, error } = await supabase
            .from('secciones')
            .select('*')
            .order('anaquel');
        
        if (error) throw error;
        return data;
    },

    async addSeccion(seccion, descripcion, anaquel) {
        const { data, error } = await supabase
            .from('secciones')
            .insert([{ seccion, descripcion, anaquel }])
            .select();
        
        if (error) throw error;
        return data;
    },

    async deleteSeccion(id) {
        const { error } = await supabase
            .from('secciones')
            .delete()
            .eq('id', id);
        
        if (error) throw error;
    },

    // ============================================
    // INVENTARIO
    // ============================================
    async getInventario() {
        const { data, error } = await supabase
            .from('inventario')
            .select('*')
            .order('seccion')
            .order('anaquel');
        
        if (error) throw error;
        return data;
    },

    async getInventarioItem(id) {
        const { data, error } = await supabase
            .from('inventario')
            .select('*')
            .eq('id', id)
            .single();
        
        if (error) throw error;
        return data;
    },

    async addInventarioItem(item) {
        const { data, error } = await supabase
            .from('inventario')
            .insert([item])
            .select();
        
        if (error) throw error;
        return data[0];
    },

    async updateInventarioItem(id, updates) {
        updates.updated_at = new Date().toISOString();
        const { data, error } = await supabase
            .from('inventario')
            .update(updates)
            .eq('id', id)
            .select();
        
        if (error) throw error;
        return data[0];
    },

    async deleteInventarioItem(id) {
        const { error } = await supabase
            .from('inventario')
            .delete()
            .eq('id', id);
        
        if (error) throw error;
    },

    // ============================================
    // MOVIMIENTOS
    // ============================================
    async getMovimientos(limit = 50) {
        const { data, error } = await supabase
            .from('movimientos')
            .select('*')
            .order('fecha', { ascending: false })
            .limit(limit);
        
        if (error) throw error;
        return data;
    },

    async addMovimiento(movimiento) {
        const { data, error } = await supabase
            .from('movimientos')
            .insert([movimiento])
            .select();
        
        if (error) throw error;
        return data[0];
    },

    // ============================================
    // CONFIGURACIÓN
    // ============================================
    async getConfig() {
        const { data, error } = await supabase
            .from('configuracion')
            .select('*')
            .order('id')
            .limit(1)
            .single();
        
        if (error) throw error;
        return data;
    },

    // ============================================
    // OPERACIONES COMBINADAS
    // ============================================
    async procesarIngreso(nombre, seccion, anaquel, cantidad, unidad, lote, vencimiento, comentarios) {
        // Buscar si existe el insumo
        const { data: existentes } = await supabase
            .from('inventario')
            .select('*')
            .ilike('nombre', nombre)
            .eq('anaquel', anaquel);
        
        let itemId;
        let stockAnterior = 0;
        let stockNuevo = cantidad;
        
        if (existentes && existentes.length > 0) {
            // Actualizar existente
            const item = existentes[0];
            itemId = item.id;
            stockAnterior = item.stock;
            stockNuevo = stockAnterior + cantidad;
            
            const updates = { stock: stockNuevo };
            if (lote) updates.lote = lote;
            if (vencimiento) updates.vencimiento = vencimiento;
            if (comentarios) updates.comentarios = comentarios;
            if (unidad) updates.unidad = unidad;
            
            await this.updateInventarioItem(itemId, updates);
        } else {
            // Crear nuevo
            const nuevo = await this.addInventarioItem({
                nombre,
                seccion,
                anaquel,
                stock: cantidad,
                unidad,
                lote,
                vencimiento: vencimiento || null,
                comentarios
            });
            itemId = nuevo.id;
        }
        
        // Registrar movimiento
        await this.addMovimiento({
            tipo: 'INGRESO',
            insumo: nombre,
            cantidad,
            stock_anterior: stockAnterior,
            stock_nuevo: stockNuevo,
            anaquel,
            comentarios,
            usuario: 'web'
        });
        
        return { itemId, stockNuevo };
    },

    async procesarSalida(itemId, cantidad, comentarios) {
        const item = await this.getInventarioItem(itemId);
        
        if (!item) throw new Error('Insumo no encontrado');
        if (cantidad > item.stock) throw new Error('Stock insuficiente');
        
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
            comentarios,
            usuario: 'web'
        });
        
        return { stockNuevo };
    }
};
