// ============================================
// CAPA DE BASE DE DATOS - SUPABASE
// ============================================

const DB = {
    // ============================================
    // SECCIONES
    // ============================================
    async getSecciones() {
        const { data, error } = await supabaseClient
            .from('secciones')
            .select('*')
            .order('seccion')
            .order('anaquel');
        
        if (error) {
            console.error('Error al obtener secciones:', error);
            throw error;
        }
        return data || [];
    },

    async addSeccion(seccion, descripcion, anaquel) {
        const { data, error } = await supabaseClient
            .from('secciones')
            .insert([{ 
                seccion: seccion, 
                descripcion: descripcion || null, 
                anaquel: anaquel 
            }])
            .select();
        
        if (error) {
            console.error('Error al agregar sección:', error);
            // Error de duplicado
            if (error.code === '23505') {
                throw new Error('El anaquel ' + seccion + anaquel + ' ya existe');
            }
            throw error;
        }
        return data[0];
    },

    async deleteSeccion(id) {
        const { error } = await supabaseClient
            .from('secciones')
            .delete()
            .eq('id', id);
        
        if (error) {
            console.error('Error al eliminar sección:', error);
            throw error;
        }
        return true;
    },

    // ============================================
    // INVENTARIO
    // ============================================
    async getInventario() {
        const { data, error } = await supabaseClient
            .from('inventario')
            .select('*')
            .order('seccion')
            .order('anaquel');
        
        if (error) {
            console.error('Error al obtener inventario:', error);
            throw error;
        }
        return data || [];
    },

    async getInventarioItem(id) {
        const { data, error } = await supabaseClient
            .from('inventario')
            .select('*')
            .eq('id', id)
            .single();
        
        if (error) {
            console.error('Error al obtener item:', error);
            throw error;
        }
        return data;
    },

    async addInventarioItem(item) {
        const { data, error } = await supabaseClient
            .from('inventario')
            .insert([{
                nombre: item.nombre,
                seccion: item.seccion,
                anaquel: item.anaquel,
                stock: item.stock || 0,
                unidad: item.unidad || null,
                lote: item.lote || null,
                vencimiento: item.vencimiento || null,
                comentarios: item.comentarios || null
            }])
            .select();
        
        if (error) {
            console.error('Error al agregar item:', error);
            throw error;
        }
        return data[0];
    },

    async updateInventarioItem(id, updates) {
        updates.updated_at = new Date().toISOString();
        
        const { data, error } = await supabaseClient
            .from('inventario')
            .update(updates)
            .eq('id', id)
            .select();
        
        if (error) {
            console.error('Error al actualizar item:', error);
            throw error;
        }
        return data[0];
    },

    async deleteInventarioItem(id) {
        const { error } = await supabaseClient
            .from('inventario')
            .delete()
            .eq('id', id);
        
        if (error) {
            console.error('Error al eliminar item:', error);
            throw error;
        }
        return true;
    },

    // ============================================
    // MOVIMIENTOS
    // ============================================
    async getMovimientos(limit = 50) {
        const { data, error } = await supabaseClient
            .from('movimientos')
            .select('*')
            .order('fecha', { ascending: false })
            .limit(limit);
        
        if (error) {
            console.error('Error al obtener movimientos:', error);
            throw error;
        }
        return data || [];
    },

    async addMovimiento(movimiento) {
        const { data, error } = await supabaseClient
            .from('movimientos')
            .insert([{
                tipo: movimiento.tipo,
                insumo: movimiento.insumo,
                cantidad: movimiento.cantidad,
                stock_anterior: movimiento.stock_anterior || 0,
                stock_nuevo: movimiento.stock_nuevo || 0,
                anaquel: movimiento.anaquel || null,
                comentarios: movimiento.comentarios || null,
                usuario: movimiento.usuario || 'web'
            }])
            .select();
        
        if (error) {
            console.error('Error al agregar movimiento:', error);
            throw error;
        }
        return data[0];
    },

    // ============================================
    // CONFIGURACIÓN
    // ============================================
    async getConfig() {
        const { data, error } = await supabaseClient
            .from('configuracion')
            .select('*')
            .order('id')
            .limit(1)
            .single();
        
        if (error) {
            console.error('Error al obtener configuración:', error);
            // Si no hay configuración, devolver valores por defecto
            return { porcentaje_critico: 20, dias_vencimiento: 30 };
        }
        return data;
    },

    async updateConfig(updates) {
        updates.updated_at = new Date().toISOString();
        
        const { data, error } = await supabaseClient
            .from('configuracion')
            .update(updates)
            .eq('id', 1)
            .select();
        
        if (error) {
            console.error('Error al actualizar configuración:', error);
            throw error;
        }
        return data[0];
    },

    // ============================================
    // OPERACIONES COMBINADAS
    // ============================================
    async procesarIngreso(nombre, seccion, anaquel, cantidad, unidad, lote, vencimiento, comentarios) {
        try {
            // Buscar si existe el insumo en ese anaquel específico
            const { data: existentes, error: errorBusqueda } = await supabaseClient
                .from('inventario')
                .select('*')
                .ilike('nombre', nombre)
                .eq('anaquel', anaquel);
            
            if (errorBusqueda) throw errorBusqueda;
            
            let itemId;
            let stockAnterior = 0;
            let stockNuevo = cantidad;
            
            if (existentes && existentes.length > 0) {
                // Actualizar insumo existente
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
                // Crear nuevo insumo
                const nuevo = await this.addInventarioItem({
                    nombre: nombre,
                    seccion: seccion,
                    anaquel: anaquel,
                    stock: cantidad,
                    unidad: unidad || null,
                    lote: lote || null,
                    vencimiento: vencimiento || null,
                    comentarios: comentarios || null
                });
                itemId = nuevo.id;
            }
            
            // Registrar movimiento
            await this.addMovimiento({
                tipo: 'INGRESO',
                insumo: nombre,
                cantidad: cantidad,
                stock_anterior: stockAnterior,
                stock_nuevo: stockNuevo,
                anaquel: anaquel,
                comentarios: comentarios || null,
                usuario: 'web'
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
            
            if (!item) {
                throw new Error('Insumo no encontrado');
            }
            
            if (cantidad > item.stock) {
                throw new Error('Stock insuficiente. Stock actual: ' + item.stock);
            }
            
            if (cantidad <= 0) {
                throw new Error('La cantidad debe ser mayor a 0');
            }
            
            const stockAnterior = item.stock;
            const stockNuevo = stockAnterior - cantidad;
            
            // Actualizar stock
            await this.updateInventarioItem(itemId, { stock: stockNuevo });
            
            // Registrar movimiento
            await this.addMovimiento({
                tipo: 'SALIDA',
                insumo: item.nombre,
                cantidad: cantidad,
                stock_anterior: stockAnterior,
                stock_nuevo: stockNuevo,
                anaquel: item.anaquel,
                comentarios: comentarios || null,
                usuario: 'web'
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
    },

    // ============================================
    // BÚSQUEDAS AVANZADAS
    // ============================================
    async buscarPorNombre(busqueda) {
        const { data, error } = await supabaseClient
            .from('inventario')
            .select('*')
            .ilike('nombre', `%${busqueda}%`)
            .order('nombre');
        
        if (error) throw error;
        return data || [];
    },

    async buscarPorAnaquel(anaquel) {
        const { data, error } = await supabaseClient
            .from('inventario')
            .select('*')
            .eq('anaquel', anaquel)
            .order('nombre');
        
        if (error) throw error;
        return data || [];
    },

    async getStockCritico(porcentajeCritico = 20) {
        const { data, error } = await supabaseClient
            .from('inventario')
            .select('*')
            .order('stock');
        
        if (error) throw error;
        
        // Filtrar los que tienen stock bajo según el porcentaje
        return (data || []).filter(item => {
            if (!item.stock || item.stock === 0) return true;
            return item.stock <= 5; // Stock mínimo fijo
        });
    },

    async getVencimientosProximos(dias = 30) {
        const hoy = new Date().toISOString().split('T')[0];
        const limite = new Date();
        limite.setDate(limite.getDate() + dias);
        const limiteStr = limite.toISOString().split('T')[0];
        
        const { data, error } = await supabaseClient
            .from('inventario')
            .select('*')
            .gte('vencimiento', hoy)
            .lte('vencimiento', limiteStr)
            .order('vencimiento');
        
        if (error) throw error;
        return data || [];
    }
};
